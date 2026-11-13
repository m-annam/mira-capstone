# Prompt v7 — Timeline Advisor agent, three identical runs, 2026-11-13

v7 = v6 + a fifth specialist. The router gets a `timeline` route (phases, weeks, milestone dates), and a new **Timeline Advisor** agent answers it from `project_timeline.csv` plus **schedule facts computed in code** (current week 4 of 24, 20 weeks left, phases done/ahead, days to the next milestone). Before v7, T11 ("milestones in the next 2 weeks") went to the Status Reporter. The dataset grew from 23 to **25 tests** (E12 "which phase are we in / weeks left", E13 "Phase 5 dates and deliverables") and **164 checks**; T11 now expects route `timeline`. Same method as v6: every input sent as its own chat message, three runs in a row, graded live and traced in Langfuse.

| Run | Executions | Baseline T1–T12 | All 25 | Routing | Fabricated IDs | Mean check rate | Avg latency | p95 latency | Cost (25 req) | Langfuse logged |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | #234–#259 | 12/12 | 25/25 | 25/25 | 0 | 97.2% | 8.7 s | 19.6 s | $0.0162 | 25/25 |
| 2 | #260–#284 | 12/12 | 25/25 | 25/25 | 0 | 97.2% | 7.2 s | 14.4 s | $0.0165 | 25/25 |
| 3 | #285–#309 | 12/12 | 25/25 | 25/25 | 0 | 97.2% | 6.5 s | 13.8 s | $0.0164 | 25/25 |
| **All** | 75 requests | **36/36** | **75/75** | **75/75** | **0** | 97.2% | 7.5 s (median 4.9 s) | 20.8 s | $0.0491 | 75/75 |

## v6 → v7

| Metric (3 runs) | v6 (23 tests) | **v7 (25 tests)** |
|---|---|---|
| All tests passed | 69/69 | **75/75** |
| Timeline questions (T11, E12, E13) | T11 via Status Reporter | **9/9 via Timeline Advisor, 100% checks** |
| Routing / fabricated IDs | 69/69 / 0 | 75/75 / 0 |
| Mean check rate | 97.0% | 97.2% |
| Cost per request | $0.00066 | $0.00065 |
| Avg latency | 4.4 s | 7.5 s (see note) |

## Notes

- **Latency.** Every test was slower in this run, including one-line clarify replies with the same ~50 output tokens (E1 1.8 s → 2.7 s, T2 1.9 s → 2.1 s), while tokens in/out were unchanged. The slowdown is API/platform throughput on the day, not the v7 prompt. Watch it on the next run; the cost did not change.
- The only failing checks are the same optional ones as v6, in every run: E3 truth (kept by decision), E6 "flags the 30% goal", E10 counts (multi-intent request answered as risks only).
- Every generation in these traces carries `prompt_version: v7`. From execution #310 on, the router and specialist generations are also **linked to Langfuse Prompt Management** (`mira-router`, `mira-timeline`, … version 1), so Langfuse shows per-prompt metrics.

Raw outputs: `chat_run_v7_run1.jsonl`, `chat_run_v7_run2.jsonl`, `chat_run_v7_run3.jsonl`.
