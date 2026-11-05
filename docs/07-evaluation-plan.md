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
| Task quality | Does the answer contain what the problem statement requires? | M1, M2 | 147 ground-truth checks |
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

## 6. Results (filled after the live run)

> The workflow and scoring pipeline were verified end to end in a real n8n instance against a mock LLM ([06-n8n-workflow.md §4](06-n8n-workflow.md)). The numbers below must come from **your** live run with gpt-4o-mini. Until then they stay blank: no fabricated results.

| Metric | Target | v1 naive | v2 run 1 | v2 run 2 | v2 run 3 |
|---|---|---|---|---|---|
| Baseline pass rate (T1–T12) | ≥ 11/12 | | | | |
| All-tests pass rate (23) | — | | | | |
| Check-level accuracy | ≥ 95% | | | | |
| Routing accuracy | ≥ 95% | | | | |
| Fabricated IDs | 0 | | | | |
| Clarify recall / false-clarify | 100% / ≤ 5% | | | | |
| Latency p50 / p95 | < 10 s / < 20 s | | | | |
| Avg cost per request | < $0.01 | | | | |

Per-test outputs: `results/baseline_*.jsonl` · Reports: `results/report_*.md` · Traces: Langfuse, filtered by tag `prompt:v2` and `test:*`.

## 7. Known limits of this evaluation

- **Keyword checks are a proxy.** They catch missing facts and invented IDs, but not a wrong claim phrased with correct keywords. Human review (§4) covers that.
- **One project's data.** Results may not generalize to boards with other columns or larger sizes. A second project is a pilot gate (PRD §10).
- **The evidence-based risk ranking is a design choice.** T7 accepts any 3 grounded register risks with a stated reason. R09/R01/R05 are optional checks.
- **Multi-intent (E10)** is a known router limitation, scored only for grounding.
