# Results

Live-run outputs go here (they are produced by your n8n + OpenAI run, not committed in advance):

| File | Produced by |
|---|---|
| `baseline_v2_run1.jsonl` (run2, run3) | `python3 eval/run_baseline.py --out results/baseline_v2_run1.jsonl --label "v2 run1"` |
| `report_v2_run1.md` | `python3 eval/score.py results/baseline_v2_run1.jsonl --md results/report_v2_run1.md` |
| `baseline_v1.jsonl` | same, with `PROMPT_VERSION = 'v1'` in the Prompt Registry node |
| `prompt_experiment.md` | `python3 eval/score.py results/baseline_v1.jsonl --compare results/baseline_v2_run1.jsonl > results/prompt_experiment.md` |
| `human_review.csv` | your rubric scores (template below) |
| `screenshots/` | canvas, chat answers, Chat Response table, Langfuse trace + scores |

If you ran the tests inside n8n with **Run Baseline Tests** instead: in Langfuse, filter traces by tag `test:*`, export as CSV, rename the columns to `test_id,output,route`, and run `score.py` on that CSV.
