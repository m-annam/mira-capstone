#!/usr/bin/env python3
"""Parity + sanity tests for the evaluation engine.  Run: python3 tests/test_checks.py
1. The JS engine (used in n8n) and the Python engine (used by eval/score.py) agree on every check.
2. Every 'good' fixture passes and every 'bad' fixture fails.
3. The workflow's FACTS equal the independent Python computation (eval/compute_expected.py).
"""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "eval"))
from checks import run_checks
from compute_expected import compute

gt = json.load(open(os.path.join(ROOT, "eval", "ground_truth.json")))
f = compute(gt["reporting_date"], gt["week1_start"])
ids = {"tasks": f["task_ids"], "risks": f["risk_ids"]}
js = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tests", "check_parity.js"), json.dumps(ids)]))
fails = 0
for kind in ["good", "bad"]:
    fx = json.load(open(os.path.join(ROOT, "tests", "fixtures", f"{kind}_outputs.json")))
    for t in gt["tests"]:
        if t["test_id"] not in fx: continue
        r = run_checks(fx[t["test_id"]]["output"], fx[t["test_id"]]["route"], t["input"], t["checks"], ids)
        j = js[f"{kind}:{t['test_id']}"]
        py = [[c["id"], c["pass"]] for c in r["results"]]
        if py != j["checks"] or r["pass"] != j["pass"] or r["unknown_ids"] != j["unknown"]:
            fails += 1; print("PARITY MISMATCH", kind, t["test_id"], py, j["checks"])
        if (kind == "good") != bool(r["pass"]):
            fails += 1; print("UNEXPECTED RESULT", kind, t["test_id"], [c for c in r["results"] if not c["pass"]])
wf_facts_path = os.path.join(ROOT, "tests", "fixtures", "facts_from_workflow.json")
if os.path.exists(wf_facts_path):
    w = json.load(open(wf_facts_path))
    checks = [
        (w["counts"] == f["counts"], "counts"),
        ([t["id"] for t in w["overdue"]] == f["overdue"], "overdue"),
        ([t["id"] for t in w["due_soon"]] == f["due_soon"], "due_soon"),
        ([t["id"] for t in w["blocked"]] == f["blocked"], "blocked"),
        (w["health"] == f["health"], "health"),
        ([m["due"] for m in w["upcoming_milestones"]] == [p["end"] for p in f["upcoming_milestones"]], "upcoming milestones"),
        ([r["risk_id"] for r in w["risk_ranking"]] == [r["risk_id"] for r in f["risk_ranking"]], "risk ranking"),
    ]
    for ok, name in checks:
        if not ok: fails += 1; print("FACTS MISMATCH:", name)
else:
    print("note: run `node tests/run_workflow_offline.js` first to compare workflow FACTS")
n = sum(1 for k in js)
print(f"{n} fixture outputs compared across JS/Python engines; facts compared: {os.path.exists(wf_facts_path)}")
print("ALL TESTS PASSED" if not fails else f"{fails} FAILURE(S)")
sys.exit(1 if fails else 0)
