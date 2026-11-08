// ============================================================================
// Mira | Node: "Chat Response"   (Code node, Run Once for Each Item)
// Last node: the Chat Trigger shows `output` to the user. Test runs also get a
// compact result row (test id, route, pass, cost) for the execution log.
// ============================================================================
const r = $('Build Langfuse Trace').item.json;
const ok = x => !!x && !x.error && !(Array.isArray(x.errors) && x.errors.length) && !(x.partialSuccess && x.partialSuccess.rejectedSpans);
const traces_ok = ok($('Langfuse: Traces (OTel)').item.json);
const scores_ok = ok($json);
return {
  json: {
    output: r.output,
    route: r.route,
    agent: r.agent,
    test_id: r.test_id || 'none (free-form chat)',
    graded: r.test_id ? `graded against ground-truth test ${r.test_id}` : 'not graded: message does not match a ground-truth test input (online metrics still computed)',
    pass: r.metrics.pass,
    route_correct: r.metrics.route_correct,
    check_rate: r.metrics.check_rate,
    failed_checks: (r.check_results || []).filter(c => !c.pass).map(c => `${c.id}${c.required ? '' : ' (optional)'}: ${c.detail || c.label}`),
    id_grounding: r.metrics.id_grounding,
    tokens_in: r.metrics.tokens_in,
    tokens_out: r.metrics.tokens_out,
    cost_usd: r.metrics.cost_usd,
    latency_ms: r.metrics.latency_ms,
    prompt_version: r.prompt_version,
    trace_id: r.trace_id,
    langfuse_logged: traces_ok && scores_ok,
    langfuse_detail: `traces ${traces_ok ? 'ok' : 'FAILED'} (OTel), scores ${scores_ok ? 'ok' : 'FAILED'} (ingestion)`,
  },
};
