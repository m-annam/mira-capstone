// ============================================================================
// Mira | Node: "Build Langfuse Trace"   (Code node, Run Once for Each Item)
// Langfuse v4 (Cloud cutover 2026-11-16): traces and generations go to the
// OpenTelemetry endpoint; scores stay on /api/public/ingestion (score-create
// events remain supported after the cutover).
//   langfuse_otel   -> POST {host}/api/public/otel/v1/traces   (OTLP/HTTP JSON)
//       root span   "mira-request"  (input, output, route, test id, prompt version)
//       generation  "agent:router"  (model, tokens, cost, latency)
//       generation  "agent:<route>" (model, tokens, cost, latency)  [not for clarify]
//   langfuse_scores -> POST {host}/api/public/ingestion          (score-create only)
//       id_grounding, footer_compliance, cost_usd, latency_ms,
//       and for graded runs: baseline_pass, check_rate, route_correct
// ============================================================================
const j = $json, m = j.metrics;
const hex = n => Array.from({ length: n }, () => (Math.random() * 16 | 0).toString(16)).join('');
const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
const nanos = iso => (BigInt(Date.parse(iso)) * 1000000n).toString();
const price = { in: j.config.price_per_1m_input_usd, out: j.config.price_per_1m_output_usd };
const traceId = j.trace_id;              // 32 hex chars (OTel trace id = Langfuse trace id)
const rootId = hex(16);

// ---- OTLP attribute helpers ----
const str = (key, v) => ({ key, value: { stringValue: typeof v === 'string' ? v : JSON.stringify(v) } });
const int = (key, v) => ({ key, value: { intValue: String(v) } });
// Link generations to Langfuse Prompt Management (prompts pushed by "Mira — Sync Prompts to Langfuse").
const LF_PROMPT_VERSION = { v7: 1 };   // repo prompt version -> Langfuse prompt version
const LF_PROMPT_NAME = { router: 'mira-router', plan: 'mira-planner', risk: 'mira-risk', status: 'mira-status', timeline: 'mira-timeline', update: 'mira-update' };
const promptLink = key => (LF_PROMPT_VERSION[j.prompt_version] && LF_PROMPT_NAME[key])
  ? [str('langfuse.observation.prompt.name', LF_PROMPT_NAME[key]), int('langfuse.observation.prompt.version', LF_PROMPT_VERSION[j.prompt_version])] : [];
const arr = (key, vs) => ({ key, value: { arrayValue: { values: vs.map(v => ({ stringValue: String(v) })) } } });
const tags = ['mira', `route:${j.route}`, `prompt:${j.prompt_version}`, j.mode];
if (j.test_id) tags.push(`test:${j.test_id}`);
if (m.pass === true) tags.push('eval:pass');
if (m.pass === false) tags.push('eval:fail');
// Trace-level attributes are copied to every span (Langfuse v4 requirement for filtering).
const traceAttrs = [
  str('langfuse.trace.name', j.test_id ? `mira-eval ${j.test_id}` : 'mira-request'),
  str('langfuse.session.id', String(j.sessionId)),
  arr('langfuse.trace.tags', tags),
  str('langfuse.version', String(j.prompt_version)),
  str('langfuse.trace.metadata.route', String(j.route)),
  str('langfuse.trace.metadata.test_id', String(j.test_id || '')),
  str('langfuse.trace.metadata.reporting_date', String(j.facts.reporting_date)),
];
const usage = u => u ? { input: u.prompt_tokens || 0, output: u.completion_tokens || 0, total: u.total_tokens || 0 } : null;
const cost = u => u ? { input: (u.prompt_tokens || 0) * price.in / 1e6, output: (u.completion_tokens || 0) * price.out / 1e6,
  total: ((u.prompt_tokens || 0) * price.in + (u.completion_tokens || 0) * price.out) / 1e6 } : null;
const span = ({ name, spanId, parent, start, end, attrs }) => ({
  traceId, spanId, ...(parent ? { parentSpanId: parent } : {}), name, kind: 1,
  startTimeUnixNano: nanos(start), endTimeUnixNano: nanos(end), attributes: [...traceAttrs, ...attrs], status: { code: 1 },
});
const generation = (name, model, u, input, output, start, end, extra = [], promptKey = null) => span({
  name, spanId: hex(16), parent: rootId, start, end,
  attrs: [str('langfuse.observation.type', 'generation'), str('langfuse.observation.model.name', String(model || j.config.model)),
    str('langfuse.observation.input', input), str('langfuse.observation.output', output),
    ...(u ? [str('langfuse.observation.usage_details', usage(u)), str('langfuse.observation.cost_details', cost(u))] : []),
    str('langfuse.observation.metadata.prompt_version', String(j.prompt_version)), ...promptLink(promptKey), ...extra],
});

const spans = [
  span({ name: 'mira-request', spanId: rootId, start: j.started_at, end: j.finished_at,
    attrs: [str('langfuse.observation.type', 'agent'), str('langfuse.observation.input', j.chatInput), str('langfuse.observation.output', j.output),
      str('langfuse.observation.metadata.agent', String(j.agent)), str('langfuse.observation.metadata.router_reason', String(j.router_reason || '')),
      str('langfuse.observation.metadata.check_results', j.check_results || [])] }),
  generation('agent:router', j.router_model, j.router_usage, j.chatInput,
    { route: j.route, reason: j.router_reason, reply: j.router_reply }, j.started_at, j.router_done_at, [], 'router'),
];
if (j.route !== 'clarify') {
  spans.push(generation(`agent:${j.route}`, j.specialist_model, j.specialist_usage, j.chatInput, j.output, j.router_done_at, j.finished_at,
    [str('langfuse.observation.metadata.footer_added_by_formatter', String(j.footer_added))], j.route));
}
const langfuse_otel = { resourceSpans: [{
  resource: { attributes: [str('service.name', 'mira-n8n')] },
  scopeSpans: [{ scope: { name: 'mira-n8n-workflow', version: String(j.prompt_version) }, spans }],
}] };

// ---- scores (legacy batch endpoint, score-create only — supported after the v4 cutover) ----
const now = new Date().toISOString();
const score = (name, value, comment) => (value === null || value === undefined) ? null : {
  id: uid(), timestamp: now, type: 'score-create',
  body: { id: uid(), traceId, name, value: Number(value), dataType: 'NUMERIC', ...(comment ? { comment } : {}) } };
const langfuse_scores = { batch: [
  score('id_grounding', m.id_grounding, m.unknown_ids.length ? `unknown IDs: ${m.unknown_ids.join(', ')}` : 'all IDs exist in project data'),
  score('footer_compliance', m.footer_compliance),
  score('cost_usd', m.cost_usd),
  score('latency_ms', m.latency_ms),
  score('baseline_pass', m.pass === null ? null : (m.pass ? 1 : 0), j.test_id ? `${j.test_id}: ${m.required_passed}/${m.required_total} required checks` : undefined),
  score('check_rate', m.check_rate),
  score('route_correct', m.route_correct === null ? null : (m.route_correct ? 1 : 0), j.expected_route ? `expected ${[].concat(j.expected_route).join('|')}, got ${j.route}` : undefined),
].filter(Boolean) };

return { json: { ...j, langfuse_otel, langfuse_scores } };
