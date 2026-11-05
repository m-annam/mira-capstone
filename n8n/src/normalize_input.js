// ============================================================================
// Mira | Node: "Normalize Input"   (Code node, Run Once for Each Item)
// Accepts items from either trigger:
//   - "When chat message received"  -> { sessionId, action, chatInput }
//   - "Baseline Test Cases"         -> { test_id, chatInput, expected_route, checks }
// ============================================================================
const j = $json;
const chatInput = String(j.chatInput ?? j.input ?? '').trim();
return {
  json: {
    chatInput,
    sessionId: j.sessionId || `eval-${j.run_id || 'adhoc'}`,
    mode: j.test_id ? 'eval' : 'chat',
    test_id: j.test_id || null,
    test_type: j.type || null,
    expected_route: j.expected_route || null,
    checks: Array.isArray(j.checks) ? j.checks : [],
    run_id: j.run_id || null,
    started_at: new Date().toISOString(),
  },
};
