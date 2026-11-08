# Prompt v6 — three identical runs, 2026-11-07

v6 = v5 + one Planner rule: the phase table's Phase column always holds the number **and** the name ("1 Project Initiation"). It targets the only flaky test in the v5 variance runs ([variance_v5.md](variance_v5.md)): T1 dropped the phase names in 1 of 3 runs. Nothing else changed. Same 23 inputs, each sent as its own chat message, three runs in a row; all graded live and traced in Langfuse.

| Run | Executions | Baseline T1–T12 | All 23 | Routing | Fabricated IDs | Mean check rate | Avg latency | p95 latency | Cost (23 req) | Langfuse logged |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | #161–#183 | 12/12 | 23/23 | 23/23 | 0 | 97.0% | 4.7 s | 11.7 s | $0.0152 | 23/23 |
| 2 | #184–#206 | 12/12 | 23/23 | 23/23 | 0 | 97.0% | 4.3 s | 10.9 s | $0.0151 | 23/23 |
| 3 | #207–#229 | 12/12 | 23/23 | 23/23 | 0 | 97.0% | 4.2 s | 9.8 s | $0.0150 | 23/23 |
| **All** | 69 requests | **36/36** | **69/69** | **69/69** | **0** | 97.0% | 4.4 s | 11.5 s | $0.0453 | 69/69 |

## v5 → v6

| Metric (3 runs, 69 requests) | v5 | **v6** |
|---|---|---|
| All tests passed | 68/69 (98.6%) | **69/69 (100%)** |
| Baseline passed | 35/36 | **36/36** |
| T1 phase names in the plan table | 2 of 3 runs | **3 of 3 runs (8/8 phases each)** |
| Routing / fabricated IDs | 69/69 / 0 | 69/69 / 0 |
| Mean check rate | 96.5% | 97.0% |
| Avg latency / total cost | 4.4 s / $0.0453 | 4.4 s / $0.0453 |

## Notes

- Every required check passed in all 69 answers. E6's plan (same Planner) also named all 8 phases in every run.
- The only checks still failing are optional and identical in every run: E3 truth (kept by decision), E6 "flags the 30% goal" (the plan keeps the real 15%/10% goals but does not call out the user's 30%), E10 counts (multi-intent request answered as risks only — needs hierarchical orchestration, see reflection).
- Latency p95 is 10–12 s, driven by the long generations (plans, risk matrices, sprint comparison); the median request is ~3 s.

Raw outputs: `chat_run_v6_run1.jsonl`, `chat_run_v6_run2.jsonl`, `chat_run_v6_run3.jsonl`.
