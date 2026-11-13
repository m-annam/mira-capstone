# Mira — AI-Powered Project Intelligence Assistant

**Interview Kickstart · Applied Agentic AI for PMs/TPMs · Capstone project**  
Author: Mallika Annam · Stack: **n8n Cloud** (multi-agent workflow) · **OpenAI gpt-4o-mini** · **Langfuse** (tracing and evaluation)

Mira helps Nexora's PMs/TPMs run the ABCDE Ltd. AI Adoption Project. From the project's own files (description, timeline, risk register and task board) it generates:

- **project plans**
- **risk assessments**
- **weekly status reports**
- **timeline and milestone answers**
- **stakeholder update emails**

It also emails the PM a **weekly status report every Monday** (draft for review), logs **workflow failures to Langfuse**, and keeps its **prompts versioned in Langfuse Prompt Management**.

Vague requests get clarifying questions instead of invented answers. Every request is traced and scored in Langfuse.

## Try Mira live

**[Open the Mira chat](https://mallika-n8n.app.n8n.cloud/webhook/e72b2f7c-1965-53a6-b80d-582a2107edb4/chat)** (no login needed)

Try these, or any question about the project:

- `Generate a project plan for the AI Adoption Project at ABCDE Ltd.`
- `Which tasks are blocked or at risk of missing their deadline based on the task board?`
- `What are the top 3 risks for the ABCDE Ltd project based on the risk data?`
- `Generate a stakeholder update email summarizing Sprint 2 progress.`
- `Which phase is the project in right now, and how many weeks of the timeline are left?`
- `Generate a weekly status report for: "Things are going fine."` (shows how Mira handles vague input)

Status answers use the reporting date 2026-04-24, because the sample task board's dates run April–August 2026. Every answer is a draft for PM review. A message that matches a ground-truth test is graded live (pass, check rate, failed checks), and every request is traced in Langfuse.

![Mira answering in the public chat](screenshots/07-public-live-demo-chat.jpg)

```mermaid
flowchart LR
  Q[PM request] --> KB[Knowledge Base + FACTS<br/>computed in code]
  KB --> R{{Router agent}}
  R -->|plan| P[Planner]
  R -->|risk| K[Risk Assessor]
  R -->|status| S[Status Reporter]
  R -->|timeline| T[Timeline Advisor]
  R -->|update| U[Stakeholder Update]
  R -->|vague| C[Clarifying questions]
  P & K & S & T & U & C --> F[Formatter] --> E[Metrics] --> L[(Langfuse)]
  W[Monday 8:00 schedule] -.->|weekly report request| Q
  F -.->|weekly report| G[Gmail to PM]
  X[Any workflow failure] -.-> EH[Error handler] -.-> L
```

## Deliverables

| # | Deliverable | Where |
|---|---|---|
| 1 | BRD | [docs/01-BRD.md](docs/01-BRD.md) |
| 2 | PRD | [docs/02-PRD.md](docs/02-PRD.md) |
| 3 | Ground truth dataset | [docs/03-ground-truth-dataset.md](docs/03-ground-truth-dataset.md) · [eval/ground_truth.json](eval/ground_truth.json) · [eval/ground_truth.csv](eval/ground_truth.csv) |
| 4 | Metrics and their definitions | [docs/04-metrics.md](docs/04-metrics.md) |
| 5 | Metrics implementation | [docs/05-metrics-implementation.md](docs/05-metrics-implementation.md) · [eval/](eval/) · `Evaluate Output` / `Build Langfuse Trace` nodes |
| 6 | Extracted JSON of the system | [n8n/mira_workflow.json](n8n/mira_workflow.json) · [docs/06-n8n-workflow.md](docs/06-n8n-workflow.md) |
| 7 | Evaluation plan | [docs/07-evaluation-plan.md](docs/07-evaluation-plan.md) |
| 8 | Cost strategy | [docs/08-cost-strategy.md](docs/08-cost-strategy.md) |
| 9 | Reflection and next steps | [docs/09-reflection-and-next-steps.md](docs/09-reflection-and-next-steps.md) |
| 10 | README | this file |
| 11 | Slide deck (capstone presentation) | Claude Slides deck *Mira — Capstone Deck* (shared separately; exportable to PDF/PPTX) |

**Problem-statement assignments (Q1–Q4) and submission items**

| Item | Where |
|---|---|
| Q1 Ideation: 3 use cases with pain point, solution, inputs/outputs, metrics, knowledge base | [docs/00-ideation.md](docs/00-ideation.md) |
| Q2 Build write-up (1–2 pages): architecture, orchestration, tools, capabilities, cost per plan, metrics | [docs/11-q2-build-writeup.md](docs/11-q2-build-writeup.md) |
| Q3 Program charter: vision, scope, success criteria, timeline, risks, stakeholders, decision-making, rollout | [docs/10-program-charter.md](docs/10-program-charter.md) |
| Q4 Reflection (1 page) | [docs/12-q4-reflection.md](docs/12-q4-reflection.md) · full version [docs/09](docs/09-reflection-and-next-steps.md) |
| Architecture diagram | Above, and [PRD §4](docs/02-PRD.md) |
| Baseline test results (all 12 inputs + 13 edge cases) | [results/variance_v7.md](results/variance_v7.md) (current, 75/75 over 3 runs) · [results/](results/) |
| Screenshots | [Below](#screenshots) |
| Live demo | [Try Mira live](#try-mira-live) |
| PDFs for upload (Q1–Q4, BRD, PRD) | [submission/](submission/) |

## Quick start

1. **Import** `n8n/mira_workflow.json` into n8n Cloud (*Workflows → Import from File*). Optional companions: `n8n/mira_weekly_status_email.json` (Monday report by Gmail), `n8n/mira_error_handler.json` (failures → Langfuse; set it as the main workflow's *Error workflow*), `n8n/mira_prompt_sync.json` (pushes the current prompts to Langfuse Prompt Management).
2. **Credentials:**
   - OpenAI API key on the 6 `Agent:` nodes.
   - Basic Auth (Langfuse public key / secret key) on `Langfuse: Traces (OTel)` and `Langfuse: Scores`.
   - The host is US (`us.cloud.langfuse.com`); for an EU project, change `langfuse_host` in *Project Knowledge Base*.
3. **Chat:** *Open chat* → "Which tasks are blocked or at risk of missing their deadline?"
4. **Evaluate:** click **Run Baseline Tests** → *Execute workflow*. That runs all 25 tests; results go to *Chat Response* and Langfuse. Or, from a terminal:
   ```bash
   export N8N_CHAT_URL="https://<you>.app.n8n.cloud/webhook/<id>/chat"   # Chat Trigger → Make Chat Publicly Available
   python3 eval/run_baseline.py --out results/baseline_v2.jsonl
   python3 eval/score.py results/baseline_v2.jsonl --md results/report_v2.md
   ```
5. **Prompt experiment:** set `PROMPT_VERSION = 'v1'` (or any of `'v2'`–`'v6'`) in *Prompt Registry*, re-run, then `python3 eval/score.py results/baseline_v1_run3.jsonl --compare results/baseline_v3_run2.jsonl`.

Full setup: [docs/06-n8n-workflow.md](docs/06-n8n-workflow.md).

## How it maps to the course

| Concept | Mandatory? | How Mira applies it |
|---|---|---|
| Multi-agent system design | Mandatory | Router + Planner, Risk Assessor, Status Reporter, Timeline Advisor, Stakeholder Update, each with a strictly scoped knowledge base ([PRD §4.1](docs/02-PRD.md)) |
| Orchestration pattern | Mandatory | **Router / Dispatcher**, justified in [PRD §4](docs/02-PRD.md); hierarchical is the next step for multi-intent requests |
| Prompt engineering | Mandatory | Guide-style prompts (Global Context/Rules → Your Data → How to Answer → Boundaries) in [prompts/v7](prompts/v7), also versioned in **Langfuse Prompt Management** (`mira-*`, labels `production`/`v7`; every generation is linked to its prompt); earlier versions down to the naive [v1](prompts/v1) kept — live experiment v1 52% → v2 65% → v3 96% → v5 98.6% → v6 100% → v7 100% with a 5th agent (3 runs each) |
| Data grounding | Mandatory | KB built only from the 4 files; counts, dates and risk ranking computed in code; every T###/R## checked against the data on every request |
| Evaluation and observability | Mandatory | Langfuse traces (router + specialist generations, tokens, cost, latency) and scores; 25-test dataset with 164 checks; failures traced by an error-handler workflow |
| Human-in-the-loop | Extended | Every answer is a "Draft for PM review"; the only automatic message is the Monday report to the PM herself, labelled "draft for PM review" |
| Proactive agent | Extended | Scheduled workflow asks Mira for the weekly status every Monday 8:00 PT and emails it to the PM |
| Extended capability | ≥ 1 required | **Stakeholder Update Generator** (leadership / engineering / client) |
| Fine-tuning | Extended | Plan in [reflection §4](docs/09-reflection-and-next-steps.md) |

## Lifecycle

**Review** (problem statements, chose Mira) → **Select** (Mira: TPM-core, data provided, no OAuth) → **Plan** (BRD) → **Design** (PRD, agents, KB scoping) → **Build** (n8n workflow generated from versioned sources) → **Execute** (chat and one-click test run) → **Evaluate/Optimize** (scores in Langfuse, `score.py`, prompt experiments) → **Test** (baseline + 11 edge cases) → **Document** (this repo) → **Submit**.

## Repository layout

```
data/                 source files from the problem statement (description, timeline, risks, task board, eval inputs)
prompts/v7 … v1      system prompts (v7 current, v2 first production, v1 naive baseline)
n8n/mira_workflow.json  the importable workflow (generated)
n8n/mira_weekly_status_email.json, mira_error_handler.json, mira_prompt_sync.json  companion workflows (generated)
n8n/src/*.js          Code-node sources (knowledge base + FACTS, router parsing, formatter, metrics, Langfuse trace)
tools/build_workflow.py  rebuilds the workflow JSON from data + prompts + src + ground truth
eval/                 ground truth, check engine, run_baseline.py, score.py, compute_expected.py
tests/                offline harness (runs the workflow logic in Node), JS/Python parity tests, fixtures
docs/                 deliverables 1–9, plus Q1 ideation (00), program charter (10), Q2 write-up (11), Q4 one-page reflection (12)
screenshots/          n8n canvas, Mira chat, Langfuse dashboard and traces
results/              live run outputs (jsonl), scored CSVs, reports, prompt experiment
```

## Verification status

- ✅ Workflow logic: `node tests/run_workflow_offline.js` (25/25 routed and scored; FACTS correct) and `node tests/run_workflow_offline.js bad` (all 7 bad answers caught)
- ✅ Check engines: `python3 tests/test_checks.py` (JS ⇄ Python parity on 29 fixture answers; FACTS = independent Python computation)
- ✅ Real n8n 1.123: imported and executed end to end against mock OpenAI/Langfuse; chat webhook + `run_baseline.py` + `score.py` loop works
- ✅ **Live on n8n Cloud with gpt-4o-mini:** prompt v7 (5 specialists), run three times (75 chat requests): **75/75 pass, 75/75 routing, 0 fabricated IDs, ~$0.00065 per request** — [results/variance_v7.md](results/variance_v7.md); v6 (69/69, 4.4 s average) in [results/variance_v6.md](results/variance_v6.md); v5 (68/69) in [results/variance_v5.md](results/variance_v5.md); v3 → v4 review in [results/chat_run_2026-11-07.md](results/chat_run_2026-11-07.md); v1 → v2 → v3 experiment in [results/prompt_experiment.md](results/prompt_experiment.md)
- ✅ Langfuse (US, v4 OpenTelemetry ingestion): every chat run logs a trace with router + specialist generations (linked to Langfuse-managed prompts) and 7 scores; workflow errors log an ERROR trace
- ✅ Weekly report workflow built and wired to Mira; it is published once the Gmail account is connected

Everything in `eval/` and `tests/` uses only the Python 3 standard library and Node.js; no installs are needed.

## Key assumptions

- **Reporting date 2026-04-24** and **week 1 = 2026-03-30**. The board's due dates are April–August 2026. Both are editable in `CONFIG`.
- **Counts follow the CSV.** The problem statement says "3 Done"; the board has 5.
- **Top risks are ranked by live task evidence** (blocked > overdue > due soon), because the register has no likelihood or severity scores.

## Screenshots

**n8n workflow canvas** — router, specialist agents, metrics and the two Langfuse nodes:

![n8n workflow canvas](screenshots/01-n8n-workflow-canvas.png)

**Mira in action** — test T8 asked in the n8n chat. Mira finds T024 blocked, T006 overdue, and T007/T025 due soon; the output panel shows route `status`, test `T8`, graded, `pass: true`:

![Mira answering T8 in the n8n chat](screenshots/02-mira-in-action-T8.jpg)

**Langfuse dashboard** — 212 traces, model cost, and scores (id_grounding averages 1.0 across 211 traces):

![Langfuse dashboard](screenshots/03-langfuse-dashboard.jpg)

**Langfuse traces** — every request is a `mira-request` trace with an `agent:router` generation and a specialist generation:

![Langfuse trace list](screenshots/04-langfuse-trace-list.jpg)

**One trace (T8)** — router 1.29 s / $0.00016 and Status Reporter 3.83 s / $0.00079, the full answer, and its scores (baseline_pass 1.00, check_rate 1.00, id_grounding 1.00, route_correct 1.00, footer_compliance 1.00) and tags (`prompt:v6`, `test:T8`):

![Langfuse trace detail](screenshots/05-langfuse-trace-T8-detail.jpg)
![Langfuse trace scores](screenshots/06-langfuse-trace-T8-scores.jpg)
