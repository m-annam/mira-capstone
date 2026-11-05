#!/usr/bin/env python3
"""Compute the ground-truth facts for Mira's tests directly from the source CSVs.

Independent of the n8n workflow (pure Python, standard library) so it can be used to
verify both the workflow's FACTS block and the expected answers in ground_truth.json.

Usage:  python3 eval/compute_expected.py [--date 2026-04-24] [--week1 2026-03-30] [--json]
"""
import argparse, csv, json, os
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
STATUSES = ["Done", "In Progress", "To Do", "Blocked"]
RISK_TASK_LINKS = {  # keep in sync with n8n/src/project_kb.js
    "R01": ["T006", "T010", "T011"], "R02": ["T010", "T015"], "R03": ["T020"], "R04": ["T016", "T020"],
    "R05": ["T025"], "R06": ["T009"], "R07": ["T008"], "R08": ["T022"], "R09": ["T024"], "R10": ["T009"],
}


def read(name):
    with open(os.path.join(DATA, name), newline="", encoding="utf-8") as f:
        return [{k.strip(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(f)]


def compute(reporting_date: str, week1: str, at_risk_days=7, window_days=14):
    rd, w1 = date.fromisoformat(reporting_date), date.fromisoformat(week1)
    tasks, timeline, risks = read("sample_task_board.csv"), read("project_timeline.csv"), read("project_risks.csv")
    due = lambda t: date.fromisoformat(t["due_date"])

    counts = {s: sum(t["status"] == s for t in tasks) for s in STATUSES}
    counts["Total"] = len(tasks)
    overdue = [t["task_id"] for t in tasks if t["status"] != "Done" and due(t) < rd]
    due_soon = [t["task_id"] for t in tasks if t["status"] != "Done" and rd <= due(t) <= rd + timedelta(days=at_risk_days)]
    blocked = [t["task_id"] for t in tasks if t["status"] == "Blocked"]
    sprints = {}
    for t in tasks:
        sprints.setdefault(t["sprint"], {}).setdefault(t["status"], []).append(t["task_id"])

    phases = []
    for p in timeline:
        sw, ew = int(p["start_week"]), int(p["end_week"])
        phases.append({"phase": int(p["phase"]), "name": p["phase_name"], "weeks": f"{sw}-{ew}",
                       "start": str(w1 + timedelta(days=7 * (sw - 1))), "end": str(w1 + timedelta(days=7 * ew - 1)),
                       "milestones": p["milestones_deliverables"]})
    win_end = rd + timedelta(days=window_days)
    upcoming = [p for p in phases if rd <= date.fromisoformat(p["end"]) <= win_end]
    after = sorted([p for p in phases if date.fromisoformat(p["end"]) > win_end], key=lambda p: p["end"])
    current = next((p for p in phases if date.fromisoformat(p["start"]) <= rd <= date.fromisoformat(p["end"])), None)

    by_id = {t["task_id"]: t for t in tasks}

    def signal(tid):
        t = by_id.get(tid)
        if not t: return 0
        if t["status"] == "Blocked": return 4
        if t["status"] != "Done" and due(t) < rd: return 3
        if t["status"] == "In Progress" and (due(t) - rd).days <= at_risk_days: return 2
        if t["status"] == "To Do" and (due(t) - rd).days <= window_days: return 1
        return 0
    ranked = sorted(((max([signal(x) for x in RISK_TASK_LINKS.get(r["risk_id"], [])] or [0]), i, r["risk_id"])
                     for i, r in enumerate(risks)), key=lambda x: (-x[0], x[1]))

    health = "Green"
    if len(overdue) >= 3 or any((due(by_id[b]) - rd).days <= at_risk_days for b in blocked):
        health = "Red"
    elif overdue or blocked:
        health = "Amber"

    return {
        "reporting_date": reporting_date, "week1_start": week1, "counts": counts, "overdue": overdue,
        "due_soon": due_soon, "blocked": blocked, "health": health, "sprints": sprints,
        "current_phase": current and f"Phase {current['phase']} {current['name']}",
        "upcoming_milestones": upcoming, "next_milestone_after_window": after[0] if after else None,
        "risk_ranking": [{"risk_id": r, "score": s} for s, _, r in ranked], "phases": phases,
        "task_ids": [t["task_id"] for t in tasks], "risk_ids": [r["risk_id"] for r in risks],
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default="2026-04-24")
    ap.add_argument("--week1", default="2026-03-30")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    f = compute(a.date, a.week1)
    if a.json:
        print(json.dumps(f, indent=2)); raise SystemExit
    print(f"Reporting date {f['reporting_date']} | week 1 starts {f['week1_start']}")
    print("Counts:", f["counts"])
    print("Health:", f["health"], "| Current phase:", f["current_phase"])
    print("Blocked:", f["blocked"], "| Overdue:", f["overdue"], "| Due within 7 days:", f["due_soon"])
    for s in ["Sprint 2", "Sprint 3"]:
        print(f"{s}:", f["sprints"][s])
    print("Upcoming milestones (14 days):", [(p["phase"], p["name"], p["end"], p["milestones"]) for p in f["upcoming_milestones"]])
    n = f["next_milestone_after_window"]
    print("Next after window:", n and (n["phase"], n["name"], n["end"], n["milestones"]))
    print("Risk ranking:", [(r["risk_id"], r["score"]) for r in f["risk_ranking"]])
    for p in f["phases"]:
        print(f"  Phase {p['phase']} {p['name']}: weeks {p['weeks']} ({p['start']} to {p['end']})")
