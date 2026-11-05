// ============================================================================
// Mira | Node: "Evaluate Output"   (Code node, Run Once for Each Item)
// Metrics implementation inside the workflow (see docs/04-metrics.md):
//   ONLINE (every request): id_grounding, unknown_ids, footer_compliance,
//                           tokens, cost_usd, latency_ms
//   OFFLINE (baseline / edge-case runs): ground-truth checks -> pass,
//                           check_rate, route_correct
// Results are sent to Langfuse as scores by the next node.
// ============================================================================
/*__CHECK_ENGINE__*/

const j = $json;
const ev = runChecks(j.output, j.route, j.chatInput, j.checks, j.data_ids);

const u1 = j.router_usage || {}, u2 = j.specialist_usage || {};
const tokens_in = (u1.prompt_tokens || 0) + (u2.prompt_tokens || 0);
const tokens_out = (u1.completion_tokens || 0) + (u2.completion_tokens || 0);
const cost_usd = (tokens_in * j.config.price_per_1m_input_usd + tokens_out * j.config.price_per_1m_output_usd) / 1e6;
const latency_ms = new Date(j.finished_at) - new Date(j.started_at);

const route_correct = j.expected_route ? [].concat(j.expected_route).includes(j.route) : null;

return {
  json: {
    ...j,
    metrics: {
      id_grounding: ev.id_grounding,
      unknown_ids: ev.unknown_ids,
      footer_compliance: j.route === 'clarify' ? null : (j.footer_added ? 0 : 1),
      tokens_in, tokens_out, cost_usd: Number(cost_usd.toFixed(6)), latency_ms,
      route_correct,
      pass: ev.pass,
      required_passed: ev.required_passed,
      required_total: ev.required_total,
      check_rate: ev.check_rate,
    },
    check_results: ev.results,
  },
};
