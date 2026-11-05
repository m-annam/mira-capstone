// ============================================================================
// Mira | Node: "Baseline Test Cases"   (Code node, Run Once for All Items)
// Emits the ground-truth dataset (eval/ground_truth.json, embedded at build
// time) as items, so one click on "Run Baseline Tests" sends every test through
// the same pipeline the chat uses. Results + scores land in Langfuse.
//   RUN = 'all' | 'baseline' | 'edge' | ['T1','T8']
// ============================================================================
const RUN = 'all';
const TESTS = __TEST_CASES__;
const run_id = 'run-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const pick = TESTS.filter(t => RUN === 'all' || (RUN === 'baseline' && t.type === 'baseline') ||
  (RUN === 'edge' && t.type === 'edge') || (Array.isArray(RUN) && RUN.includes(t.test_id)));
return pick.map(t => ({ json: { ...t, chatInput: t.input, run_id } }));
