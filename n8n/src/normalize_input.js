// ============================================================================
// Mira | Node: "Normalize Input"   (Code node, Run Once for Each Item)
// Accepts items from either trigger:
//   - "When chat message received"  -> { sessionId, action, chatInput }
//   - "Baseline Test Cases"         -> { test_id, chatInput, expected_route, checks }
// A chat message that matches a ground-truth test input (ignoring case,
// quotes, punctuation and spacing) is graded as that test, so typing a test
// question in the chat also fills test_id / pass / check_rate / failed_checks.
// ============================================================================
const TEST_INDEX = __TEST_INDEX__;
const norm = s => String(s || '').toLowerCase().replace(/[‘’“”"'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const j = $json;
const chatInput = String(j.chatInput ?? j.input ?? '').trim();
const fromRunner = !!j.test_id;
const matched = fromRunner ? null : (TEST_INDEX[norm(chatInput)] || null);
const t = fromRunner ? j : (matched || {});
return {
  json: {
    chatInput,
    sessionId: j.sessionId || `eval-${j.run_id || 'adhoc'}`,
    mode: fromRunner ? 'eval' : (matched ? 'chat-graded' : 'chat'),
    test_id: t.test_id || null,
    test_type: t.type || null,
    expected_route: t.expected_route || null,
    checks: Array.isArray(t.checks) ? t.checks : [],
    run_id: j.run_id || null,
    started_at: new Date().toISOString(),
  },
};
