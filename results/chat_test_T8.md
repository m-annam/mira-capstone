# Interactive chat test — T8 (n8n Cloud, execution #11, 2026-11-05, prompt v3)

**Input (typed in the n8n chat panel):** Which tasks are blocked or at risk of missing their deadline based on the task board?

| Route | Latency | Tokens in / out | Cost | ID grounding |
|---|---|---|---|---|
| status (Status Reporter Agent) | 3.5 s (execution 5.3 s incl. n8n overhead) | 4,771 / 292 | $0.00089 | 1.0 |

**Output:**

> ### Blocked and At-Risk Tasks
>
> **Blocked Tasks:**
> - **T024 Security review of AI infrastructure** — Owner: James Wong · Due: 2026-05-26 · Status: Blocked (waiting for security team availability)
>
> **Overdue Tasks:**
> - **T006 Identify data gaps and quality issues** — Owner: Priya Nair · Due: 2026-04-21 · Status: In Progress
>
> **Due Soon Tasks (not Done, due within 7 days):**
> - **T007 Shortlist AI use cases** — Owner: Arjun Mehta · Due: 2026-04-28 · Status: In Progress
> - **T025 Legal review of data usage** — Owner: Sarah Lin · Due: 2026-04-28 · Status: In Progress
>
> ### Summary
> - There is **1 blocked task** (T024) and **1 overdue task** (T006).
> - There are **2 tasks due soon** (T007 and T025).
>
> _Sources: sample_task_board.csv, project_timeline.csv_
> _Draft for PM review — verify before sharing._

(Bulleted sub-items condensed onto one line here; wording and values unchanged.) Matches the ground truth exactly: T024 blocked, T006 overdue, T007 and T025 due soon.
