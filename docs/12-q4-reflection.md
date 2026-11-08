# Q4 — Reflection and next steps (1 page)

**Author:** Srinivas Annam · Full version: [09-reflection-and-next-steps.md](09-reflection-and-next-steps.md)

**What the traces showed.**
- **The router over-clarified (v2).** It never sees the data, so the rule "no task data → ask" fired on every status question, and routing fell to 74%. Telling the router that the specialists have all the data, and adding 8 routing examples, fixed it (v3: 100%).
- **Naive prompts misused real data.** Facts computed in code kept every ID real, but v1 adopted a user's 30% goal and named owners in a client email.
- **Two wrong answers passed loose checks (v3).** T10 dropped the Blocked count, and T5 reported project health as Sprint 3's. I found them only by reading every answer. The prompt fixed T10 and E5; T5 needed per-sprint facts computed in code.
- **Variance.** Three runs of v5 showed T1 dropping phase names 1 time in 3; a one-line Planner rule fixed it (v6: 69/69).
- **Lesson:** a green test suite is only as good as its assertions, and one run is not evidence.

**Improvement plan (next two weeks).**
1. A check that summary rows add up to the total.
2. CSV upload in chat, with column validation.
3. A PM-set reporting date instead of a fixed one.
4. Hierarchical routing for two-part requests (E10).
5. A Monday Milestone Alert digest to Slack, approved by the PM.
6. An LLM-as-judge score in Langfuse for tone and completeness, calibrated against human review.

**Evaluation and fine-tuning.**
- **The ground truth is a regression suite.** Every prompt version is promoted only after 3 live runs score at least as well as the current one. This is how a QA team gates builds.
- **Fine-tuning comes later, and only if prompts stop improving scores.** The training data would be PM-corrected outputs from the pilot's edit feedback, plus fixed failing traces: about 100–200 examples for a gpt-4o-mini fine-tune, judged on the same suite. Until then, prompts plus code give more for less.

**Privacy.** Client project data goes to OpenAI's API (no training on API data) only after security and legal sign-off.
- Each agent sees only the data it needs.
- Owner names are personal data under GDPR: client emails exclude them, and production should replace them with placeholders in prompts.
- Langfuse stores inputs and outputs. Tracing currently uses the US region; before the pilot it moves to the EU region with a retention limit.
- API keys live in n8n credentials, never in the exported workflow.
- Prompt-injection attempts are ignored (E3), and nothing is ever auto-sent.

**Rollout for 10 PMs/TPMs.**
- **Week 0, readiness:** sign-off, training and feedback buttons.
- **Weeks 1–2, champions:** 3 PMs on the ABCDE project. Gate: ≥ 70% of outputs sent with minor or no edits, and 0 fabricated facts reaching a client.
- **Weeks 3–4, pilot:** all 10 PMs, 2+ projects. Gate: 8 of 10 weekly active, status report under 15 minutes.
- **Week 5:** the CTO decides go, adjust or stop.
- **Change management:** start with the weekly status report, keep the PM as author, and show sources on every answer. See the [program charter](10-program-charter.md).
