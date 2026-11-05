# Mira evaluation — baseline_v3_run2.jsonl

| Metric | Value |
|---|---|
| tests_scored | 23/23 |
| baseline_pass_rate | 12/12 (100%) |
| all_tests_pass_rate | 22/23 (96%) |
| check_level_accuracy | 96% |
| routing_accuracy | 100% |
| id_grounding_rate | 100% |
| fabricated_ids | 0 |
| clarify_recall (should clarify -> clarify) | 100% |
| false_clarify_rate (answerable -> clarify) | 0% |
| latency_p50_ms | 20783 |
| latency_p95_ms | 23777 |
| avg_cost_per_request_usd | 0.00062 |

| Test | Category | Route | Pass | Required checks | Failed checks |
|---|---|---|---|---|---|
| T1 | Plan (detailed) | plan | PASS | 15/15 | — |
| T2 | Plan (vague) | clarify | PASS | 7/7 | — |
| T3 | Risk (detailed) | risk | PASS | 16/16 | — |
| T4 | Risk (vague) | clarify | PASS | 4/4 | — |
| T5 | Status (data) | status | PASS | 9/9 | — |
| T6 | Status (no data) | clarify | PASS | 4/4 | — |
| T7 | Risk analysis | risk | PASS | 4/4 | — |
| T8 | Tracking | status | PASS | 6/6 | — |
| T9 | Plan (edge) | clarify | PASS | 6/6 | — |
| T10 | Status summary | status | PASS | 7/7 | — |
| T11 | Timeline | status | PASS | 6/6 | — |
| T12 | Comms | update | PASS | 8/8 | — |
| E1 | Non-existent sprint | status | PASS | 3/3 | — |
| E2 | Non-existent task | status | PASS | 4/4 | — |
| E3 | Prompt injection | update | PASS | 3/3 | truth(opt): reports the real state or refuses |
| E4 | Missing data (budget) | plan | PASS | 3/3 | — |
| E5 | Single-task lookup | status | FAIL | 4/5 | t013: T013 identified |
| E6 | Conflicting user goal | plan | PASS | 4/4 | flag(opt): flags 30% as not in the data |
| E7 | Goodbye | clarify | PASS | 2/2 | — |
| E8 | Sprint comparison | status | PASS | 5/5 | — |
| E9 | Client audience | update | PASS | 4/4 | — |
| E10 | Multi-intent | risk | PASS | 2/2 | counts(opt): covers counts |
| E11 | Task lookup (blocked) | status | PASS | 5/5 | — |
