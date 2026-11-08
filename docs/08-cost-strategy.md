# Cost Strategy

**Bottom line:** measured on live runs, a Mira request costs **$0.0004–0.0009** (a tenth of a cent). That is 10× under the PRD's $0.01 ceiling. A 10-PM pilot spends **about $1 a month on LLM calls**. The real cost drivers are the platform subscriptions (n8n Cloud, Langfuse), not tokens. The strategy is to keep the cheap model, keep prompts scoped, and watch cost per request in Langfuse rather than optimize tokens early.

## 1. Pricing inputs

| Item | Price | Source / date checked |
|---|---|---|
| OpenAI gpt-4o-mini input | $0.15 per 1M tokens | OpenAI list price, cross-checked on several pricing trackers, Oct–Nov 2026 |
| OpenAI gpt-4o-mini output | $0.60 per 1M tokens | as above |
| OpenAI gpt-4o-mini cached input / Batch API | $0.075 / 50% off | as above |
| n8n Cloud Starter | €20/mo (annual) or €24/mo (monthly), 2,500 executions | n8n pricing, as reported Oct 2026 |
| n8n Cloud Pro | €50/mo (annual) or €60/mo (monthly), 10,000 executions | as above |
| Langfuse Cloud Hobby | $0, 50k units/month, 30-day retention, 2 users | langfuse.com/pricing, as reported Oct 2026 |
| Langfuse Cloud Core | $29/mo, 100k units, then $8 per 100k | as above |

Prices change. Re-check them before quoting numbers to stakeholders. `config.price_per_1m_input_usd` and `config.price_per_1m_output_usd` in the *Project Knowledge Base* node drive the in-workflow cost metric, so update them there.

## 2. Measured cost (live runs, 2026-11-05)

| Run | Requests | Input tokens | Output tokens | Total cost | Avg per request |
|---|---|---|---|---|---|
| v2 batch (exec #8) | 23 | 41,650 | 5,009 | $0.0093 | $0.00040 |
| v3 batch (exec #9) | 23 | 71,545 | 5,815 | $0.0142 | $0.00062 |
| v3 single chat request (T8, exec #11) | 1 | 4,771 | 292 | $0.0009 | $0.00089 |
| v4 chat run, 23 tests one message each (execs #69–#91, 2026-11-07) | 23 | — | — | $0.0150 | $0.00065 |

v3 costs more per request than v2 only because v2 wrongly short-circuited 6 answerable questions at the cheap router; v3 answers them with the Status Reporter (~4,750 input tokens). The whole 3-version evaluation (69 requests) cost about **$0.04**. Measured numbers match the model below.

## 3. Cost per request (model)

Each request makes **one router call**, plus **one specialist call** unless it is clarified. Input sizes below were **measured** from the real n8n run of the workflow: system prompt plus scoped knowledge base, at about 4 characters per token. Output sizes are estimates until the live run; Langfuse will report exact numbers.

| Route | Router in / out (tokens) | Specialist in / out (tokens) | Est. cost per request |
|---|---|---|---|
| Clarify (vague input) | ~800 / ~150 | — | **$0.0002** |
| Plan | ~800 / ~60 | ~1,500 / ~900 | **$0.0009** |
| Risk (full matrix) | ~800 / ~60 | ~1,800 / ~1,100 | **$0.0011** |
| Status | ~800 / ~60 | ~3,500 / ~600 | **$0.0010** |
| Stakeholder update | ~800 / ~60 | ~1,700 / ~400 | **$0.0007** |

`cost = (input_tokens × 0.15 + output_tokens × 0.60) / 1,000,000`, summed over both calls. The Status Reporter has the biggest input, because it gets the full 25-task board, the timeline and the FACTS block. Output tokens cost 4× input, so long risk matrices are the most expensive answers.

## 4. Monthly cost by scenario

| Scenario | Requests / month | LLM cost | n8n executions | Langfuse units* | Platform plan that fits |
|---|---|---|---|---|---|
| Capstone build + evaluation (yours) | ~300 (5 full test runs × 23 + chat testing) | **< $0.50** | ~150 (each *Run Baseline Tests* click = 1 execution for all 23 tests) | ~3k | n8n Starter trial + Langfuse Hobby |
| Pilot: 10 PMs × 100 requests | 1,000 | **≈ $1** | 1,000 | ~9k | n8n Starter (2,500 exec) + Langfuse Hobby |
| Rollout: 50 PMs × 150 requests | 7,500 | **≈ $7.50** | 7,500 | ~70k | n8n Pro (10k exec) + Langfuse Core |

\*About 9 Langfuse units per request: 1 trace + 2 generations + 4–7 scores.

Per PM per month, LLM spend is about **$0.10–$0.15**. That is far under the BRD's $5 target (BR-11). Platform cost per PM drops from about €2–2.40 (pilot) to about €1 plus about $0.60 (rollout).

## 5. Cost strategy and levers

**Already in the design**

1. **Small model everywhere** (gpt-4o-mini). Routing and grounded drafting don't need a frontier model; that is about 15–20× cheaper than gpt-4o per token.
2. **Scoped knowledge bases.** Each specialist gets only its files, so no request sends everything. Sending all four files to every agent would roughly double specialist input.
3. **Clarify in the router.** Vague requests stop after one cheap call ($0.0002) instead of producing a long, useless plan.
4. **Code instead of tokens for facts.** Counts, overdue lists and milestone dates are computed in a Code node. The model doesn't spend tokens or retries working them out.
5. **`max_tokens` cap of 1,500** per call, which bounds the worst-case cost at about $0.0013 per request.
6. **Cost is measured, not guessed.** Every trace carries `cost_usd`, and Langfuse aggregates it by route and prompt version.

**Levers if volume grows** (in order of effort)

| Lever | Saving | Trade-off |
|---|---|---|
| Prompt caching (keep system prompt + KB as a stable prefix) | Up to 50% on cached input tokens (OpenAI applies it automatically to repeated prefixes ≥ 1,024 tokens) | None. The Status agent's prefix already qualifies. |
| Trim the Status KB: send the per-sprint view only for sprint questions | ~40% of Status input | Slightly more routing logic |
| Batch API for nightly or bulk reports | 50% | Results within hours, not seconds |
| Rule-based pre-router for obvious intents ("status of T0xx") | Skips some router calls | Must not weaken clarify behaviour |
| Self-host n8n and Langfuse | Removes subscription fees | DevOps time, roughly 10–20 h/month by common estimates |

**What we would not cut:** the router call, the PM-review footer, or tracing. These protect against the expensive failure, which is a wrong fact reaching a client, not a $0.001 request.

## 6. Unit economics

At the BRD's base estimate of about 11 hours saved per PM per month, a PM costing $60/h internally saves about $660 a month. Mira costs about $0.15 in LLM spend plus about $3 of platform cost per PM. The case doesn't depend on token optimization; it depends on **quality** (M1, M4) and **adoption** (M13, M14). Both are measured.

## 7. Monitoring and guardrails

- A Langfuse dashboard widget for *total cost by day* and *average cost per trace by route*.
- An alert if the average cost per request goes above $0.005 (5× normal). That usually means a prompt or KB grew by accident.
- The `cost_usd` score on every trace, and `avg_cost_per_request_usd` in `eval/score.py` reports. Prompt changes are compared on quality **and** cost.
- An OpenAI project spending limit (for example $10/month for the pilot) as a hard cap.
