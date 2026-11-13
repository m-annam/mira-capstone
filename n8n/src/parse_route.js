// ============================================================================
// Mira | Node: "Parse Route"   (Code node, Run Once for Each Item)
// Reads the Router agent's JSON answer and guarantees a valid route.
// Any malformed router output falls back to "clarify" (never guess a specialist).
// ============================================================================
const ctx = $('Prompt Registry').item.json;
const raw = $json.choices?.[0]?.message?.content || '';
const DEFAULT_REPLY = "I'm not sure what you need yet. For the ABCDE Ltd. AI Adoption Project I can create a project plan, a risk assessment, a weekly status report, a timeline and milestone answer, or a stakeholder update email. Which would you like?";
let parsed;
try { parsed = JSON.parse(raw); }
catch (e) { parsed = { route: 'clarify', reason: 'Router output was not valid JSON', reply: DEFAULT_REPLY }; }

const ALLOWED = ['plan', 'risk', 'status', 'timeline', 'update', 'clarify'];
let route = String(parsed.route || '').toLowerCase().trim();
if (!ALLOWED.includes(route)) route = 'clarify';
const reply = route === 'clarify' ? (String(parsed.reply || '').trim() || DEFAULT_REPLY) : '';

return {
  json: {
    ...ctx,
    route,
    router_reason: String(parsed.reason || ''),
    router_reply: reply,
    router_usage: $json.usage || null,
    router_model: $json.model || ctx.config.model,
    router_raw: raw,
    router_done_at: new Date().toISOString(),
  },
};
