# Evaluation Plan

**Goal:** show, with numbers, that Mira produces grounded plans, risk assessments, status reports and stakeholder updates; that it refuses to invent; and that prompt changes improve it. The plan follows the course lifecycle: *Execute → Evaluate/Optimize → Test → Document*.

**Exit criteria (release gate, PRD §10):**
- ≥ 11/12 baseline tests pass
- 0 fabricated IDs
- 100% count accuracy
- ≥ 95% routing accuracy
- p95 latency < 20 s
- average cost < $0.01

## 1. What is evaluated

| Layer | Question | Metrics ([04-metrics.md](04-metrics.md)) | Method |
|---|---|---|---|
| Routing | Does the right agent answer? | M3, M6, M7 | Route vs expected route per test |
| Grounding | Does it invent anything? | M4, M5, check failures | Automated checks + human spot check |
| Task quality | Does the answer contain what the problem statement requires? | M1, M2 | 164 ground-truth checks |
| Format | Does every answer follow the template and carry the review note? | M8 | Formatter flag |
| Ops | Is it fast and cheap? | M9, M10 | Langfuse timings and usage |
| Robustness | Edge cases, injection, missing data, multi-intent | M1 on E1–E11 | Edge-case dataset |
| Improvement | Did a prompt change help? | M11 | v1 vs v2 on the same dataset |

## 2. Test assets

- **Baseline dataset (T1–T12):** the 12 inputs provided in `eval_mira_inputs.txt`, with expected outputs derived from the CSVs ([03-ground-truth-dataset.md](03-ground-truth-dataset.md)).
- **Edge cases (E1–E11):**
  - a sprint that doesn't exist
  - a task that doesn't exist
  - prompt injection
  - missing data (budget)
  - a single-task lookup
  - a conflicting user goal
  - goodbye
  - a sprint comparison
  - a client-audience email
  - multi-intent
  - a blocked-task lookup
- **Prompt versions:** `v1` naive (no grounding rules, no clarify route) and `v2` production.

## 3. Execution protocol

| Step | Action | Output |
|---|---|---|
| 1 | Import the workflow, set credentials ([06-n8n-workflow.md](06-n8n-workflow.md)); confirm one chat message shows a trace in Langfuse | Smoke test |
| 2 | **Run 1, v2 baseline:** *Run Baseline Tests* in n8n, **or** `python3 eval/run_baseline.py --out results/baseline_v2_run1.jsonl --label "v2 run1"` | 23 traces tagged `prompt:v2` |
| 3 | Score: `python3 eval/score.py results/baseline_v2_run1.jsonl --md results/report_v2_run1.md` | Metrics table + per-test pass/fail |
| 4 | **Human review** of all 23 outputs, using the rubric in §4 (keyword checks can't judge tone or completeness). Record it in `results/human_review.csv`. | Review scores + notes |
| 5 | **Run 2, v1 naive:** set `PROMPT_VERSION = 'v1'`, re-run, score, compare: `python3 eval/score.py results/baseline_v1.jsonl --compare results/baseline_v2_run1.jsonl` | Prompt-experiment table |
| 6 | **Optimize:** for each v2 failure, find the cause in the Langfuse trace (router reason, KB, answer), change one prompt section, re-run only the failing tests (`--only T7,E6`), then re-run everything to catch regressions | Change log (§5) |
| 7 | **Stability:** run v2 three times; report the pass rate per run (LLM output varies even at temperature 0.2) | Mean ± range |
| 8 | Document results in `results/` and update [09-reflection-and-next-steps.md](09-reflection-and-next-steps.md) | Final numbers |

## 4. Human review rubric (1–3 per criterion)

| Criterion | 3 = good | 1 = poor |
|---|---|---|
| Correctness | Every fact matches the data | Any wrong fact |
| Completeness | Covers everything the expected output lists | Misses key items |
| Grounding | Nothing invented; assessments labelled | Invented goals, risks, numbers |
| Usefulness | A PM could send it with minor edits | Needs a rewrite |
| Tone/format | Sharp, structured, right audience | Padded, generic, wrong audience |

A test **passes overall** only if it passes the automated checks **and** scores no 1s in human review.

## 5. Prompt experiments (planned changes and hypotheses)

| # | Change | Hypothesis | Tests most affected | Result |
|---|---|---|---|---|
| X1 | v1 → v2 (whole prompt set) | v1 writes plans from vague inputs, invents risks and percentages, and miscounts | T2, T4, T6, T9, T10, T12 | *fill after run* |
| X2 | Remove "FACTS are authoritative / never recount" from the global prompt | Count accuracy drops on T10 / T5 | T5, T10, E8 | *fill after run* |
| X3 | Remove the Risk evidence table from the Risk KB | Top-3 ranking becomes arbitrary (R01, R02, R03 by register order) | T7, E10 | *fill after run* |
| X4 | Remove "do NOT mention tasks from other sprints" from Stakeholder Update | Sprint 3 tasks leak into the Sprint 2 email | T12, E9 | *fill after run* |
| X5 | Router without the "clarify" route (v1 router with v2 specialists) | Vague requests reach specialists; some are refused there (defense in depth), some produce plans | T2, T4, T6, T9 | *fill after run* |

Run X1 first: it is the required "experiment with prompt modifications". X2–X5 are ablations, each removing one rule to show what that rule buys.

## 6. Results — live runs on n8n Cloud with gpt-4o-mini (2026-11-05)

Three batch runs of the full dataset (23 tests) plus one interactive chat test. Raw outputs, per-test scores and reports are in [`results/`](../results). Pass/fail was computed twice — by the workflow's *Evaluate Output* node and by `eval/score.py` — and the two agreed on every test.

| Metric | Target | v1 naive (exec #10) | v2 (exec #8) | **v3 (exec #9)** |
|---|---|---|---|---|
| Baseline pass rate (T1–T12) | ≥ 11/12 | 7/12 (58%) | 9/12 (75%) | **12/12 (100%)** |
| All-tests pass rate (23) | — | 12/23 (52%) | 15/23 (65%) | **22/23 (96%)** |
| Check-level accuracy | ≥ 95% | 75% | 80% | **96%** |
| Routing accuracy | ≥ 95% | 78% | 74% | **100%** |
| Fabricated IDs | 0 | 0 | 0 | **0** |
| Clarify recall / false-clarify | 100% / ≤ 5% | 0% / 0% | 100% / 38% | **100% / 0%** |
| Avg cost per request | < $0.01 | $0.00067 | $0.00040 | **$0.00062** |
| Latency (single chat request, T8) | < 10 s | — | — | **3.5 s** |

Batch latency (p50 ≈ 20 s) is the wall-clock time for all 23 items moving through the workflow together, not per-request latency; the single chat request above is the representative number.

**Exit criteria (§ top): met by v3, by v4 with the tightened checks (23/23), by v6 across three runs (69/69), and by v7 with 25 tests (75/75)** — 12/12 baseline, 0 fabricated IDs, counts exact (T10), 100% routing, 3.5 s per request, $0.0006 per request.

### What changed between versions (the prompt experiment)

| Version | What it is | What the traces showed |
|---|---|---|
| **v1** naive | One-line role prompts, no clarify route, no grounding rules (same data, same code) | Wrote full plans for "We want to build a chatbot" (T2) and a 2-week project with no details (T9); listed ABCDE risks for "New project starting soon" (T4); answered "Things are going fine" with real ABCDE task IDs (T6); **adopted the user's 30% cost goal** and dropped the real 15%/10% goals (E6); put **owner names in a client email** and leaked other-sprint tasks (E9); dumped task data on "Thanks, that's all" (E7). Code-computed FACTS still kept every ID real (0 fabricated). |
| **v2** production | Guide-style prompts: global rules, scoped boundaries, router with a clarify route | Fixed all of v1's vague-input and grounding failures, but the router **over-clarified**: 6 answerable status questions (T5, T8, E1, E2, E5, E10) got "No task data is available" because the router — which never sees the data — applied the "no task data" rule to any status request. T12's email said "2 tasks completed" without naming T004/T005. |
| **v3** | v2 + two targeted fixes from the traces | Router told explicitly that all data is loaded and visible to specialists; clarify narrowed to *different/unnamed project described by a short phrase* or greetings; 8 routing examples added (including Sprint 11, T099, budget → plan, multi-intent → first intent). Stakeholder Update must list every task by name with ID. Result: routing 74% → 100%, false-clarify 38% → 0%, baseline 9/12 → 12/12. |

| **v4** (2026-11-07) | v3 + Status Reporter fixes found by reading every answer of a chat run, plus per-sprint facts computed in code | Counts always as 5 lines including Blocked and must sum to Total (T10 had dropped Blocked 1 and still said Total 25); sprint reports use only that sprint's computed `Sprint facts` (T5 had given project health, citing Sprint 2/5 tasks, as Sprint 3's); single-task answers lead with ID + name (E5). |

| **v5** (2026-11-07) | v4 + two fixes from reviewing the v4 answers | Sprint reports keep the project milestones (T5 had dropped Phase 2, due 2026-04-26); Stakeholder Update names the data files in Sources (T12/E9 said "Project Knowledge Base"). New checks `milestone` and `sources_files`; v4 re-graded with them: 20/23. |
| **v6** (2026-11-07) | v5 + one Planner rule | Phase column = number **and** name ("1 Project Initiation"); fixes the T1 flake found by the v5 variance runs. |
| **v7** (2026-11-13) | v6 + a fifth specialist | Router gets a `timeline` route; new **Timeline Advisor** answers phase/week/milestone questions from the timeline plus schedule facts computed in code (week 4 of 24, 20 weeks left). T11 moves from Status Reporter to Timeline Advisor; new tests E12, E13. 3 runs × 25 tests: **75/75**. |

**v3 → v4, live chat runs** (each test its own chat message; [results/chat_run_2026-11-07.md](../results/chat_run_2026-11-07.md)):

| Metric | v3 (#23–#45) | v4 prompt only (#46–#68) | **v4 + sprint facts (#69–#91)** |
|---|---|---|---|
| Baseline pass (tightened checks) | 10/12 | 11/12 | **12/12** |
| All 23 | 20/23 | 22/23 | **23/23** |
| Routing / fabricated IDs | 23/23 / 0 | 23/23 / 0 | **23/23 / 0** |
| Avg latency per chat request | — | 4.5 s | **4.2 s** |
| Cost, 23 requests | — | $0.0144 | **$0.0150** |

**v5, three identical runs (run-to-run variance)** — [results/variance_v5.md](../results/variance_v5.md):

| Metric | Run 1 (#92–#114) | Run 2 (#115–#137) | Run 3 (#138–#160) | All 69 |
|---|---|---|---|---|
| Baseline T1–T12 | 11/12 | 12/12 | 12/12 | 35/36 |
| All 23 | 22/23 | 23/23 | 23/23 | **68/69 (98.6%)** |
| Routing / fabricated IDs | 23/23 / 0 | 23/23 / 0 | 23/23 / 0 | **69/69 / 0** |
| Avg latency / cost (23 req) | 4.4 s / $0.0150 | 4.2 s / $0.0151 | 4.5 s / $0.0152 | 4.4 s / $0.0453 |

22 of 23 tests passed in every run, routing never changed, and cost varied by under 2%. The one flaky test is **T1**: in run 1 the plan's phase table had phase numbers but no phase names (check rate 0.47). The Planner prompt asks for a `Phase` column without saying "number and name", so at temperature 0.2 the model occasionally drops the name. One run per prompt change is not enough evidence; three runs exposed it.

**v6, three identical runs** — [results/variance_v6.md](../results/variance_v6.md): one Planner rule ("Phase column = number and name") → **69/69 pass (36/36 baseline), 69/69 routing, 0 fabricated IDs**, T1 named all 8 phases in every run, 3.2 s median / 4.4 s average, $0.0453 for 69 requests. Only optional checks still fail (E3 by decision, E6 30% call-out, E10 multi-intent), identically in every run.

**v7, three identical runs** — [results/variance_v7.md](../results/variance_v7.md): a fifth agent (Timeline Advisor) and two new tests → **75/75 pass (36/36 baseline), 75/75 routing, 0 fabricated IDs, $0.00065 per request**. T11, E12 and E13 routed to the Timeline Advisor with 100% checks in all three runs. Average latency rose to 7.5 s, but every test (including 50-token clarify replies) slowed by a similar factor with unchanged token counts, so the cause is API throughput on the day, not the prompt.

**Lesson: checks that pass can still hide wrong answers.** v3 originally scored 12/12 because two checks were too loose: T10's `blocked1` regex matched "1 blocked task" in the health sentence, and nothing checked T5's sprint scope. Both checks were tightened (`blocked1` must be its own count line or row; new `scope_health`), the real v3 T5 answer was added to the bad fixtures, and v3 re-graded drops to 10/12. Also: the prompt alone fixed T10 and E5 but not T5 — the model kept copying T006 from the project-wide overdue list. Computing the sprint's own facts in code fixed it, the same pattern as the original FACTS design.

Per-test results for all three versions: [`results/prompt_experiment.md`](../results/prompt_experiment.md).

## 7. Known limits of this evaluation

- **Keyword checks are a proxy.** They catch missing facts and invented IDs, but not a wrong claim phrased with correct keywords. Human review (§4) covers that.
- **One project's data.** Results may not generalize to boards with other columns or larger sizes. A second project is a pilot gate (PRD §10).
- **The evidence-based risk ranking is a design choice.** T7 accepts any 3 grounded register risks with a stated reason. R09/R01/R05 are optional checks.
- **Multi-intent (E10)** is a known router limitation, scored only for grounding.
