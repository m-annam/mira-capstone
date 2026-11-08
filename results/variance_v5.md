# Prompt v5 — three identical runs (run-to-run variance), 2026-11-07

Same workflow, same prompts (v5), same 23 inputs, each sent as its own chat message, three times in a row. gpt-4o-mini (router temperature 0, specialists 0.2). Graded live by the workflow; all 69 requests traced in Langfuse.

v5 = v4 + two fixes asked for after the v4 review: sprint reports keep the project milestones (T5 had dropped Phase 2, due 2026-04-26), and the Stakeholder Update names the data files in Sources (T12/E9 said "Project Knowledge Base"). Both have new checks (`milestone`, `sources_files`); re-graded with them, the v4 final run scores 20/23.

| Run | Executions | Baseline T1–T12 | All 23 | Routing | Fabricated IDs | Mean check rate | Avg latency | p95 latency | Cost (23 req) | Langfuse logged |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | #92–#114 | 11/12 | 22/23 | 23/23 | 0 | 94.6% | 4.4 s | 11.2 s | $0.0150 | 23/23 |
| 2 | #115–#137 | 12/12 | 23/23 | 23/23 | 0 | 97.0% | 4.2 s | 9.7 s | $0.0151 | 23/23 |
| 3 | #138–#160 | 12/12 | 23/23 | 23/23 | 0 | 97.8% | 4.5 s | 10.5 s | $0.0152 | 23/23 |
| **All** | 69 requests | **35/36** | **68/69 (98.6%)** | **69/69** | **0** | 96.5% | 4.4 s | 11.2 s | $0.0453 | 69/69 |

## Per test (P = pass, check rate per run)

| Test | Runs 1/2/3 | Check rate | Route (all runs) | Latency range |
|---|---|---|---|---|
| T1 | FPP | 0.47 / 1.00 / 1.00 | plan | 8.0–10.1 s |
| T2 | PPP | 1.00 / 1.00 / 1.00 | clarify | 1.5–3.1 s |
| T3 | PPP | 1.00 / 1.00 / 1.00 | risk | 11.4–11.9 s |
| T4 | PPP | 1.00 / 1.00 / 1.00 | clarify | 1.7–1.8 s |
| T5 | PPP | 1.00 / 1.00 / 1.00 | status | 6.7–9.7 s |
| T6 | PPP | 1.00 / 1.00 / 1.00 | clarify | 1.5–1.7 s |
| T7 | PPP | 1.00 / 1.00 / 1.00 | risk | 7.9–11.2 s |
| T8 | PPP | 1.00 / 1.00 / 1.00 | status | 5.0–5.4 s |
| T9 | PPP | 1.00 / 1.00 / 1.00 | clarify | 1.6–1.9 s |
| T10 | PPP | 1.00 / 1.00 / 1.00 | status | 2.8–3.5 s |
| T11 | PPP | 1.00 / 1.00 / 1.00 | status | 2.9–3.5 s |
| T12 | PPP | 1.00 / 1.00 / 1.00 | update | 3.7–4.1 s |
| E1 | PPP | 1.00 / 1.00 / 1.00 | status | 1.7–2.9 s |
| E2 | PPP | 1.00 / 1.00 / 1.00 | status | 1.7–2.0 s |
| E3 | PPP | 0.75 / 0.75 / 0.75 | update | 1.5–1.6 s |
| E4 | PPP | 1.00 / 1.00 / 1.00 | plan | 1.8–2.4 s |
| E5 | PPP | 1.00 / 1.00 / 1.00 | status | 2.1–2.2 s |
| E6 | PPP | 0.80 / 0.80 / 1.00 | plan | 8.7–10.5 s |
| E7 | PPP | 1.00 / 1.00 / 1.00 | clarify | 1.2–1.2 s |
| E8 | PPP | 1.00 / 1.00 / 1.00 | status | 6.9–10.3 s |
| E9 | PPP | 1.00 / 1.00 / 1.00 | update | 3.4–4.3 s |
| E10 | PPP | 0.75 / 0.75 / 0.75 | risk | 4.0–5.1 s |
| E11 | PPP | 1.00 / 1.00 / 1.00 | status | 2.6–3.0 s |

## Findings

- **Stable:** 22 of 23 tests passed in all three runs; routing was identical every time (router at temperature 0); no fabricated IDs in 69 answers; cost per run varied by under 2% ($0.0150–$0.0152).
- **Both v5 fixes held 3/3:** T5 lists the Phase 2 milestone (due 2026-04-26) and mentions no other-sprint tasks; T12 and E9 cite `sample_task_board.csv, project_description.txt`.
- **One flaky test — T1 (project plan), run 1:** the phase table held only phase numbers ("1", "2", …) with no phase names, so all 8 phase-name checks failed (check rate 0.47). Runs 2 and 3, and the v4 runs with the identical Planner prompt, named every phase. The Planner prompt asks for a `Phase` column but never says number *and* name, so at temperature 0.2 the model sometimes drops the name. Fix candidate: "Phase column = number and name, e.g. 1 Project Initiation".
- **Optional checks** (not required): E3 (by decision), E10 (multi-intent) fail every run; E6 flags the user's 30% goal in 1 of 3 runs.
- **Latency:** clarify answers ~1.5 s, single-task lookups ~2–3 s, full plans/risk matrices 8–12 s (output length). Short answers are well under the 10 s target; the long generations (T1/E6 plans, T3/T7 risk matrices, E8 sprint comparison) take 8–12 s, so the 10 s target holds for the median but not p95.

Raw outputs: `chat_run_v5_run1.jsonl`, `chat_run_v5_run2.jsonl`, `chat_run_v5_run3.jsonl` (every Chat Response field per test).
