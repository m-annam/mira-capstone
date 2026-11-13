// ============================================================================
// Mira | Node: "Project Knowledge Base"   (Code node, Run Once for Each Item)
// ----------------------------------------------------------------------------
// 1. Holds the four ABCDE Ltd. project files (embedded at build time).
// 2. Computes deterministic FACTS (counts, overdue, due-soon, health,
//    phase dates, upcoming milestones, risk evidence) so the LLM never counts.
// 3. Builds one SCOPED knowledge base per specialist agent
//    (strict scoping, as in the course's multi-agent solution guide).
// ============================================================================

const CONFIG = {
  REPORTING_DATE: '2026-04-24',      // "today" for every date calculation (Sprint 3)
  PROJECT_WEEK1_START: '2026-03-30', // Monday of timeline week 1 (assumption, see PRD)
  AT_RISK_WINDOW_DAYS: 7,            // not Done and due within N days  => "due soon"
  MILESTONE_WINDOW_DAYS: 14,         // "next 2 weeks"
};

const DESCRIPTION = __DESCRIPTION__;
const TIMELINE_CSV = __TIMELINE_CSV__;
const RISKS_CSV = __RISKS_CSV__;
const TASKS_CSV = __TASKS_CSV__;

// Which task-board signals are evidence for which register risk.
// (PM mapping, documented in docs/02-PRD.md. Used only to RANK risks, never to create them.)
const RISK_TASK_LINKS = {
  R01: ['T006', 'T010', 'T011'], // data quality: gap analysis, demand data extraction, cleaning pipeline
  R02: ['T010', 'T015'],         // legacy integration: ERP extraction, deploy to test env
  R03: ['T020'],                 // skills gap: staff training
  R04: ['T016', 'T020'],         // change resistance: pilot with logistics team, training
  R05: ['T025'],                 // ethical/legal: legal review of data usage
  R06: ['T009'],                 // cost overruns: ML platform vendor evaluation
  R07: ['T008'],                 // unrealistic expectations: success criteria / KPIs
  R08: ['T022'],                 // model drift: continuous monitoring
  R09: ['T024'],                 // security: security review (BLOCKED)
  R10: ['T009'],                 // vendor lock-in: ML platform vendor evaluation
};

// ---------- helpers ----------
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(x => x !== '')) rows.push(row); }
  const [header, ...rest] = rows;
  return rest.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
const toDate = s => new Date(s + 'T00:00:00Z');
const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000); // b - a
const RD = CONFIG.REPORTING_DATE;

// ---------- parse ----------
const tasks = parseCSV(TASKS_CSV);
const phases = parseCSV(TIMELINE_CSV).map(p => {
  const sw = Number(p.start_week), ew = Number(p.end_week);
  return { ...p, phase: Number(p.phase), start_week: sw, end_week: ew,
    start_date: addDays(CONFIG.PROJECT_WEEK1_START, 7 * (sw - 1)),
    end_date: addDays(CONFIG.PROJECT_WEEK1_START, 7 * ew - 1) };
});
const risks = parseCSV(RISKS_CSV);

// ---------- task facts ----------
const STATUSES = ['Done', 'In Progress', 'To Do', 'Blocked'];
const counts = Object.fromEntries(STATUSES.map(s => [s, tasks.filter(t => t.status === s).length]));
counts.Total = tasks.length;

const brief = t => ({ id: t.task_id, name: t.task_name, status: t.status, owner: t.assignee,
  priority: t.priority, sprint: t.sprint, due: t.due_date, description: t.description });
const notDone = t => t.status !== 'Done';
const overdue = tasks.filter(t => notDone(t) && t.due_date < RD).map(brief);
const dueSoon = tasks.filter(t => notDone(t) && t.due_date >= RD && daysBetween(RD, t.due_date) <= CONFIG.AT_RISK_WINDOW_DAYS).map(brief);
const blocked = tasks.filter(t => t.status === 'Blocked').map(brief);

const sprintNames = [...new Set(tasks.map(t => t.sprint))].sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
const bySprint = Object.fromEntries(sprintNames.map(s => {
  const ts = tasks.filter(t => t.sprint === s);
  return [s, { tasks: ts.map(brief), counts: Object.fromEntries(STATUSES.map(st => [st, ts.filter(t => t.status === st).length])) }];
}));

let health = 'Green', healthReason = 'No blocked or overdue tasks.';
if (overdue.length >= 3 || blocked.some(b => daysBetween(RD, b.due) <= CONFIG.AT_RISK_WINDOW_DAYS)) {
  health = 'Red'; healthReason = 'Several overdue tasks, or a blocked task due within 7 days.';
} else if (overdue.length || blocked.length) {
  health = 'Amber';
  healthReason = `${blocked.length} blocked task(s) (${blocked.map(b => b.id).join(', ') || 'none'}) and ${overdue.length} overdue task(s) (${overdue.map(o => o.id).join(', ') || 'none'}).`;
}

// ---------- timeline facts ----------
const currentPhase = phases.find(p => p.start_date <= RD && RD <= p.end_date) || null;
const windowEnd = addDays(RD, CONFIG.MILESTONE_WINDOW_DAYS);
const upcomingMilestones = phases.filter(p => p.end_date >= RD && p.end_date <= windowEnd)
  .map(p => ({ phase: p.phase, phase_name: p.phase_name, due: p.end_date, end_week: p.end_week, milestones: p.milestones_deliverables }));
const nextAfterWindow = phases.filter(p => p.end_date > windowEnd).sort((a, b) => a.end_date < b.end_date ? -1 : 1)[0] || null;
// Schedule position (for the Timeline Advisor): week N of the timeline, weeks left, phases done/ahead.
const TOTAL_WEEKS = Math.max(...phases.map(p => p.end_week));
const currentWeek = Math.floor(daysBetween(CONFIG.PROJECT_WEEK1_START, RD) / 7) + 1;
const weeksRemaining = Math.max(0, TOTAL_WEEKS - currentWeek);
const phasesDone = phases.filter(p => p.end_date < RD).map(p => p.phase);
const phasesAhead = phases.filter(p => p.start_date > RD).map(p => p.phase);
const daysToNextMilestone = upcomingMilestones.length ? daysBetween(RD, upcomingMilestones[0].due) : (nextAfterWindow ? daysBetween(RD, nextAfterWindow.end_date) : null);

// ---------- risk evidence ranking ----------
const taskById = Object.fromEntries(tasks.map(t => [t.task_id, t]));
const signal = t => {
  if (!t) return { score: 0, label: '' };
  if (t.status === 'Blocked') return { score: 4, label: `${t.task_id} BLOCKED` };
  if (notDone(t) && t.due_date < RD) return { score: 3, label: `${t.task_id} OVERDUE (due ${t.due_date}, ${t.status})` };
  if (t.status === 'In Progress' && daysBetween(RD, t.due_date) <= CONFIG.AT_RISK_WINDOW_DAYS) return { score: 2, label: `${t.task_id} in progress, due ${t.due_date}` };
  if (t.status === 'To Do' && daysBetween(RD, t.due_date) <= CONFIG.MILESTONE_WINDOW_DAYS) return { score: 1, label: `${t.task_id} not started, due ${t.due_date}` };
  return { score: 0, label: `${t.task_id} ${t.status}, due ${t.due_date}` };
};
const riskEvidence = risks.map((r, idx) => {
  const sigs = (RISK_TASK_LINKS[r.risk_id] || []).map(id => signal(taskById[id]));
  const top = sigs.reduce((a, b) => (b.score > a.score ? b : a), { score: 0, label: 'no live task signal' });
  return { risk_id: r.risk_id, category: r.category, score: top.score, evidence: top.label, idx };
}).sort((a, b) => b.score - a.score || a.idx - b.idx).map((r, i) => ({ rank: i + 1, ...r }));

// ---------- scoped knowledge bases ----------
const mdTable = (cols, rows) => ['| ' + cols.join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|',
  ...rows.map(r => '| ' + r.map(v => String(v ?? '').replace(/\|/g, '/')).join(' | ') + ' |')].join('\n');
const timelineTable = mdTable(['Phase', 'Name', 'Weeks', 'Dates', 'Key activities', 'Milestones / deliverables'],
  phases.map(p => [p.phase, p.phase_name, `${p.start_week}-${p.end_week}`, `${p.start_date} to ${p.end_date}`, p.key_activities, p.milestones_deliverables]));
const boardTable = mdTable(['ID', 'Task', 'Status', 'Owner', 'Priority', 'Sprint', 'Due', 'Labels', 'Description'],
  tasks.map(t => [t.task_id, t.task_name, t.status, t.assignee, t.priority, t.sprint, t.due_date, t.labels, t.description]));
const list = arr => arr.length ? arr.map(t => `- ${t.id} ${t.name} | ${t.status} | owner ${t.owner} | ${t.sprint} | due ${t.due}`).join('\n') : '- none';

const factsBlock = [
  `FACTS (computed by code for reporting date ${RD}; authoritative, do not recount)`,
  `- Task counts: Done ${counts.Done}, In Progress ${counts['In Progress']}, To Do ${counts['To Do']}, Blocked ${counts.Blocked}, Total ${counts.Total}`,
  `- Overall health: ${health}. Reason: ${healthReason}`,
  `- Current phase: ${currentPhase ? `Phase ${currentPhase.phase} ${currentPhase.phase_name} (weeks ${currentPhase.start_week}-${currentPhase.end_week}, ${currentPhase.start_date} to ${currentPhase.end_date})` : 'outside timeline'}`,
  `- Blocked tasks:\n${list(blocked)}`,
  `- Overdue tasks (not Done, due before ${RD}):\n${list(overdue)}`,
  `- Due soon (not Done, due ${RD} to ${addDays(RD, CONFIG.AT_RISK_WINDOW_DAYS)}):\n${list(dueSoon)}`,
  `- Upcoming milestones (phase-end deliverables due ${RD} to ${windowEnd}):\n` +
    (upcomingMilestones.length ? upcomingMilestones.map(m => `- Phase ${m.phase} ${m.phase_name}: ${m.milestones} (due ${m.due}, end of week ${m.end_week})`).join('\n') : '- none in window'),
  `- Next milestone after the window: ${nextAfterWindow ? `Phase ${nextAfterWindow.phase} ${nextAfterWindow.phase_name}: ${nextAfterWindow.milestones_deliverables} (due ${nextAfterWindow.end_date}, end of week ${nextAfterWindow.end_week})` : 'none'}`,
  `- Sprints on the board: ${sprintNames.join(', ')} (no other sprints exist). Task IDs: T001-T025 only.`,
].join('\n');

const sprintBlock = sprintNames.map(s => {
  const b = bySprint[s];
  // Sprint-scoped facts, so a sprint report never has to borrow the project-wide lists.
  const open = b.tasks.filter(t => t.status !== 'Done');
  const ids = arr => arr.length ? arr.map(t => t.id).join(', ') : 'none';
  const sOverdue = open.filter(t => t.due < RD), sBlocked = open.filter(t => t.status === 'Blocked');
  const sDueSoon = open.filter(t => t.due >= RD && daysBetween(RD, t.due) <= CONFIG.AT_RISK_WINDOW_DAYS);
  const sHealth = sOverdue.length || sBlocked.length ? 'Amber' : 'Green';
  return `### ${s} (Done ${b.counts.Done}, In Progress ${b.counts['In Progress']}, To Do ${b.counts['To Do']}, Blocked ${b.counts.Blocked})\n` +
    `Sprint facts: health ${sHealth} | blocked in this sprint: ${ids(sBlocked)} | overdue in this sprint: ${ids(sOverdue)} | due soon in this sprint: ${ids(sDueSoon)}\n` +
    b.tasks.map(t => `- ${t.id} ${t.name} | ${t.status} | owner ${t.owner} | due ${t.due}${t.status !== 'Done' && t.due < RD ? ' | OVERDUE' : ''}`).join('\n');
}).join('\n\n');

const kb = {
  planner: `## Source: project_description.txt\n${DESCRIPTION}\n\n## Source: project_timeline.csv (dates computed from week 1 = ${CONFIG.PROJECT_WEEK1_START}; 24 weeks total)\n${timelineTable}`,
  risk: `## Source: project_description.txt\n${DESCRIPTION}\n\n## Source: project_risks.csv (risk register)\n` +
    mdTable(['ID', 'Category', 'Risk', 'Impact', 'Mitigation'], risks.map(r => [r.risk_id, r.category, r.risk_challenge, r.impact, r.mitigation_strategy])) +
    `\n\n## Current Evidence (computed from the task board on ${RD}; rank 1 = most urgent)\n` +
    mdTable(['Rank', 'Risk ID', 'Category', 'Live signal'], riskEvidence.map(r => [r.rank, r.risk_id, r.category, r.evidence])) +
    `\nRanking rule: linked task Blocked (4) > Overdue (3) > In Progress and due within 7 days (2) > Not started and due within 14 days (1) > none (0); ties keep register order.`,
  status: `${factsBlock}\n\n## Per-sprint view\n${sprintBlock}\n\n## Source: sample_task_board.csv\n${boardTable}\n\n## Source: project_timeline.csv (phase dates)\n${timelineTable}`,
  timeline: [
    `SCHEDULE FACTS (computed by code for reporting date ${RD}; authoritative, do not recalculate)`,
    `- Timeline: ${TOTAL_WEEKS} weeks, week 1 starts ${CONFIG.PROJECT_WEEK1_START}, ends ${phases.at(-1).end_date}`,
    `- Today is in week ${currentWeek} of ${TOTAL_WEEKS}; ${weeksRemaining} weeks remain after this week`,
    `- Current phase: ${currentPhase ? `Phase ${currentPhase.phase} ${currentPhase.phase_name} (weeks ${currentPhase.start_week}-${currentPhase.end_week}, ${currentPhase.start_date} to ${currentPhase.end_date})` : 'outside timeline'}`,
    `- Phases finished: ${phasesDone.length ? phasesDone.map(n => 'Phase ' + n).join(', ') : 'none'}; phases not started: ${phasesAhead.length ? phasesAhead.map(n => 'Phase ' + n).join(', ') : 'none'}`,
    `- Upcoming milestones (phase-end deliverables due ${RD} to ${windowEnd}):\n` +
      (upcomingMilestones.length ? upcomingMilestones.map(m => `- Phase ${m.phase} ${m.phase_name}: ${m.milestones} (due ${m.due}, end of week ${m.end_week}, in ${daysBetween(RD, m.due)} days)`).join('\n') : '- none in window'),
    `- Next milestone after the window: ${nextAfterWindow ? `Phase ${nextAfterWindow.phase} ${nextAfterWindow.phase_name}: ${nextAfterWindow.milestones_deliverables} (due ${nextAfterWindow.end_date}, end of week ${nextAfterWindow.end_week})` : 'none'}`,
    `- Days to the next milestone: ${daysToNextMilestone ?? 'n/a'}`,
  ].join('\n') + `\n\n## Source: project_timeline.csv (dates computed from week 1 = ${CONFIG.PROJECT_WEEK1_START})\n${timelineTable}`,
  update: `## Project\nAI Adoption Project for ABCDE Ltd. Stated goals: reduce delivery delays by 15%, lower operational costs by 10%, improve service responsiveness.\n\n${factsBlock}\n\n## Per-sprint view (use ONLY the requested sprint)\n${sprintBlock}`,
};

// 32 hex chars: an OpenTelemetry trace id, which Langfuse uses as its trace id.
const rid = () => Array.from({ length: 32 }, () => (Math.random() * 16 | 0).toString(16)).join('');

return {
  json: {
    ...$json,
    trace_id: $json.trace_id || rid(),
    config: { model: 'gpt-4o-mini', temperature: 0.2, router_temperature: 0, max_tokens: 1500,
      price_per_1m_input_usd: 0.15, price_per_1m_output_usd: 0.60,
      langfuse_host: 'https://us.cloud.langfuse.com', ...CONFIG },
    facts: { reporting_date: RD, counts, health, health_reason: healthReason, overdue, due_soon: dueSoon, blocked,
      current_phase: currentPhase && { phase: currentPhase.phase, name: currentPhase.phase_name },
      upcoming_milestones: upcomingMilestones,
      schedule: { current_week: currentWeek, total_weeks: TOTAL_WEEKS, weeks_remaining: weeksRemaining, phases_done: phasesDone, phases_ahead: phasesAhead },
      next_milestone_after_window: nextAfterWindow && { phase: nextAfterWindow.phase, name: nextAfterWindow.phase_name, due: nextAfterWindow.end_date, milestones: nextAfterWindow.milestones_deliverables },
      risk_ranking: riskEvidence.map(r => ({ rank: r.rank, risk_id: r.risk_id, evidence: r.evidence })),
      sprint_counts: Object.fromEntries(sprintNames.map(s => [s, bySprint[s].counts])) },
    data_ids: { tasks: tasks.map(t => t.task_id), risks: risks.map(r => r.risk_id), sprints: sprintNames, phases: phases.length },
    kb,
  },
};
