// ============================================================================
// Mira | Workflow "Mira — Error Handler" | Node: "Build Error Trace"
// Runs when any Mira workflow fails (n8n Error Trigger). Sends one ERROR-level
// trace to Langfuse over OpenTelemetry so failures show up next to normal runs.
// ============================================================================
const e = $json.execution || {}, w = $json.workflow || {}, err = e.error || {};
const hex = n => Array.from({ length: n }, () => (Math.random() * 16 | 0).toString(16)).join('');
const now = (BigInt(Date.now()) * 1000000n).toString();
const str = (key, v) => ({ key, value: { stringValue: String(v ?? '') } });
const arr = (key, vs) => ({ key, value: { arrayValue: { values: vs.map(v => ({ stringValue: String(v) })) } } });
const detail = {
  workflow: w.name, workflow_id: w.id, execution_id: e.id, execution_url: e.url,
  failed_node: e.lastNodeExecuted || err.node?.name || '', mode: e.mode, message: err.message, description: err.description || '',
};
const span = {
  traceId: hex(32), spanId: hex(16), name: 'mira-error', kind: 1,
  startTimeUnixNano: now, endTimeUnixNano: now, status: { code: 2, message: String(err.message || 'error') },
  attributes: [
    str('langfuse.trace.name', 'mira-error'),
    arr('langfuse.trace.tags', ['mira', 'error', `workflow:${w.name || 'unknown'}`]),
    str('langfuse.trace.metadata.workflow', w.name),
    str('langfuse.trace.metadata.failed_node', detail.failed_node),
    str('langfuse.observation.type', 'span'),
    str('langfuse.observation.level', 'ERROR'),
    str('langfuse.observation.status_message', err.message),
    str('langfuse.observation.input', JSON.stringify(detail)),
    str('langfuse.observation.output', String(err.stack || err.message || '').slice(0, 4000)),
  ],
};
return [{ json: { ...detail, otel: { resourceSpans: [{ resource: { attributes: [str('service.name', 'mira-n8n')] },
  scopeSpans: [{ scope: { name: 'mira-error-handler' }, spans: [span] }] }] } } }];
