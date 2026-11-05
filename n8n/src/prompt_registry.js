// ============================================================================
// Mira | Node: "Prompt Registry"   (Code node, Run Once for Each Item)
// All system prompts live here (copied from /prompts at build time) so they are
// versioned together. Switch PROMPT_VERSION to run the prompt experiment:
//   'v3' = current: v2 + fixes from live run 1 (router over-clarified status
//          questions; Stakeholder Update summarized tasks as counts)
//   'v2' = first production prompts (grounding rules, clarify route, scoped answers)
//   'v1' = naive baseline prompts (no guardrails) for before/after comparison
// ============================================================================
const PROMPT_VERSION = 'v3';
const PROMPTS = __PROMPTS__;

const p = PROMPTS[PROMPT_VERSION];
const fill = s => s.replace(/\{\{REPORTING_DATE\}\}/g, $json.facts.reporting_date);
return {
  json: {
    ...$json,
    prompt_version: PROMPT_VERSION,
    global_prompt: fill(p.global),
    prompts: Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'global').map(([k, v]) => [k, fill(v)])),
  },
};
