# Prompt experiment — live gpt-4o-mini runs (n8n Cloud, 2026-11-05)

All three runs used the same workflow, data and 23-test dataset; only `PROMPT_VERSION` in the Prompt Registry node changed. Each run = one click on **Run Baseline Tests** (one n8n execution, 23 items processed as a batch).

| Metric | v1 naive (exec #10) | v2 (exec #8) | v3 (exec #9) |
|---|---|---|---|
| tests_scored | 23/23 | 23/23 | 23/23 |
| baseline_pass_rate | 7/12 (58%) | 9/12 (75%) | 12/12 (100%) |
| all_tests_pass_rate | 12/23 (52%) | 15/23 (65%) | 22/23 (96%) |
| check_level_accuracy | 75% | 80% | 96% |
| routing_accuracy | 78% | 74% | 100% |
| id_grounding_rate | 100% | 100% | 100% |
| fabricated_ids | 0 | 0 | 0 |
| clarify_recall (should clarify -> clarify) | 0% | 100% | 100% |
| false_clarify_rate (answerable -> clarify) | 0% | 38% | 0% |
| latency_p50_ms | 29407 | 19318 | 20783 |
| latency_p95_ms | 34664 | 21799 | 23777 |
| avg_cost_per_request_usd | 0.00067 | 0.00040 | 0.00062 |

| Test | v1 naive (exec #10) | v2 (exec #8) | v3 (exec #9) |
|---|---|---|---|
| T1 | PASS (plan) | PASS (plan) | PASS (plan) |
| T2 | FAIL (plan) | PASS (clarify) | PASS (clarify) |
| T3 | PASS (risk) | PASS (risk) | PASS (risk) |
| T4 | FAIL (risk) | PASS (clarify) | PASS (clarify) |
| T5 | PASS (status) | FAIL (clarify) | PASS (status) |
| T6 | FAIL (status) | PASS (clarify) | PASS (clarify) |
| T7 | PASS (risk) | PASS (risk) | PASS (risk) |
| T8 | FAIL (risk) | FAIL (clarify) | PASS (status) |
| T9 | FAIL (plan) | PASS (clarify) | PASS (clarify) |
| T10 | PASS (status) | PASS (status) | PASS (status) |
| T11 | PASS (status) | PASS (status) | PASS (status) |
| T12 | PASS (update) | FAIL (update) | PASS (update) |
| E1 | FAIL (status) | FAIL (clarify) | PASS (status) |
| E2 | PASS (status) | FAIL (clarify) | PASS (status) |
| E3 | PASS (status) | PASS (clarify) | PASS (update) |
| E4 | FAIL (status) | FAIL (clarify) | PASS (plan) |
| E5 | FAIL (status) | FAIL (clarify) | FAIL (status) |
| E6 | FAIL (plan) | PASS (plan) | PASS (plan) |
| E7 | FAIL (status) | PASS (clarify) | PASS (clarify) |
| E8 | PASS (status) | PASS (status) | PASS (status) |
| E9 | FAIL (update) | PASS (update) | PASS (update) |
| E10 | PASS (risk) | FAIL (clarify) | PASS (risk) |
| E11 | PASS (status) | PASS (status) | PASS (status) |

Latency note: in a batch run all 23 items move through each node together, so `latency_ms` is the batch wall-clock time (~19–24 s), not single-request latency. Single chat requests are measured separately (see docs/07-evaluation-plan.md).
