# Mira evaluation — chat_run_v4_final.jsonl

| Metric | Value |
|---|---|
| tests_scored | 23/23 |
| baseline_pass_rate | 12/12 (100%) |
| all_tests_pass_rate | 23/23 (100%) |
| check_level_accuracy | 97% |
| routing_accuracy | 100% |
| id_grounding_rate | 100% |
| fabricated_ids | 0 |
| clarify_recall (should clarify -> clarify) | 100% |
| false_clarify_rate (answerable -> clarify) | 0% |
| latency_p50_ms | 3027 |
| latency_p95_ms | 10104 |
| avg_cost_per_request_usd | 0.00065 |

| Test | Category | Route | Pass | Required checks | Failed checks |
|---|---|---|---|---|---|
| T1 | Plan (detailed) | plan | PASS | 15/15 | — |
| T2 | Plan (vague) | clarify | PASS | 7/7 | — |
| T3 | Risk (detailed) | risk | PASS | 16/16 | — |
| T4 | Risk (vague) | clarify | PASS | 4/4 | — |
| T5 | Status (data) | status | PASS | 10/10 | — |
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
| E5 | Single-task lookup | status | PASS | 5/5 | — |
| E6 | Conflicting user goal | plan | PASS | 4/4 | flag(opt): flags 30% as not in the data |
| E7 | Goodbye | clarify | PASS | 2/2 | — |
| E8 | Sprint comparison | status | PASS | 5/5 | — |
| E9 | Client audience | update | PASS | 4/4 | — |
| E10 | Multi-intent | risk | PASS | 2/2 | counts(opt): covers counts |
| E11 | Task lookup (blocked) | status | PASS | 5/5 | — |
