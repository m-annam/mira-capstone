#!/usr/bin/env node
// ============================================================================
// Offline harness: executes n8n/mira_workflow.json node-by-node in Node.js with
// a mocked OpenAI API, to verify the workflow logic BEFORE importing it to n8n.
//   - runs every Code node exactly as n8n would (per-item, $json, $('Node').item)
//   - evaluates the HTTP nodes' jsonBody expressions and checks they are valid JSON
//   - follows the Switch rules and the connections graph
//   - mock router returns the test's expected route; mock specialists return
//     fixtures (tests/fixtures/good_outputs.json or bad_outputs.json)
// Usage: node tests/run_workflow_offline.js [good|bad]
// ============================================================================
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'n8n', 'mira_workflow.json'), 'utf8'));
const mode = process.argv[2] || 'good';
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `${mode}_outputs.json`), 'utf8'));
const node = n => wf.nodes.find(x => x.name === n) || (() => { throw new Error('missing node ' + n); })();
let failures = 0;
const assert = (cond, msg) => { if (!cond) { failures++; console.log('  ASSERT FAIL:', msg); } };

// --- structural checks --------------------------------------------------------
const names = new Set(wf.nodes.map(n => n.name));
for (const [src, c] of Object.entries(wf.connections)) {
  assert(names.has(src), `connection source ${src} exists`);
  c.main.flat().forEach(t => assert(names.has(t.node), `connection target ${t.node} exists`));
}
assert(new Set(wf.nodes.map(n => n.id)).size === wf.nodes.length, 'node ids unique');

function runCode(name, json, store) {
  const code = node(name).parameters.jsCode;
  const $ = n => ({ item: { json: store[n] }, first: () => ({ json: store[n] }) });
  const fn = new Function('$json', '$input', '$', code);
  return fn(json, { item: { json }, all: () => [{ json }] }, $);
}
function evalExpr(expr, json, store = {}) { // n8n expression: "=" prefix, {{ js }} segments, literal text between
  if (!expr.startsWith('=')) return expr;
  const $ = name => { if (!(name in store)) throw new Error(`$('${name}') has no output yet`); return { item: { json: store[name] } }; };
  const run = src => new Function('$json', '$', `return (${src});`)(json, $);
  const whole = expr.match(/^=\{\{([\s\S]*)\}\}$/);
  if (whole) return run(whole[1]);
  return expr.slice(1).replace(/\{\{([\s\S]*?)\}\}/g, (_, src) => String(run(src)));
}
function mockOpenAI(bodyStr, test, isRouter) {
  const body = JSON.parse(bodyStr); // throws if the expression built invalid JSON
  assert(body.model === 'gpt-4o-mini', 'model is gpt-4o-mini');
  assert(Array.isArray(body.messages) && body.messages.length === 2, 'two messages');
  const sys = body.messages[0].content, user = body.messages[1].content;
  if (isRouter) {
    assert(body.response_format && body.response_format.type === 'json_object', 'router uses JSON mode');
    assert(/json/i.test(sys), 'router prompt mentions JSON (required by OpenAI JSON mode)');
    const fx = fixtures[test.test_id];
    const route = fx ? fx.route : [].concat(test.expected_route)[0];
    return { model: 'gpt-4o-mini-2024-07-18', choices: [{ message: { content: JSON.stringify({ route, reason: 'mock', reply: route === 'clarify' && fx ? fx.output : '' }) } }],
      usage: { prompt_tokens: Math.round((sys.length + user.length) / 4), completion_tokens: 30, total_tokens: 0 } };
  }
  assert(/Project Knowledge Base/.test(user) && user.includes(test.input), 'specialist gets KB + request');
  return { model: 'gpt-4o-mini-2024-07-18', choices: [{ message: { content: fixtures[test.test_id]?.output || 'mock answer' } }],
    usage: { prompt_tokens: Math.round((sys.length + user.length) / 4), completion_tokens: 400, total_tokens: 0 } };
}

// --- run all tests through the graph ------------------------------------------
const testItems = runCode('Baseline Test Cases', {}, {});
assert(Array.isArray(testItems) && testItems.length === 23, `23 test items (got ${testItems.length})`);
const switchRules = node('Route to Specialist').parameters.rules.values.map(r => r.conditions.conditions[0].rightValue);
const SPECIALIST = { plan: 'Agent: Planner', risk: 'Agent: Risk Assessor', status: 'Agent: Status Reporter', update: 'Agent: Stakeholder Update' };
const rows = [];
for (const { json: t } of testItems) {
  const store = {};
  const step = (name, input) => (store[name] = runCode(name, input, store).json);
  step('Normalize Input', t);
  step('Project Knowledge Base', store['Normalize Input']);
  step('Prompt Registry', store['Project Knowledge Base']);
  const routerBody = evalExpr(node('Agent: Router').parameters.jsonBody, store['Prompt Registry']);
  store['Agent: Router'] = mockOpenAI(routerBody, t, true);
  step('Parse Route', store['Agent: Router']);
  const route = store['Parse Route'].route;
  const outIdx = switchRules.indexOf(route); assert(outIdx >= 0, `switch has rule for ${route}`);
  const target = wf.connections['Route to Specialist'].main[outIdx][0].node;
  let formatterInput = store['Parse Route'];
  if (route !== 'clarify') {
    assert(target === SPECIALIST[route], `switch output ${outIdx} -> ${SPECIALIST[route]}`);
    const body = evalExpr(node(target).parameters.jsonBody, store['Parse Route']);
    store[target] = mockOpenAI(body, t, false);
    formatterInput = store[target];
  } else assert(target === 'Response Formatter', 'clarify goes straight to formatter');
  step('Response Formatter', formatterInput);
  step('Evaluate Output', store['Response Formatter']);
  step('Build Langfuse Trace', store['Evaluate Output']);
  // --- Langfuse v4: OTLP/HTTP JSON traces + score-create events ---
  const otelNode = node('Langfuse: Traces (OTel)'), scoreNode = node('Langfuse: Scores');
  const otel = JSON.parse(evalExpr(otelNode.parameters.jsonBody, store['Build Langfuse Trace'], store));
  const otelResponse = { name: 'otel-ingestion-job' }; // what Langfuse returns; this is the Scores node's $json
  const spans = otel.resourceSpans[0].scopeSpans[0].spans;
  assert(spans.length === (route === 'clarify' ? 2 : 3), `${t.test_id}: ${route === 'clarify' ? 2 : 3} spans`);
  assert(spans.every(sp => /^[0-9a-f]{32}$/.test(sp.traceId) && /^[0-9a-f]{16}$/.test(sp.spanId)), 'OTel ids are 32/16 hex');
  assert(new Set(spans.map(sp => sp.traceId)).size === 1, 'one trace id');
  assert(spans.filter(sp => !sp.parentSpanId).length === 1 && spans.filter(sp => sp.parentSpanId).every(sp => sp.parentSpanId === spans[0].spanId), 'generations are children of the root span');
  assert(spans.every(sp => /^\d{19}$/.test(sp.startTimeUnixNano) && BigInt(sp.endTimeUnixNano) >= BigInt(sp.startTimeUnixNano)), 'nanosecond timestamps, end >= start');
  const attr = (sp, k) => (sp.attributes.find(a => a.key === k) || {}).value;
  assert(spans.every(sp => attr(sp, 'langfuse.trace.name') && attr(sp, 'langfuse.session.id') && attr(sp, 'langfuse.trace.tags')), 'trace attrs on every span');
  const gens = spans.filter(sp => attr(sp, 'langfuse.observation.type')?.stringValue === 'generation');
  assert(gens.length === spans.length - 1 && gens.every(g => JSON.parse(attr(g, 'langfuse.observation.usage_details').stringValue).input > 0), 'generations carry usage');
  assert(evalExpr(otelNode.parameters.url, store['Build Langfuse Trace'], store) === 'https://us.cloud.langfuse.com/api/public/otel/v1/traces', 'otel url');
  assert(otelNode.parameters.headerParameters.parameters[0].name === 'x-langfuse-ingestion-version' && otelNode.parameters.headerParameters.parameters[0].value === '4', 'v4 header');
  const scores = JSON.parse(evalExpr(scoreNode.parameters.jsonBody, otelResponse, store));
  assert(scores.batch.length >= 4 && scores.batch.every(e => e.type === 'score-create' && e.body.traceId === spans[0].traceId), 'scores are score-create on the same trace');
  assert(evalExpr(scoreNode.parameters.url, otelResponse, store) === 'https://us.cloud.langfuse.com/api/public/ingestion', 'scores url');
  store['Langfuse: Traces (OTel)'] = otelResponse;
  store['Langfuse: Scores'] = { successes: scores.batch.map(e => ({ id: e.id, status: 201 })), errors: [] };
  const lfBody = { batch: [...spans, ...scores.batch] };
  const res = runCode('Chat Response', store['Langfuse: Scores'], store).json;
  assert(res.langfuse_logged === true, 'langfuse_logged true when both calls succeed');
  rows.push({ id: t.test_id, route, pass: res.pass, rc: res.route_correct, failed: res.failed_checks, cost: res.cost_usd, events: lfBody.batch.length });
}

// --- FACTS sanity (must match eval/compute_expected.py) ------------------------
const kb = runCode('Project Knowledge Base', { chatInput: 'x' }, {}).json;
assert(JSON.stringify(kb.facts.counts) === JSON.stringify({ Done: 5, 'In Progress': 3, 'To Do': 16, Blocked: 1, Total: 25 }), 'counts 5/3/16/1/25');
assert(kb.facts.overdue.map(t => t.id).join() === 'T006', 'overdue = T006');
assert(kb.facts.due_soon.map(t => t.id).join() === 'T007,T025', 'due soon = T007,T025');
assert(kb.facts.health === 'Amber', 'health Amber');
assert(kb.facts.upcoming_milestones.map(m => `${m.phase}@${m.due}`).join() === '2@2026-04-26', 'upcoming = Phase 2 @ 2026-04-26');
assert(kb.facts.risk_ranking.slice(0, 3).map(r => r.risk_id).join() === 'R09,R01,R05', 'top-3 risks R09,R01,R05');
fs.writeFileSync(path.join(__dirname, 'fixtures', 'facts_from_workflow.json'), JSON.stringify(kb.facts, null, 1));

console.log(`\nMode: ${mode}`);
console.table(rows.map(r => ({ test: r.id, route: r.route, pass: r.pass, route_ok: r.rc, events: r.events, cost: r.cost, failed: r.failed.join(' | ').slice(0, 90) })));
fs.writeFileSync(path.join(__dirname, 'fixtures', `offline_${mode}_results.json`), JSON.stringify(rows, null, 1));
if (mode === 'good') rows.forEach(r => assert(r.pass === true, `good fixture ${r.id} passes (${r.failed.join('; ')})`));
if (mode === 'bad') rows.filter(r => fixtures[r.id]).forEach(r => assert(r.pass === false, `bad fixture ${r.id} is caught`));
console.log(failures ? `\n${failures} assertion(s) FAILED` : '\nAll assertions passed');
process.exit(failures ? 1 : 0);
