# Metrics Implementation

The metrics in [04-metrics.md](04-metrics.md) are implemented in three places that share **one check engine**:

| Where | What it does | Files |
|---|---|---|
| **In the n8n workflow** | Scores every request (online metrics). In test runs it also scores the ground-truth checks, and sends everything to Langfuse as scores. | `Evaluate Output`, `Build Langfuse Trace` nodes (`n8n/src/evaluate_output.js`, `n8n/src/eval_checks.js`, `n8n/src/build_langfuse_batch.js`) |
| **Offline scoring scripts** | Run the dataset against the live workflow, score the results, and compare prompt versions | `eval/run_baseline.py`, `eval/score.py`, `eval/checks.py`, `eval/compute_expected.py` |
| **Langfuse** | Dashboards, trace drill-down, filtering by tag (route, prompt version, test id, pass/fail) | Langfuse project (setup below) |

## 1. Check engine (JS ⇄ Python parity)

`n8n/src/eval_checks.js` (runs inside n8n) and `eval/checks.py` (runs locally) implement the same 7 check types (regex, not_regex, route, ids_grounded, forbid_ids, percents_allowed, min_distinct). `tests/test_checks.py` runs both engines on 29 fixture answers and fails if any single check result differs:

```
$ node tests/run_workflow_offline.js && python3 tests/test_checks.py
29 fixture outputs compared across JS/Python engines; facts compared: True
ALL TESTS PASSED
```

## 2. Online metrics in n8n (every request)

`Evaluate Output` adds a `metrics` object to every item:

```js
metrics: {
  id_grounding,        // M4: share of T###/R## in the answer that exist in the data (user-typed IDs exempt)
  unknown_ids,         // M4: the fabricated IDs, if any
  footer_compliance,   // M8: 1 if the agent wrote Sources + review note itself, 0 if the formatter had to add it
  tokens_in, tokens_out, cost_usd,   // M10: from OpenAI usage on router + specialist calls
  latency_ms,          // M9: started_at -> finished_at
  route_correct, pass, required_passed, required_total, check_rate   // M1-M3 (test runs only)
}
```

`Build Langfuse Trace` turns each request into one Langfuse trace (sent over OpenTelemetry) plus a set of scores:

| Langfuse object | Name | Contents |
|---|---|---|
| Trace | `mira-request` or `mira-eval T8` | input, output, session, tags `route:status`, `prompt:v2`, `test:T8`, `eval:pass`/`eval:fail`; metadata with router reason, reporting date, check results |
| Generation | `agent:router` | model, start/end time, token usage and cost, route + reason |
| Generation | `agent:status` (or plan/risk/update) | model, start/end time, token usage and cost, answer |
| Scores | `id_grounding`, `footer_compliance`, `cost_usd`, `latency_ms` | every request |
| Scores | `baseline_pass`, `check_rate`, `route_correct` | test runs only |

Two HTTP nodes send it, both with Basic auth (public key / secret key):

| Node | Endpoint | Body |
|---|---|---|
| **Langfuse: Traces (OTel)** | `POST {langfuse_host}/api/public/otel/v1/traces`, header `x-langfuse-ingestion-version: 4` | OTLP/HTTP JSON: a root span `mira-request` (observation type `agent`) and one `generation` span per OpenAI call. Trace name, session, tags, version and metadata are set as `langfuse.trace.*` attributes on every span; tokens and cost as `langfuse.observation.usage_details` / `cost_details`. Trace id = 32 hex chars, span ids = 16. |
| **Langfuse: Scores** | `POST {langfuse_host}/api/public/ingestion` | `score-create` events only, on the same trace id |

Why two endpoints: Langfuse Cloud stops accepting traces and generations on the legacy `/api/public/ingestion` batch endpoint on **2026-11-16**; score-create events stay supported there. The workflow was migrated before the cutover (live run #22: traces accepted, 7/7 scores accepted).

Both nodes read their data from *Build Langfuse Trace* by name (`$('Build Langfuse Trace').item.json`), because the Scores node's own input is the OTel response. Both are set to *continue on error*, so a tracing outage never blocks an answer. `Chat Response` reports `langfuse_logged: true/false` and `langfuse_detail` (e.g. `traces ok (OTel), scores ok (ingestion)`) so you can see which call failed.

## 3. Running the evaluation

**Option A — inside n8n (one click).** Open the workflow → click **Run Baseline Tests** → *Execute workflow*. The *Baseline Test Cases* node emits all 23 tests (set `RUN = 'baseline'`, `'edge'` or `['T1','T8']` to narrow). Each test runs through the real pipeline. The *Chat Response* node lists one row per test with `pass`, `failed_checks`, `cost_usd` and `trace_id`, and Langfuse gets a `mira-eval Tn` trace with scores.

**Option B — from your laptop (repeatable, produces a report file).**

```bash
# in n8n: open "When chat message received" → enable "Make Chat Publicly Available" → copy the Chat URL
export N8N_CHAT_URL="https://<your-instance>.app.n8n.cloud/webhook/<id>/chat"
python3 eval/run_baseline.py --out results/baseline_v2.jsonl --label "prompt v2"
python3 eval/score.py results/baseline_v2.jsonl --md results/report_v2.md --csv results/scored_v2.csv
```

**Option C — outputs pasted by hand.** Put `test_id,output,route` in a CSV and run `python3 eval/score.py my_outputs.csv`. Use this for screenshots or chat-panel runs.

**Prompt experiment (M11).** Set `PROMPT_VERSION = 'v1'` in the *Prompt Registry* node, run again to `results/baseline_v1.jsonl`, then:

```bash
python3 eval/score.py results/baseline_v1.jsonl --compare results/baseline_v2.jsonl
```

This prints a side-by-side table of every metric and every test (example output below, from mock data).

## 4. Example report (mock data, shows the format)

This report was produced from the offline fixtures, where 6 deliberately bad answers are mixed in. It shows how failures surface; it is **not** a live result.

```
| baseline_pass_rate | 6/12 (50%) |      | T10 | Status summary | status | FAIL | 5/7 | done5: Done = 5; todo16: To Do = 16 |
| routing_accuracy   | 96%        |      | T12 | Comms          | update | FAIL | 6/8 | nosprint3: found: T007; nonames: found: Shortlist AI use cases |
| fabricated_ids     | 1          |      | T7  | Risk analysis  | risk   | FAIL | 2/4 | grounded: unknown: R11 |
```

## 5. Langfuse setup and dashboard

1. Create a project at cloud.langfuse.com (EU) or us.cloud.langfuse.com (US) → *Settings → API Keys* → create a key pair.
2. In n8n create a **Basic Auth** credential: user = public key (`pk-lf-…`), password = secret key (`sk-lf-…`). Select it on both **Langfuse: Traces (OTel)** and **Langfuse: Scores**.
3. Region: `langfuse_host` in the *Project Knowledge Base* node config is `https://us.cloud.langfuse.com` (this project). EU projects use `https://cloud.langfuse.com`. A wrong host returns 401 "Invalid credentials. Confirm that you've configured the correct host."
4. Chat messages that match a ground-truth test input (case, quotes and punctuation ignored) are graded as that test, so their `test_id`, `pass`, `check_rate` and `failed_checks` are filled; other chat messages show `graded: not graded` but still get the online metrics.
5. Tracing already uses the OpenTelemetry endpoint, so Langfuse's 2026-11-16 deprecation of trace ingestion on `/api/public/ingestion` does not affect this workflow.
6. Suggested dashboard widgets:
   - average `baseline_pass` by tag `prompt:v1` vs `prompt:v2`
   - average `id_grounding` (should stay 1.0)
   - p95 latency
   - total cost
   - trace count by `route:*` tag

Filter traces by `eval:fail` to jump straight to failing tests.
