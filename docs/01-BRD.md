# Mira — Business Requirements Document (BRD)

**Product:** Mira, an AI-powered project intelligence assistant  
**Company:** Nexora Pvt. Ltd. (IT services, London) · **First client project:** ABCDE Ltd. AI Adoption Project (24 weeks)  
**Author:** Srinivas Annam, AI PM/TPM · **Status:** Draft for capstone review · **Related:** [PRD](02-PRD.md)

## 1. Executive summary

Nexora should build Mira, an AI assistant that turns raw project data into project plans, risk assessments and weekly status reports. The goal is to cut PM/TPM planning and reporting time by **75%** across a 10-person PM/TPM pilot. A second goal is to make every plan, risk matrix and status report follow one standard.

Nexora runs several client projects at once with a small PM/TPM team, and planning and reporting are manual, slow and inconsistent. Mira takes the files PMs already have and produces standardized drafts that a PM reviews and sends:

- project description
- timeline
- risk register
- task board export

The first project to use it is the ABCDE Ltd. AI Adoption Project.

## 2. Business problem and current state

Nexora's PMs/TPMs spend hours each week on documents that follow predictable patterns. Problems surface late because nobody tracks progress proactively.

| Pain point | Current state | Business impact |
|---|---|---|
| Project plan creation | 3–4 hours of manual work per project | Slow project kick-off; senior PM time spent on formatting |
| Weekly status reports | 1–2 hours per report, compiled from task boards and meeting notes | Reporting crowds out delivery work every week |
| Risk assessments | Inconsistent: some projects have detailed risk matrices, others have none | Risks found late; client trust exposed |
| Milestone tracking | No proactive alerts; issues found only in retrospectives | Missed milestones and late escalations |
| Document standards | No standard format for plans, status reports or risk documents | Stakeholders can't compare projects; onboarding is harder |
| Team capacity | Several projects run at once, led by a few people | PMs are the bottleneck as the client base grows |

## 3. Business objectives and success metrics

Mira succeeds if PMs spend less time on documents, every project has a risk register, and stakeholders trust the output enough to send it with light edits. Baselines come from the problem statement. Targets are proposed and should be confirmed with the CTO. The full metric definitions are in [04-metrics.md](04-metrics.md).

| Objective | Metric | Baseline | Target (pilot, 4 weeks) |
|---|---|---|---|
| Less admin overhead | Time to create plans and weekly status reports | 3–4 h per plan; 1–2 h per report | 75% less: plan < 45 min, report < 15 min, including PM review |
| Less admin overhead | Hours saved per PM/TPM per week | 0 | ≥ 4 hours (stretch; base estimate ≈ 2.5 h, see §9) |
| Standard artifacts | Outputs that follow the standard template | No standard format | 100% |
| Consistent risk management | Active projects with a current risk matrix | Inconsistent | 100% |
| Proactive risk and delay identification | Blocked tasks and at-risk milestones flagged before the weekly retrospective | Found in retros | ≥ 90% flagged ahead |
| Trustworthy output | Plan groundedness: generated milestones traceable to source files | Not measured | ≥ 95% |
| Trustworthy output | Task count accuracy: report counts matching the CSV export | Not measured | 100% |
| Trustworthy output | Fabricated tasks, milestones or risks in the baseline tests | Not measured | 0 |
| Trustworthy output | Baseline test pass rate (T1–T12) | Not measured | ≥ 11 of 12 |
| Adoption | Pilot PMs/TPMs using Mira weekly | 0 of 10 | 8 of 10 |
| Quality | Outputs sent with minor or no edits | Not measured | ≥ 70% |

## 4. Scope

The pilot covers the three core capabilities plus one extended capability, using the ABCDE Ltd. project files.

**In scope**

- Project plan generation from a project description and timeline
- Risk assessment grounded in the project description and risk register
- Weekly status report from a task board export (CSV)
- **Extended capability:** a stakeholder update generator for leadership, engineering and client audiences
- Clarifying questions when an input is too vague to act on
- Tracing every request (execution, latency, token cost) in **Langfuse**, plus evaluation against the baseline tests
- PM review before any output is shared

**Out of scope for the pilot**

- Write-backs to Jira, Trello or other project management APIs. Live integration may come later; the pilot uses CSV data only.
- Mira sending emails or posting to client channels on its own
- Resource allocation advice and competitive analysis (later extended capabilities)
- Fine-tuning custom models on proprietary data (an optional phase after the pilot, using corrected outputs)
- Projects other than ABCDE Ltd. until the pilot meets its targets

## 5. Stakeholders

The CTO sponsors Mira and approves scope. The AI PM/TPM owns delivery.

| Stakeholder | Interest | Role in decisions | Impact |
|---|---|---|---|
| CTO and leadership, Nexora | Team productivity, standard reporting across projects, visibility into client delivery risks, cost | Executive sponsor; approves scope, budget and go/no-go after the pilot | High |
| AI PM/TPM (Mira owner) | Shipping a reliable assistant | Owns requirements, roadmap, evaluation and rollout | High |
| Pilot PMs/TPMs (10) | Fast plans, risks and status reports without manually parsing CSVs | Primary users; give feedback and approve every output | High |
| Engineering and delivery leads | Clear milestone tracking, quick resolution of blocked dependencies (e.g. T024), fewer status meetings | Secondary users; consulted on agent design; read status reports | Medium |
| ABCDE Ltd. client stakeholders | Clear, accurate progress updates | Receive PM-approved updates; never see unreviewed output | Medium |
| Security and legal | Data privacy for client project data | Approve LLM vendor and data handling before the pilot | Medium |

**Decision-making:** the CTO decides on scope, budget and go/no-go. The Mira owner decides on prompts, agents and the release gates (PRD §10). Pilot PMs have veto on any individual output, because nothing is sent without their review.

## 6. Business requirements

These describe what the business needs. The [PRD](02-PRD.md) turns each one into features and acceptance criteria.

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | PMs can generate a structured project plan (phases, milestones, deliverables, timeline) from a project description in minutes. | Must have |
| BR-02 | Every active project has a categorized risk assessment with impact and mitigation, specific to that project. | Must have |
| BR-03 | PMs can produce a weekly status report from task board data with no manual compiling. | Must have |
| BR-04 | All outputs use one standard format across projects and PMs. | Must have |
| BR-05 | Outputs contain only facts found in the provided project data; Mira never invents tasks, milestones, risks or statuses. | Must have |
| BR-06 | When input is too vague, Mira asks for the missing information instead of guessing. | Must have |
| BR-07 | A PM reviews and approves every output before it reaches a stakeholder. | Must have |
| BR-08 | PMs can generate updates tailored to leadership, engineering or client audiences. | Should have |
| BR-09 | Mira flags at-risk or blocked work before it causes a missed milestone. | Should have |
| BR-10 | Every request is traced so quality, cost and failures can be audited. | Must have |
| BR-11 | Running cost stays low enough to justify rollout (target under $5 per PM per month in LLM spend). | Should have |

## 7. Assumptions, constraints and dependencies

**Assumptions**

- PMs can export task boards as CSV in the format of `sample_task_board.csv`.
- The ABCDE Ltd. data is representative of other Nexora projects: a description, an 8-phase timeline, a 10-risk register and a 25-task board.
- Status questions are answered against a fixed reporting date set by the PM, not the system clock. The pilot uses **2026-04-24** (Sprint 3), because the board's due dates run April–August 2026.
- PMs review outputs. Mira is an assistant, not an autonomous reporter.

**Constraints**

- Build on a low-code platform (**n8n Cloud**) within a 2-week build window.
- Use a low-cost LLM (**OpenAI gpt-4o-mini**) to keep spend small.
- Client data must not be used to train third-party models.

**Dependencies**

- Security and legal approval of the LLM vendor's data terms
- An observability tool account (Langfuse Cloud)
- Pilot PMs' time for a 4-week trial and feedback

## 8. Business risks

The biggest risk is a fabricated fact reaching a client. PM review and data grounding are the main controls.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mira invents a task, milestone or status that reaches a client | Medium | High | Grounding rules, deterministic counts in code, mandatory PM review (BR-05, BR-07) |
| PMs don't trust the output and stop using it | Medium | High | Show sources in each output; track the edit rate; fix top failure modes weekly |
| Client data leaks through the LLM vendor | Low | High | Vendor with no-training terms; security sign-off; send only needed fields |
| Generic, non-project-specific risks and plans | Medium | Medium | Prompts require citing the source file; baseline tests T3 and T7 |
| Vague inputs produce confident but empty plans | Medium | Medium | Input-sufficiency check in the router; tests T2, T4, T6 and T9 |
| Task board formats differ across projects | Medium | Medium | Standard CSV template; validate columns on upload |
| LLM cost grows with usage | Low | Low | Small model, trimmed inputs, cost per request tracked in traces |

## 9. Cost and benefit

On the base assumptions below, Mira saves about **11 hours per PM per month** (about 2.5 hours a week), roughly 110 hours across the 10-person pilot. The 4-hours-a-week target assumes heavier use, such as more plans or daily status checks. LLM spend stays well under $5 per PM per month. All figures are planning estimates, to be replaced with measured pilot data. The detailed model is in [08-cost-strategy.md](08-cost-strategy.md).

| Item | Assumption | Estimate per PM per month |
|---|---|---|
| Plan time saved | 2 new plans a month; 3–4 hours each, down to 45 minutes | ≈ 5.5 hours |
| Status report time saved | 4–5 weekly reports; 1–2 hours each, down to 15 minutes | ≈ 5.5 hours |
| LLM cost | ~100 requests a month on gpt-4o-mini at list prices | < $1 |
| Platform and tracing | n8n Cloud and Langfuse Cloud on starter/free tiers for the pilot | Pilot tier |

The hours saved go back into delivery work: client communication, unblocking engineers and acting on risks early.
