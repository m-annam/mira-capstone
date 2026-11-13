# Results — live runs on n8n Cloud (gpt-4o-mini), 2026-11-05

| File | What it is |
|---|---|
| `prompt_experiment.md` | **Start here.** v1 vs v2 vs v3: every metric and every test |
| `baseline_v1_run3.jsonl` | Raw outputs, naive prompts (n8n execution #10) |
| `baseline_v2_run1.jsonl` | Raw outputs, first production prompts (execution #8) |
| `baseline_v3_run2.jsonl` | Raw outputs, current prompts (execution #9) |
| `report_v*_run*.md` | `eval/score.py` report per run (metrics + per-test failed checks) |
| `scored_v*_run*.csv` | Per-test scores per run |
| `chat_run_2026-11-07.md` | **Chat runs (2026-11-07):** every test as its own chat message; v3 → v4 prompt → v4 final (23/23); manual review findings |
| `chat_run_2026-11-07.jsonl`, `chat_run_v4_prompt_only.jsonl`, `chat_run_v4_final.jsonl` | Raw outputs + every Chat Response field for those runs |
| `variance_v7.md` | **Current prompts (v7, with the Timeline Advisor agent) run three times: 75/75** |
| `chat_run_v7_run1..3.jsonl` | Raw outputs + every Chat Response field for the three v7 runs |
| `variance_v6.md` | v6 run three times: 69/69 (23 tests) |
| `chat_run_v6_run1..3.jsonl` | Raw outputs + every Chat Response field for the three v6 runs |
| `variance_v5.md` | v5 run three times: 68/69, per-test stability, latency and cost per run |
| `chat_run_v5_run1..3.jsonl` | Raw outputs + every Chat Response field for the three v5 runs |
| `chat_test_T8.md` | Single interactive chat request (execution #11): latency, tokens, cost, answer |
| `human_review.csv` | Rubric sheet for the human review (docs/07 §4) |

Each `.jsonl` row: test id, input, route, agent, router reason, full output, pass, failed checks, ID grounding, tokens, cost, latency, prompt version, Langfuse trace id, n8n execution id.

Reproduce a score: `python3 eval/score.py results/baseline_v3_run2.jsonl`  
Compare versions: `python3 eval/score.py results/baseline_v1_run3.jsonl --compare results/baseline_v3_run2.jsonl`

Langfuse: the 2026-11-05 batch runs were made before the Langfuse credential was connected. The 2026-11-07 chat runs are all traced in Langfuse (US region, OpenTelemetry ingestion) with 7 scores each.
