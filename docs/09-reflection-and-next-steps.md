# Reflection and Next Steps

## 1. What I built, and what I'd say about it in an interview

Mira is a router plus five specialist agents in n8n. It turns a project's own files into plans, risk assessments, status reports and stakeholder emails. Every answer is grounded, traced in Langfuse and scored against a ground-truth dataset. The main lesson was **deciding what the LLM should not do**. Counting tasks, comparing dates and ranking risks are deterministic, so they live in code. The LLM only writes. That one decision removed the most likely failure (a wrong count reaching a client) before any prompt tuning.

## 2. Findings from building and tracing

**Found before the live run (from the data and the verification runs):**

1. **The problem statement's own numbers are wrong.** It says "3 Done, 3 In Progress, 1 Blocked". The CSV has **5 Done**, 3 In Progress, 1 Blocked and 16 To Do. An agent that trusts the brief over the data fails T10. Ground truth must come from the data, so I wrote `compute_expected.py` to derive every expected value.
2. **"Today" is a product decision.** The board's due dates are April–August 2026. With the real clock, every task is overdue and T8/T11 are meaningless. A fixed `REPORTING_DATE` (2026-04-24) makes answers reproducible. A real product needs a "report as of" date the PM picks.
3. **"Top 3 risks" is ambiguous when the register has no scores.** I made ranking evidence-based (blocked > overdue > due soon, through linked tasks) and show the rule to the user: R09 (T024 blocked), R01 (T006 overdue), R05 (T025 due 04-28). That turns an LLM guess into an explainable, testable answer.
4. **Vague inputs need a stop, not a better prompt.** Putting the clarify decision in the router means T2/T4/T6/T9 never reach a specialist that might "helpfully" write a plan. The specialists still refuse as a second line of defence.
5. **Observability shaped the architecture.** I chose HTTP Request nodes over n8n's AI Agent node because only the raw API response gives token usage per call, which Langfuse needs for cost per trace.
6. **The plumbing was verified for real.** Importing into n8n 1.123 and running all 23 tests against a mock LLM caught harness assumptions early (n8n expressions with mixed text, per-item pairing across the Switch branches) without spending API credits.

**From the live gpt-4o-mini runs** (n8n Cloud executions #8–#11, details in [07-evaluation-plan.md §6](07-evaluation-plan.md)):

| # | Trace finding (test, what happened, root cause) | Fix | Re-test result |
|---|---|---|---|
| 1 | **Router over-clarified** (T5, T8, E1, E2, E5, E10 — v2). Router reason on every one: "No task data is available for this request." Root cause: the router never sees the data (by design), so the rule "status request with no task data → clarify" matched *every* status request, even "using the sample task board data for Sprint 3". | v3 router: states all data is loaded and visible to specialists; clarify only for a *different/unnamed project described by a short phrase* or greetings; 8 routing examples. | Routing 74% → **100%**; false-clarify 38% → **0%**; all 6 tests pass. |
| 2 | **Email summarized by count** (T12 — v2): "2 tasks completed" without naming T004/T005, so a stakeholder can't tell *what* finished. | v3 Stakeholder Update: list every sprint task by name with ID; never counts only. | T12 passes (names + IDs, T006 flagged overdue, no Sprint 3+ tasks). |
| 3 | **Naive prompts are confidently wrong, not fabricating** (v1): 0 invented IDs (code-computed FACTS held), but plans written from one sentence, the user's 30% goal adopted over the real 15%/10%, owner names in a client email. Lesson: grounding data prevents *invented facts*; only prompt boundaries prevent *wrong use* of real facts. | v2/v3 boundaries + clarify route. | v1 52% → v3 96% all-tests pass. |
| 4 | **Single-task lookups don't cite IDs** (E5 — v3): correct owner and date, no "T013". | v4 Status Reporter: single-task answers lead with ID + name. | E5 passes (v4, exec #85). |
| 6 | **Passing checks hid two wrong answers** (2026-11-07 chat run, found by reading every answer): T10 dropped the Blocked count (rows summed to 24, "Total 25"); T5's Sprint 3 report used project health citing Sprint 2/5 tasks and said "Blocked: None" then "Unblock T024". Root cause in the checks: T10's regex matched "1 blocked task" elsewhere in the text; no check on sprint scope. | Tightened `blocked1`, new `scope_health` check, real T5 answer added as a bad fixture; v4 prompt; per-sprint facts computed in code (prompt alone did not fix T5). | v4: 23/23 (execs #69–#91). Lesson for a QA-to-PM move: a green test suite is only as good as its assertions — read the outputs. |
| 7 | **Smaller gaps in the v4 answers**: T5 dropped the project milestone (Phase 2, due 2026-04-26) from the sprint report; T12/E9 cited "Project Knowledge Base" instead of file names. | v5 prompts + checks `milestone`, `sources_files`. | Fixed in 3/3 runs (execs #92–#160). |
| 8 | **Run-to-run variance** (v5 × 3): 68/69. T1 dropped phase names from the plan table in 1 of 3 runs; same prompt passed in 4 other runs. Root cause: "Phase" column not specified as number + name; specialists run at temperature 0.2. | v6 Planner rule "Phase column = number and name"; re-run × 3. | **69/69** (execs #161–#229); T1 named all 8 phases in every run. |
| 5 | **Batch latency ≠ request latency**: batch runs report ~20 s because all 23 items move together; a single chat request took 3.5 s. | Report per-request latency from chat traffic, not batch runs. | Documented in metrics. |

## 3. Two-week improvement plan

| Week | Improvement | Why | Measured by |
|---|---|---|---|
| Done | Fixed E5, T10 and T5 (v4); Langfuse connected, every chat run traced | Close the last failures | v4 23/23 |
| Done | Ran v5 three times: 68/69, routing 69/69, cost ±2% | Prove stability | [variance_v5.md](../results/variance_v5.md) |
| Done | Fixed the T1 phase-name flake (v6): 3 runs at 69/69 | Remove the one unstable test | [variance_v6.md](../results/variance_v6.md) |
| Done | **Timeline Advisor** agent (v7) with schedule facts computed in code; 2 new tests | Schedule questions had no owner (T11 went to Status Reporter) | 75/75 over 3 runs, [variance_v7.md](../results/variance_v7.md) |
| Done | **Weekly status email** every Monday 8:00 PT (scheduled workflow → Mira → Gmail, draft for PM review) | BR-09 proactive reporting | Live; test run #312 delivered the email |
| Done | **Error handler** workflow → Langfuse ERROR trace | Failures were invisible outside n8n | Tested live, trace accepted |
| Done | **Langfuse Prompt Management**: 7 prompts pushed, every generation linked to its prompt version | Per-prompt quality, cost and latency in Langfuse | Execution #250; trace links on #310 |
| 1 | Add a rule check that summary rows add up to the total | Catch arithmetic slips the regexes miss | New fixture fails, live runs pass |
| 1 | Add a "report as of" date input to the chat (default today) instead of the fixed CONFIG date | Real-world use | New tests with 3 different dates |
| 1 | CSV upload in chat (n8n Chat Trigger file upload) with column validation | Use beyond the ABCDE board; BR "malformed CSV gives a clear error" | Tests with a missing-column CSV |
| 2 | **Hierarchical orchestration** for multi-intent requests: the router returns a list of routes, and an aggregator merges the answers | Fixes E10 | E10 must cover both intents |
| 2 | **Milestone Alert System:** extend the Monday weekly email with at-risk milestone alerts to Slack for PM approval | BR-09, proactive warnings | Alerts before the due date in replay tests |
| 2 | **LLM-as-judge** scorer in Langfuse for the human-review rubric (correctness, completeness, tone) on a sample of live traffic | Scales human review | Agreement with human scores ≥ 80% |
| Done | Moved tracing from `/api/public/ingestion` to Langfuse's OpenTelemetry endpoint (scores stay on ingestion) | Langfuse stops accepting traces there on 2026-11-16 | Live run #22: traces ok, 7/7 scores accepted |

## 4. Connection to evaluation and fine-tuning

- The ground-truth dataset is a regression suite. Every prompt change is a run, compared with `score.py --compare`, the same way a QA team compares builds. My QA background is the advantage here: test design, expected results, and failure triage from traces.
- **When fine-tuning would be worth it:** if prompt changes stop moving the scores, for example the Risk Assessor keeps writing generic mitigations. The data would be:
  - the inputs and *PM-corrected* outputs collected through the edit-rate feedback (M13)
  - every failing trace, fixed by hand
  - ~100–200 examples, then a gpt-4o-mini fine-tune
- The same dataset decides whether the tuned model is better. Until the pilot shows a plateau, prompts plus code give more for less. That's the honest TPM call.

## 5. Privacy and security considerations

| Concern | Control |
|---|---|
| Client data sent to an LLM vendor | OpenAI API (API data not used for training by default); security and legal sign-off before the pilot (BRD dependency); an OpenAI project with a spend cap |
| Over-sharing within a prompt | Strict KB scoping per agent: the Planner never sees owners; the Stakeholder Update agent never sees the risk register |
| Data in traces | Langfuse stores inputs and outputs. Use the EU region for a London company; set a retention period (Hobby keeps 30 days); limit project members; consider masking owner names in traces |
| Personal data | Assignee names are personal data (GDPR). Client-audience emails exclude them (E9); production should pseudonymize names in prompts and re-insert them after |
| Prompt injection via user text or task descriptions | The router ignores instructions that try to change its rules (E3); outputs are drafts for PM review, never auto-sent |
| Credential handling | Keys live in n8n credentials, never in the workflow JSON (the export carries placeholders) |

## 6. Rollout plan for 10 PMs/TPMs

| Phase | Who | What | Exit gate |
|---|---|---|---|
| 0. Readiness (week 0) | Mira owner, security | Security sign-off; Langfuse project; 30-min training deck; feedback buttons (thumbs + edit level) | Sign-off received |
| 1. Champions (weeks 1–2) | 3 PMs on ABCDE | Daily use; weekly 20-min feedback call; fix top issues | ≥ 70% outputs sent with minor/no edits; 0 fabricated facts reaching clients |
| 2. Pilot (weeks 3–4) | All 10 PMs, 2+ projects | Office hours twice a week; a Langfuse dashboard shared with the CTO | 8 of 10 PMs weekly active; time per status report < 15 min |
| 3. Decide (week 5) | CTO | Review M1–M14 against BRD targets | Go / adjust / stop |

**Change management:** start with the most painful task (the weekly status report), keep the PM as author ("Draft for PM review"), and share wins in the team channel. Resistance usually comes from fear of an AI mistake under the PM's name, so the review footer and the source citations matter as much as accuracy.

## 7. What I'd do differently

- Write the ground truth before the prompts. Several prompt rules (sprint scoping, the clarify wording) came from asking "how will this test be checked?"
- Decide the reporting date and the risk-ranking rule with stakeholders on day 1. They are product decisions disguised as technical details.
