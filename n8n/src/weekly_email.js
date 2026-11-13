// ============================================================================
// Mira | Workflow "Mira — Weekly Status Email" | Node: "Build Email" (Run Once for Each Item)
// Input: Mira's Chat Response for the scheduled request, plus `html` from the
// Markdown node. Output: subject + HTML body for the Gmail node.
// The report is a DRAFT for the PM: it goes to the PM, never straight to the client.
// ============================================================================
const j = $json;
const today = new Date().toISOString().slice(0, 10);
const health = (String(j.output || '').match(/\b(Green|Amber|Red)\b/) || [])[1];
const subject = `Mira weekly status — ${today}${health ? ` — ${health}` : ''} (draft for PM review)`;
const html = `<div style="font-family:Arial,sans-serif;max-width:760px;color:#14213D">
<p style="color:#4A5568;font-size:13px">Scheduled report from Mira, the project intelligence assistant for the ABCDE Ltd. AI Adoption Project.
It is a draft for PM review: check it before sharing. Status uses the project's reporting date.</p>
${j.html || ''}
<hr style="border:none;border-top:1px solid #ddd;margin-top:24px">
<p style="color:#4A5568;font-size:12px">Route: ${j.route} · agent: ${j.agent} · cost: $${j.cost_usd} · latency: ${j.latency_ms} ms · Langfuse trace: ${j.trace_id} · ${j.langfuse_detail || ''}</p>
</div>`;
return { json: { subject, html, trace_id: j.trace_id } };
