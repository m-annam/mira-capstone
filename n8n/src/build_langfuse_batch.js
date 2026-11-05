// ============================================================================
// Mira | Node: "Build Langfuse Trace"   (Code node, Run Once for Each Item)
// Builds one Langfuse ingestion batch per request:
//   trace  -> mira-request (input, output, route, test id, prompt version)
//   generation -> agent:router      (tokens, model, latency)
//   generation -> agent:<specialist> (tokens, model, latency)  [not for clarify]
//   scores -> id_grounding, footer_compliance, cost_usd, latency_ms,
//             and for test runs: baseline_pass, check_rate, route_correct
// Sent by "Langfuse: Ingest" (POST {host}/api/public/ingestion, Basic auth).
// ============================================================================
const j = $json, m = j.metrics;
const now = new Date().toISOString();
const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
const ev = (type, body) => ({ id: uid(), timestamp: now, type, body });
const usage = (u, price) => u ? {
  input: u.prompt_tokens || 0, output: u.completion_tokens || 0, total: u.total_tokens || 0, unit: 'TOKENS',
  inputCost: (u.prompt_tokens || 0) * price.in / 1e6, outputCost: (u.completion_tokens || 0) * price.out / 1e6,
  totalCost: ((u.prompt_tokens || 0) * price.in + (u.completion_tokens || 0) * price.out) / 1e6 } : undefined;
const price = { in: j.config.price_per_1m_input_usd, out: j.config.price_per_1m_output_usd };
const traceId = j.trace_id;

const tags = ['mira', `route:${j.route}`, `prompt:${j.prompt_version}`, j.mode];
if (j.test_id) tags.push(`test:${j.test_id}`);
if (m.pass === true) tags.push('eval:pass');
if (m.pass === false) tags.push('eval:fail');

const batch = [
  ev('trace-create', {
    id: traceId, timestamp: j.started_at, name: j.test_id ? `mira-eval ${j.test_id}` : 'mira-request',
    sessionId: j.sessionId, input: j.chatInput, output: j.output, tags, version: j.prompt_version,
    metadata: { route: j.route, agent: j.agent, router_reason: j.router_reason, reporting_date: j.facts.reporting_date,
      test_id: j.test_id, expected_route: j.expected_route, run_id: j.run_id, check_results: j.check_results },
  }),
  ev('generation-create', {
    id: uid(), traceId, name: 'agent:router', model: j.router_model, startTime: j.started_at, endTime: j.router_done_at,
    input: j.chatInput, output: { route: j.route, reason: j.router_reason, reply: j.router_reply },
    usage: usage(j.router_usage, price), metadata: { prompt_version: j.prompt_version },
  }),
];
if (j.route !== 'clarify') {
  batch.push(ev('generation-create', {
    id: uid(), traceId, name: `agent:${j.route}`, model: j.specialist_model, startTime: j.router_done_at, endTime: j.finished_at,
    input: j.chatInput, output: j.output, usage: usage(j.specialist_usage, price),
    metadata: { prompt_version: j.prompt_version, footer_added_by_formatter: j.footer_added },
  }));
}
const score = (name, value, comment) => (value === null || value === undefined) ? null :
  ev('score-create', { id: uid(), traceId, name, value: Number(value), dataType: 'NUMERIC', comment });
[
  score('id_grounding', m.id_grounding, m.unknown_ids.length ? `unknown IDs: ${m.unknown_ids.join(', ')}` : 'all IDs exist in project data'),
  score('footer_compliance', m.footer_compliance),
  score('cost_usd', m.cost_usd),
  score('latency_ms', m.latency_ms),
  score('baseline_pass', m.pass === null ? null : (m.pass ? 1 : 0), j.test_id ? `${j.test_id}: ${m.required_passed}/${m.required_total} required checks` : undefined),
  score('check_rate', m.check_rate),
  score('route_correct', m.route_correct === null ? null : (m.route_correct ? 1 : 0), j.expected_route ? `expected ${[].concat(j.expected_route).join('|')}, got ${j.route}` : undefined),
].filter(Boolean).forEach(s => batch.push(s));

return { json: { ...j, langfuse_batch: { batch } } };
