// ============================================================================
// Mira | Workflow "Mira — Weekly Status Email" | Node: "Weekly Request"
// The question the schedule asks Mira every Monday.
// ============================================================================
const today = new Date().toISOString().slice(0, 10);
return [{ json: {
  chatInput: 'Generate a weekly status report for the whole project: overall health with its reason, task counts, blocked, overdue and due-soon tasks, and milestones due in the next 14 days.',
  sessionId: `weekly-${today}`,
  source: 'weekly-schedule',
} }];
