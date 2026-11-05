# Extracted JSON of the System — n8n Multi-Agent Workflow

**File to import:** [`n8n/mira_workflow.json`](../n8n/mira_workflow.json) (21 nodes: 18 functional + 3 sticky notes)  
**Generated from:** `n8n/src/*.js`, `prompts/`, `data/`, `eval/ground_truth.json` by `python3 tools/build_workflow.py`

## 1. Import into n8n Cloud (≈ 10 minutes)

1. **Workflows → Add workflow → ⋯ → Import from File…** and choose `n8n/mira_workflow.json`.
2. **OpenAI credential:** open any `Agent:` node → *Credential for OpenAI API* → **Create new** → paste your OpenAI API key → save. Select the same credential on all 5 `Agent:` nodes: Router, Planner, Risk Assessor, Status Reporter and Stakeholder Update.
3. **Langfuse credential:**
   - In Langfuse, go to *Settings → API Keys → Create*.
   - In n8n, open **Langfuse: Ingest** → *Credential for Basic Auth* → **Create new**.
   - Set **User** = public key `pk-lf-…` and **Password** = secret key `sk-lf-…`.
4. **Region:** the workflow posts to `https://cloud.langfuse.com` (EU). For a US project, open **Project Knowledge Base** and change `langfuse_host` to `https://us.cloud.langfuse.com`.
5. **Save.** Click **Open chat** (bottom of the canvas) and try: *"Which tasks are blocked or at risk of missing their deadline?"*
6. **Run all tests:** click **Run Baseline Tests** → *Execute workflow*. Results appear in **Chat Response** (one row per test) and in Langfuse as `mira-eval T1 … E11` traces.
7. *(Optional, for `eval/run_baseline.py`)* Open **When chat message received** → turn on **Make Chat Publicly Available** → copy the Chat URL → **Activate** the workflow.

> The JSON carries placeholder credential IDs (`REPLACE_WITH_YOUR_…`). n8n flags those nodes until you pick your own credentials in steps 2–3. That's expected: credentials never travel inside an exported workflow.

## 2. Node-by-node

| # | Node | Type | What it does |
|---|---|---|---|
| 1 | When chat message received | Chat Trigger | Chat UI and webhook; gives `chatInput` and `sessionId` |
| 1b | Run Baseline Tests → Baseline Test Cases | Manual Trigger → Code | Emits the 23 ground-truth tests as items (`RUN = 'all' / 'baseline' / 'edge' / ['T8']`) |
| 2 | Normalize Input | Code | One shape for chat and test items; stamps `started_at` |
| 3 | Project Knowledge Base | Code | Embedded project files → **FACTS** (counts, overdue, due soon, blocked, health, phase dates, upcoming milestones, risk evidence ranking) and one **scoped KB per agent**. `CONFIG` holds the reporting date (2026-04-24), week-1 date, windows, model, prices and Langfuse host. |
| 4 | Prompt Registry | Code | Global + router + 4 specialist prompts, in versions **v2** (production) and **v1** (naive); set `PROMPT_VERSION` |
| 5 | Agent: Router | HTTP → OpenAI | gpt-4o-mini, temperature 0, JSON mode → `{route, reason, reply}` |
| 6 | Parse Route | Code | Validates the route; anything malformed → `clarify` |
| 7 | Route to Specialist | Switch | Outputs: Planner / Risk Assessor / Status Reporter / Stakeholder Update / Clarify |
| 8a–d | Agent: Planner / Risk Assessor / Status Reporter / Stakeholder Update | HTTP → OpenAI | gpt-4o-mini, temperature 0.2; system = global + agent prompt; user = that agent's KB + request |
| 9 | Response Formatter | Code | One result shape for every route; enforces the Sources + "Draft for PM review" footer; drops the bulky KB |
| 10 | Evaluate Output | Code | Online metrics and, for tests, ground-truth checks (same engine as `eval/checks.py`) |
| 11 | Build Langfuse Trace | Code | Trace + router/specialist generations (tokens, cost, timing) + scores |
| 12 | Langfuse: Ingest | HTTP → Langfuse | `POST {host}/api/public/ingestion`, Basic auth, *continue on error* |
| 13 | Chat Response | Code | `output` for the chat, plus route, pass, failed checks, cost, latency, trace id |

**Why HTTP Request nodes instead of the AI Agent node:**
- They return OpenAI's `usage` (token counts) on every call, which Langfuse needs for cost per trace.
- The agents need no tools.
- The full request (model, temperature, messages) is visible in the exported JSON and versioned in git.

Each HTTP node is still one agent, with its own system prompt, scoped knowledge base and boundaries. That follows the solution guide's pattern.

## 3. Request body sent by each agent (from the JSON)

```js
// Agent: Status Reporter  (jsonBody expression)
{ model: $json.config.model, temperature: $json.config.temperature, max_tokens: $json.config.max_tokens,
  messages: [
    { role: 'system', content: $json.global_prompt + '\n\n' + $json.prompts.status },
    { role: 'user',   content: '## Project Knowledge Base (your ONLY source)\n' + $json.kb.status + '\n\n## Request\n' + $json.chatInput } ] }
```

The router adds `response_format: { type: 'json_object' }` and uses `router_temperature` (0).

## 4. How it was verified before handing over

| Check | Result |
|---|---|
| `node tests/run_workflow_offline.js good` executes every Code node and every HTTP body expression in Node.js, following the Switch and connections, with mock OpenAI answers | All 23 tests route correctly and pass; FACTS = 5/3/16/1/25, T006 overdue, T007 and T025 due soon, Amber, Phase 2 due 2026-04-26, top risks R09/R01/R05 |
| `node tests/run_workflow_offline.js bad` with deliberately wrong answers | All 6 bad answers are caught |
| `python3 tests/test_checks.py` | JS and Python check engines agree on all 29 fixture answers; workflow FACTS = independent Python computation |
| **Real n8n 1.123.x**: imported with `n8n import:workflow`, run with `n8n execute` (Run Baseline Tests), OpenAI and Langfuse pointed at a local mock server | Execution status *success*. All 18 functional nodes ran; 23 items reached Chat Response; 23 Langfuse batches posted with Basic auth; OpenAI calls sent `Bearer` auth, model `gpt-4o-mini` and JSON mode for the router |
| Same n8n, workflow activated, `eval/run_baseline.py` against the Chat Trigger webhook | 23/23 responses returned with `output`, `route`, `cost_usd` and `trace_id`; `eval/score.py` produced the report |

The mock run proves the **plumbing**: nodes, expressions, routing, scoring and tracing. It does not prove answer quality. That comes from the live gpt-4o-mini run in the [evaluation plan](07-evaluation-plan.md).

## 5. Changing things safely

- **Prompts:** edit `prompts/v2/*.md` → `python3 tools/build_workflow.py` → re-import. Or edit the *Prompt Registry* node directly in n8n and copy the change back into the repo.
- **Reporting date / windows / model / prices:** the `CONFIG` block at the top of *Project Knowledge Base*.
- **New tests:** add them to `eval/ground_truth.json` → rebuild (they're embedded in *Baseline Test Cases*).
- After any change: `node tests/run_workflow_offline.js && python3 tests/test_checks.py`.

## 6. Screenshots to capture for the submission

1. The canvas (whole workflow, with the sticky notes).
2. The chat panel answering T8 (blocked / at-risk) and T2 (clarify).
3. The *Chat Response* output after **Run Baseline Tests**.
4. A Langfuse trace showing the router and specialist generations with tokens and cost, plus the scores tab.
5. The Langfuse trace list filtered by tag `eval:fail` (or showing that none exist).
