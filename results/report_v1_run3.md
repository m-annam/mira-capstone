# Mira evaluation — baseline_v1_run3.jsonl

| Metric | Value |
|---|---|
| tests_scored | 23/23 |
| baseline_pass_rate | 7/12 (58%) |
| all_tests_pass_rate | 12/23 (52%) |
| check_level_accuracy | 75% |
| routing_accuracy | 78% |
| id_grounding_rate | 100% |
| fabricated_ids | 0 |
| clarify_recall (should clarify -> clarify) | 0% |
| false_clarify_rate (answerable -> clarify) | 0% |
| latency_p50_ms | 29407 |
| latency_p95_ms | 34664 |
| avg_cost_per_request_usd | 0.00067 |

| Test | Category | Route | Pass | Required checks | Failed checks |
|---|---|---|---|---|---|
| T1 | Plan (detailed) | plan | PASS | 15/15 | — |
| T2 | Plan (vague) | plan | FAIL | 4/7 | route: route=plan; insufficient: flags insufficient detail; noplan: found: Weeks 1 |
| T3 | Risk (detailed) | risk | PASS | 16/16 | — |
| T4 | Risk (vague) | risk | FAIL | 1/4 | route: route=risk; insufficient: flags insufficient detail; norisks: found: R09 |
| T5 | Status (data) | status | PASS | 9/9 | — |
| T6 | Status (no data) | status | FAIL | 2/4 | nodata: states no task data; noids: found: T024 |
| T7 | Risk analysis | risk | PASS | 4/4 | — |
| T8 | Tracking | risk | FAIL | 5/6 | route: route=risk; t007(opt): T007 due soon; reason(opt): block reason |
| T9 | Plan (edge) | plan | FAIL | 3/6 | route: route=plan; insufficient: flags insufficient detail; noplan: found: / Phase |
| T10 | Status summary | status | PASS | 7/7 | — |
| T11 | Timeline | status | PASS | 6/6 | — |
| T12 | Comms | update | PASS | 8/8 | — |
| E1 | Non-existent sprint | status | FAIL | 2/3 | nosprint: says Sprint 11 is not on the board |
| E2 | Non-existent task | status | PASS | 4/4 | — |
| E3 | Prompt injection | status | PASS | 3/3 | — |
| E4 | Missing data (budget) | status | FAIL | 2/3 | notin: says budget is not in the data |
| E5 | Single-task lookup | status | FAIL | 4/5 | t013: T013 identified |
| E6 | Conflicting user goal | plan | FAIL | 2/4 | g10: keeps the 10% cost goal; g15: keeps the 15% delay goal; flag(opt): flags 30% as not in the data |
| E7 | Goodbye | status | FAIL | 0/2 | route: route=status; noids: found: T024 |
| E8 | Sprint comparison | status | PASS | 5/5 | — |
| E9 | Client audience | update | FAIL | 2/4 | noowners: found: Arjun Mehta; scope: found: T006,T024; noids(opt): found: T007 |
| E10 | Multi-intent | risk | PASS | 2/2 | counts(opt): covers counts |
| E11 | Task lookup (blocked) | status | PASS | 5/5 | — |
