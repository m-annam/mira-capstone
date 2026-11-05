// ============================================================================
// Mira | Node: "Response Formatter"   (Code node, Run Once for Each Item)
// Receives either a specialist's OpenAI response or the clarify branch, and
// produces one standard result object for every route.
// ============================================================================
const ctx = $('Parse Route').item.json;
const fromLLM = Array.isArray($json.choices);
const AGENTS = { plan: 'Planner Agent', risk: 'Risk Assessor Agent', status: 'Status Reporter Agent',
  update: 'Stakeholder Update Agent', clarify: 'Router (clarifying questions)' };

let output = fromLLM ? String($json.choices[0]?.message?.content || '').trim() : ctx.router_reply;
if (!output) output = 'Mira could not produce an answer. Please rephrase your request.';

// FR-6/FR-7: every specialist answer carries sources + the PM review note.
const SOURCES = { plan: 'project_description.txt, project_timeline.csv', risk: 'project_description.txt, project_risks.csv, sample_task_board.csv (evidence)',
  status: 'sample_task_board.csv, project_timeline.csv', update: 'sample_task_board.csv, project_description.txt' };
let footer_added = false; // true = the agent forgot the footer and the formatter added it (format-compliance metric)
if (fromLLM) {
  if (!/_?Sources:/i.test(output)) { output += `\n\n_Sources: ${SOURCES[ctx.route]}_`; footer_added = true; }
  if (!/Draft for PM review/i.test(output)) { output += `\n_Draft for PM review — verify before sharing._`; footer_added = true; }
}

const usage = fromLLM ? ($json.usage || null) : null;
const { kb, prompts, global_prompt, ...lean } = ctx; // keep the item small after this point
return {
  json: {
    ...lean,
    agent: AGENTS[ctx.route],
    output,
    footer_added,
    specialist_usage: usage,
    specialist_model: fromLLM ? ($json.model || ctx.config.model) : null,
    finished_at: new Date().toISOString(),
  },
};
