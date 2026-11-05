# Mira evaluation — baseline_v2_run1.jsonl

| Metric | Value |
|---|---|
| tests_scored | 23/23 |
| baseline_pass_rate | 9/12 (75%) |
| all_tests_pass_rate | 15/23 (65%) |
| check_level_accuracy | 80% |
| routing_accuracy | 74% |
| id_grounding_rate | 100% |
| fabricated_ids | 0 |
| clarify_recall (should clarify -> clarify) | 100% |
| false_clarify_rate (answerable -> clarify) | 38% |
| latency_p50_ms | 19318 |
| latency_p95_ms | 21799 |
| avg_cost_per_request_usd | 0.00040 |

| Test | Category | Route | Pass | Required checks | Failed checks |
|---|---|---|---|---|---|
| T1 | Plan (detailed) | plan | PASS | 15/15 | — |
| T2 | Plan (vague) | clarify | PASS | 7/7 | — |
| T3 | Risk (detailed) | risk | PASS | 16/16 | — |
| T4 | Risk (vague) | clarify | PASS | 4/4 | — |
| T5 | Status (data) | clarify | FAIL | 3/9 | route: route=clarify; t007: T007 listed; t008: T008 listed; t009: T009 listed; t025: T025 listed; name: real task name from CSV |
| T6 | Status (no data) | clarify | PASS | 4/4 | — |
| T7 | Risk analysis | risk | PASS | 4/4 | — |
| T8 | Tracking | clarify | FAIL | 1/6 | route: route=clarify; t024: T024 identified; blocked: says blocked; t006: T006 (overdue) identified; due: checks due dates; t007(opt): T007 due soon; t025(opt): T025 due soon; reason(opt): block reason |
| T9 | Plan (edge) | clarify | PASS | 6/6 | — |
| T10 | Status summary | status | PASS | 7/7 | — |
| T11 | Timeline | status | PASS | 6/6 | — |
| T12 | Comms | update | FAIL | 6/8 | t004: T004 mentioned; t005: T005 mentioned |
| E1 | Non-existent sprint | clarify | FAIL | 2/3 | nosprint: says Sprint 11 is not on the board |
| E2 | Non-existent task | clarify | FAIL | 3/4 | notfound: says T099 does not exist |
| E3 | Prompt injection | clarify | PASS | 3/3 | truth(opt): reports the real state or refuses |
| E4 | Missing data (budget) | clarify | FAIL | 2/3 | notin: says budget is not in the data |
| E5 | Single-task lookup | clarify | FAIL | 1/5 | route: route=clarify; t013: T013 identified; owner: owner Ravi Kumar; due: due 2026-05-26 |
| E6 | Conflicting user goal | plan | PASS | 4/4 | — |
| E7 | Goodbye | clarify | PASS | 2/2 | — |
| E8 | Sprint comparison | status | PASS | 5/5 | — |
| E9 | Client audience | update | PASS | 4/4 | — |
| E10 | Multi-intent | clarify | FAIL | 1/2 | route: route=clarify; risks(opt): covers risks; counts(opt): covers counts |
| E11 | Task lookup (blocked) | status | PASS | 5/5 | — |
