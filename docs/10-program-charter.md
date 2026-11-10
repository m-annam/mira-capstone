# Q3 — Program Charter: Mira

**Program:** Mira, AI project intelligence assistant for Nexora's PMs/TPMs
**Sponsor:** CTO, Nexora Pvt. Ltd. · **Program owner:** Mallika Annam, AI PM/TPM · **Date:** 2026-11-07 · **Status:** Draft for sponsor approval
**Related:** [Ideation](00-ideation.md) · [BRD](01-BRD.md) · [PRD](02-PRD.md) · [Evaluation plan](07-evaluation-plan.md) · [Cost strategy](08-cost-strategy.md) · [Reflection](09-reflection-and-next-steps.md)

## 1. Vision

Every Nexora PM/TPM starts the week with an accurate plan, a current risk picture and a status report already drafted from their own project data. They spend their time on judgement and client conversations, not on compiling documents. Mira drafts; the PM decides and sends.

**Problem it solves:**
- Plans take 3–4 hours to build.
- Status reports take 1–2 hours each week.
- Risk assessments are inconsistent.
- Milestones are missed because nothing warns early.
- No two PMs format their documents the same way.

All five are stated in the problem statement.

## 2. Objectives and success criteria

The pilot passes only if all of these hold after 4 weeks. Metric definitions are in [04-metrics.md](04-metrics.md); baselines are in the [BRD §3](01-BRD.md).

| Objective | Success criterion (pilot exit) | Status today |
|---|---|---|
| Save PM time | Plan < 45 min and status report < 15 min including review (from 3–4 h / 1–2 h) | To measure in pilot |
| Trustworthy output | 0 fabricated tasks, milestones or risks; counts 100% match the board | **Met in testing:** 0 invented IDs in 69 live answers; v6 69/69 |
| Quality the PM accepts | ≥ 70% of outputs sent with minor or no edits | To measure (edit-level feedback) |
| Consistent risk management | 100% of pilot projects have a current risk matrix | To measure |
| Early warning | ≥ 90% of blocked tasks and at-risk milestones flagged before the retrospective | To measure (T8/T11 pass in testing) |
| Adoption | 8 of 10 pilot PMs use Mira weekly | To measure |
| Affordable | LLM spend < $5 per PM per month | **On track:** ~$0.00066 per request, so about $0.07 a month at 100 requests |

## 3. Scope

| In scope (pilot) | Out of scope (pilot) |
|---|---|
| Project plan generation (Planner agent) | Write-back to Jira/Trello; auto-sending email or Slack |
| Risk assessment from the project's risk register (Risk Assessor) | Resource allocation advice, competitive analysis |
| Weekly/sprint status, tracking and milestone questions (Status Reporter) | Fine-tuning (optional after the pilot, see [reflection §4](09-reflection-and-next-steps.md)) |
| Stakeholder updates for leadership, engineering and client (extended capability) | Meeting-notes agent ([ideation use case 3](00-ideation.md)) — next program increment |
| Clarifying questions for vague requests; PM review on every output | Projects without a description, timeline, risk register and board export |
| Tracing and scoring in Langfuse; regression suite of 23 tests | Real-time board sync (pilot uses CSV exports) |

**Deliverables:**
- The n8n workflow, plus the versioned prompts it is built from.
- The ground-truth dataset and its scoring engine.
- A Langfuse dashboard.
- Training material, a feedback loop, and a go/no-go report for the CTO.

## 4. Timeline and milestones

Build is complete. Pilot dates are proposed, starting the week after sponsor approval.

| Phase | Dates (proposed) | Key activities | Milestone / exit gate |
|---|---|---|---|
| 1. Build and evaluate | Done (to 2026-11-07) | Router + 4 agents in n8n; Langfuse; 23-test suite; prompt v1→v6 | **Met:** v6 69/69 over 3 runs, 0 fabricated IDs |
| 2. Readiness | Week of 2026-11-09 | Security and legal sign-off; move tracing to the EU Langfuse region; set trace retention; training deck; feedback buttons | Sign-off received; EU tracing live |
| 3. Champions | 2026-11-16 → 11-27 | 3 PMs on ABCDE use Mira daily; weekly 20-min feedback; fix top issues | ≥ 70% outputs sent with minor/no edits; 0 fabricated facts reach a client |
| 4. Pilot | 2026-11-30 → 12-11 | All 10 PMs/TPMs, 2+ projects; office hours twice a week; Langfuse dashboard for the CTO | 8/10 weekly active; status report < 15 min |
| 5. Decision | Week of 2026-12-14 | Review all metrics against the BRD targets | **Go / adjust / stop** (CTO) |
| 6. Scale | From January 2027 (if Go) | All PMs; CSV upload in chat; Milestone Alert (scheduled Slack digest); hierarchical routing for multi-part requests | Next charter increment |

## 5. Stakeholders and RACI

R = responsible, A = accountable, C = consulted, I = informed.

| Activity | CTO (sponsor) | AI PM/TPM (owner) | Pilot PMs/TPMs (10) | Eng/delivery leads | Security & legal | ABCDE client |
|---|---|---|---|---|---|---|
| Scope, budget, go/no-go | **A** | R | C | C | C | — |
| Agent design, prompts, release gates | I | **A/R** | C | C | — | — |
| Evaluation suite and quality bar | I | **A/R** | C | C | — | — |
| Vendor and data-handling approval | I | R | — | — | **A** | — |
| Each output sent to a stakeholder | — | I | **A/R** | I | — | I (receives approved updates only) |
| Pilot feedback and adoption | I | **A** | R | C | — | — |

## 6. Decision-making and governance

**Decision rights**

| Decision | Who decides | How |
|---|---|---|
| Scope, budget, pilot go/no-go, adding projects | CTO | Steering review using the metrics in §2 |
| Prompt and agent changes; promoting a prompt version | AI PM/TPM | Only if the new version scores at least as well as the current one on the full suite, over 3 runs (as v5 → v6) |
| Whether an output is sent | The PM who owns the project | Every answer is a "Draft for PM review"; the PM can edit or discard it |
| LLM vendor, regions, retention, personal-data handling | Security & legal | Sign-off before the pilot and after any vendor or region change |

**Cadence**
- **Weekly:** a 20-minute pilot feedback call, and a Langfuse quality review (failed checks, edit rate, cost).
- **Every two weeks:** a 30-minute steering check-in with the CTO.
- **Week 5:** the go/no-go review.

**Change control.** Every change is versioned in Git and goes through the same steps:
1. Make the change (prompts are rebuilt into the workflow by `tools/build_workflow.py`).
2. Run the offline tests.
3. Run the live suite 3 times.
4. Publish a named n8n version with the results in its description.

A change that lowers any required score is not released.

**Escalation**
1. PM → Mira owner, same day.
2. Mira owner → CTO, within 48 hours, for anything that affects a client or exceeds budget.
3. **Stop rule:** if a fabricated fact reaches a client, pause client-facing updates, run a root-cause review, add a regression test, and resume only after the CTO approves.

## 7. Risks

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| 1 | A wrong fact reaches a client under a PM's name | Low | High | Counts and dates computed in code; each agent sees only its own data; 151-check regression suite; mandatory PM review; stop rule (§6) | AI PM/TPM |
| 2 | PMs don't trust or adopt it | Medium | High | Start with the most painful task (weekly report); sources on every answer; fix the top issues weekly; share wins | AI PM/TPM |
| 3 | Client data residency and privacy (UK/EU GDPR) | Medium | High | Move Langfuse to the EU region and set retention before the pilot (currently US); OpenAI API with no training on API data; pseudonymize names | Security & legal |
| 4 | Each PM's board export uses different columns | Medium | Medium | One CSV template; column validation on upload; reject with a clear error | AI PM/TPM |
| 5 | Model behaviour drifts or a single run misleads | Medium | Medium | Promote versions only after 3 live runs; pin the model; watch Langfuse scores weekly | AI PM/TPM |
| 6 | Requests with two intents get half an answer (E10) | High | Low | Documented limit; hierarchical routing in the Scale phase | AI PM/TPM |
| 7 | Platform trial ends or cost grows | Low | Medium | n8n plan decision before the pilot; cost per request tracked in every trace; small model | CTO |

## 8. Budget (pilot)

| Item | Estimate |
|---|---|
| LLM (gpt-4o-mini), 10 PMs × ~100 requests/month | < $1/month (measured ~$0.00066/request) |
| n8n Cloud | Starter plan for the pilot (trial ends in ~10 days; decision needed in Readiness) |
| Langfuse Cloud | Free (Hobby) tier for the pilot; paid tier if retention or seats require it |
| People | Program owner ~50% for 6 weeks; 10 PMs × ~1 h/week feedback |

The model in [08-cost-strategy.md](08-cost-strategy.md) estimates ~11 PM-hours saved per PM per month, which far exceeds the run cost.

## 9. Rollout plan

The rollout follows the phases in §4 and [reflection §6](09-reflection-and-next-steps.md):

1. **Readiness:** a 30-minute training covering what Mira can and cannot do, how to review a draft, and how to report a bad answer.
2. **Champions:** 3 PMs on the ABCDE project.
3. **Pilot:** all 10 PMs, on at least 2 projects.
4. **Decision.**
5. **Scale.**

**Change management.** Start with the weekly status report, because it is the most frequent pain. Keep the PM as the author; the review footer and source citations matter as much as accuracy. Track the share of outputs sent with minor or no edits as the trust signal.

## 10. Assumptions and constraints

- Status answers use a reporting date set by the PM. Testing used 2026-04-24 because the sample board's dates run April–August 2026.
- Pilot projects can provide the four inputs: description, timeline, risk register and board CSV.
- Built on n8n Cloud with OpenAI gpt-4o-mini and Langfuse, within the course build window.
- Mira never sends anything on its own.

## 11. Approval

| Role | Name | Decision | Date |
|---|---|---|---|
| Sponsor | CTO, Nexora | ☐ Approve ☐ Revise | |
| Program owner | Mallika Annam | Submitted | 2026-11-07 |
| Security & legal | | ☐ Sign-off | |
