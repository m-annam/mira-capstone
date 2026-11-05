# Metrics and Their Definitions

Mira is measured at three levels. **Quality** asks whether the answer is right and grounded. **Operational** asks whether it is fast and cheap. **Business** asks whether it saves PM time and gets adopted. Quality and operational metrics are computed automatically for every request (online) or every test run (offline). Business metrics come from the pilot.

Implementation details are in [05-metrics-implementation.md](05-metrics-implementation.md).

## Summary

| # | Metric | Level | When | Target | Source |
|---|---|---|---|---|---|
| M1 | Baseline pass rate | Quality | Test run | ≥ 11/12 (92%) | Ground-truth checks |
| M2 | Check-level accuracy | Quality | Test run | ≥ 95% | Ground-truth checks |
| M3 | Routing accuracy | Quality | Test run | ≥ 95% | Router route vs expected route |
| M4 | ID grounding rate / fabricated IDs | Quality | **Every request** | 100% / 0 | Output IDs vs data |
| M5 | Count accuracy | Quality | Test run (T10, T5) | 100% | Ground-truth checks |
| M6 | Clarify recall | Quality | Test run | 100% | Vague tests routed to clarify |
| M7 | False-clarify rate | Quality | Test run | ≤ 5% | Answerable tests routed to clarify |
| M8 | Format compliance | Quality | **Every request** | ≥ 95% | Formatter `footer_added` flag |
| M9 | Latency (p50 / p95) | Operational | **Every request** | < 10 s / < 20 s | Node timestamps, Langfuse |
| M10 | Tokens and cost per request | Operational | **Every request** | < $0.01 | OpenAI usage × price |
| M11 | Prompt-experiment delta | Quality | v1 vs v2 runs | v2 ≥ v1 on M1–M7 | `score.py --compare` |
| M12 | Time saved per artifact | Business | Pilot | Plan < 45 min, report < 15 min | PM time log |
| M13 | Edit rate (sent with minor/no edits) | Business | Pilot | ≥ 70% | PM feedback per output |
| M14 | Weekly active PMs | Business | Pilot | 8 of 10 | Langfuse sessions / users |

## Definitions

**M1 · Baseline pass rate**: share of baseline tests (T1–T12) where *every required check* passes.
`pass_rate = tests with all required checks passing / tests run`. This is the headline quality number and the release gate (PRD §10). Edge cases are reported separately as "all-tests pass rate".

**M2 · Check-level accuracy**: share of individual checks that pass, required and optional, across all tests.
`check_accuracy = mean over tests of (checks passed / checks in test)`. It is finer-grained than M1: a plan that misses one phase fails M1 but still scores 14/15 on M2. That makes it the better metric for comparing prompt versions.

**M3 · Routing accuracy**: share of tests where the router chose an allowed route.
`routing_accuracy = tests with route ∈ expected_route / tests run`. A wrong route almost always means a wrong answer, so this isolates router errors from specialist errors.

**M4 · ID grounding rate and fabricated IDs**: of all task IDs (T###) and risk IDs (R##) in an answer, the share that exist in the project data. IDs the user typed are excluded, so "T099 doesn't exist" is fine.
`id_grounding = (IDs mentioned − unknown IDs) / IDs mentioned` (1.0 if none mentioned). `fabricated_ids` = the count of unknown IDs across a run. This is the main hallucination metric, and it runs on **every live request**, not only tests.

**M5 · Count accuracy**: whether reported task counts equal the CSV: 5 Done, 3 In Progress, 16 To Do, 1 Blocked, 25 total. It is measured by T10's count checks and T5's sprint scoping. The target is 100%, because a wrong count reaching a stakeholder is the business's top risk.

**M6 · Clarify recall**: of the tests that *should* get clarifying questions (T2, T4, T9, E7), the share routed to clarify.
`clarify_recall = vague tests routed to clarify / vague tests`. This guards BR-06: never generate from nothing. T6 accepts clarify *or* a status refusal, so it is scored by its content checks.

**M7 · False-clarify rate**: of the tests that *can* be answered from the data, the share wrongly sent to clarify. This is the counterweight to M6: a router that clarifies everything would score 100% recall and be useless.

**M8 · Format compliance**: share of specialist answers that included the Sources line and "Draft for PM review" note *without* the formatter adding them.
`format_compliance = 1 − (answers where footer_added = true) / specialist answers`. It measures whether agents follow the output template (BR-04, FR-6).

**M9 · Latency**: wall-clock time from the request entering the workflow to the formatted answer, measured from node timestamps (`started_at` → `finished_at`). p50 and p95 come from Langfuse or `score.py`. Router and specialist latency are visible separately as generations in each trace.

**M10 · Tokens and cost per request**: `cost_usd = (input_tokens × $0.15 + output_tokens × $0.60) / 1,000,000` for gpt-4o-mini, summed over the router and specialist calls. Tokens come from OpenAI's `usage` field on each call. Langfuse also computes cost from model and usage. See [08-cost-strategy.md](08-cost-strategy.md).

**M11 · Prompt-experiment delta**: the difference in M1–M8 between prompt versions run on the same dataset: v1 is the naive prompts, v2 the production prompts. This is how prompt changes are judged: by numbers, not impressions.

**M12 · Time saved per artifact** (pilot): PM-reported minutes to produce a reviewed plan or status report with Mira, against the 3–4 h and 1–2 h baselines.

**M13 · Edit rate** (pilot): share of Mira drafts the PM sent with minor or no edits. It is collected with a thumbs-up/down plus "edits: none / minor / major" on each output, stored as a Langfuse score.

**M14 · Weekly active PMs** (pilot): distinct PMs with ≥ 1 Mira session in a week. It comes from Langfuse sessions; pass a PM id as the session/user id in production.

## Why these metrics

- **Fabrication is the top business risk**, so the hallucination metrics (M4, M5) run on every request, not only in tests.
- **M6 and M7 are a pair.** Optimizing only one would make the router either reckless or useless.
- **Pass rate (M1) is binary per test** and right for a release gate. **Check accuracy (M2)** shows partial progress between prompt versions.
- **Business metrics (M12–M14)** connect the system back to the BRD's objective: 75% less time and 8 of 10 PMs using it weekly.
