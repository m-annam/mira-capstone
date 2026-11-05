#!/usr/bin/env python3
"""Score Mira outputs against the ground-truth dataset and print the metrics report.

Input: a results file with one row per test. Accepted formats
  - JSONL / JSON list from eval/run_baseline.py  (fields: test_id, output, route?, latency_ms?, tokens_in?, tokens_out?)
  - CSV with columns test_id,output[,route,latency_ms,tokens_in,tokens_out]  (e.g. pasted by hand or exported from Langfuse)

Usage:
  python3 eval/score.py results/baseline_v2.jsonl                 # report to stdout
  python3 eval/score.py results/baseline_v2.jsonl --md results/report_v2.md --csv results/scored_v2.csv
  python3 eval/score.py results/baseline_v1.jsonl --compare results/baseline_v2.jsonl   # prompt experiment
"""
import argparse, csv, json, os, statistics, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checks import run_checks  # noqa: E402
from compute_expected import compute  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICE_IN, PRICE_OUT = 0.15, 0.60  # USD per 1M tokens, gpt-4o-mini (see docs/08-cost-strategy.md)


def load_results(path):
    if path.endswith(".csv"):
        with open(path, newline="", encoding="utf-8") as f:
            return list(csv.DictReader(f))
    with open(path, encoding="utf-8") as f:
        txt = f.read().strip()
    if txt.startswith("["):
        return json.loads(txt)
    return [json.loads(line) for line in txt.splitlines() if line.strip()]


def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None


def pct(vals):
    vals = [v for v in vals if v is not None]
    return f"{100 * sum(vals) / len(vals):.0f}%" if vals else "n/a"


def score(results_path, gt_path):
    gt = json.load(open(gt_path, encoding="utf-8"))
    facts = compute(gt["reporting_date"], gt["week1_start"])
    data_ids = {"tasks": facts["task_ids"], "risks": facts["risk_ids"]}
    by_id = {str(r.get("test_id")).strip(): r for r in load_results(results_path)}
    rows = []
    for t in gt["tests"]:
        r = by_id.get(t["test_id"])
        if r is None:
            rows.append({"test_id": t["test_id"], "type": t["type"], "category": t["category"], "missing": True,
                         "clarify_expected": False, "clarify_allowed": False}); continue
        route = (r.get("route") or "").strip() or None
        checks = t["checks"] if route else [c for c in t["checks"] if c["type"] != "route"]  # no route captured -> skip route check
        ev = run_checks(r.get("output", ""), route, t["input"], checks, data_ids)
        exp = t["expected_route"] if isinstance(t["expected_route"], list) else [t["expected_route"]]
        ti, to = num(r.get("tokens_in")), num(r.get("tokens_out"))
        rows.append({"test_id": t["test_id"], "type": t["type"], "category": t["category"], "missing": False,
                     "route": route, "route_correct": (route in exp) if route else None,
                     "pass": ev["pass"], "required": f"{ev['required_passed']}/{ev['required_total']}",
                     "check_rate": ev["check_rate"], "id_grounding": ev["id_grounding"], "unknown_ids": ev["unknown_ids"],
                     "failed": [f"{c['id']}{'' if c['required'] else '(opt)'}: {c['detail'] or c['label']}" for c in ev["results"] if not c["pass"]],
                     "latency_ms": num(r.get("latency_ms")), "tokens_in": ti, "tokens_out": to,
                     "cost_usd": ((ti or 0) * PRICE_IN + (to or 0) * PRICE_OUT) / 1e6 if ti is not None else None,
                     "clarify_expected": exp == ["clarify"], "clarify_allowed": "clarify" in exp})
    return rows


def summary(rows):
    done = [r for r in rows if not r["missing"]]
    base = [r for r in done if r["type"] == "baseline"]
    lat = sorted(r["latency_ms"] for r in done if r["latency_ms"] is not None)
    costs = [r["cost_usd"] for r in done if r["cost_usd"] is not None]
    vague = [r for r in done if r["clarify_expected"]]
    detailed = [r for r in done if not r["clarify_allowed"] and r["route"]]
    fabricated = sum(len(r["unknown_ids"]) for r in done)
    return {
        "tests_scored": f"{len(done)}/{len(rows)}",
        "baseline_pass_rate": f"{sum(bool(r['pass']) for r in base)}/{len(base)} ({pct([1 if r['pass'] else 0 for r in base])})",
        "all_tests_pass_rate": f"{sum(bool(r['pass']) for r in done)}/{len(done)} ({pct([1 if r['pass'] else 0 for r in done])})",
        "check_level_accuracy": pct([r["check_rate"] for r in done]),
        "routing_accuracy": pct([1 if r["route_correct"] else 0 for r in done if r["route_correct"] is not None]),
        "id_grounding_rate": pct([r["id_grounding"] for r in done]),
        "fabricated_ids": fabricated,
        "clarify_recall (should clarify -> clarify)": pct([1 if r["route"] == "clarify" else 0 for r in vague if r["route"]]),
        "false_clarify_rate (answerable -> clarify)": pct([1 if r["route"] == "clarify" else 0 for r in detailed]),
        "latency_p50_ms": round(statistics.median(lat)) if lat else "n/a",
        "latency_p95_ms": round(lat[min(len(lat) - 1, int(0.95 * len(lat)))]) if lat else "n/a",
        "avg_cost_per_request_usd": f"{statistics.mean(costs):.5f}" if costs else "n/a",
    }


def to_markdown(rows, summ, title):
    out = [f"# {title}", "", "| Metric | Value |", "|---|---|"] + [f"| {k} | {v} |" for k, v in summ.items()]
    out += ["", "| Test | Category | Route | Pass | Required checks | Failed checks |", "|---|---|---|---|---|---|"]
    for r in rows:
        if r["missing"]:
            out.append(f"| {r['test_id']} | {r['category']} | — | not run | — | — |"); continue
        out.append(f"| {r['test_id']} | {r['category']} | {r['route'] or '?'} | {'PASS' if r['pass'] else 'FAIL'} | {r['required']} | {'; '.join(r['failed']).replace('|', '/') or '—'} |")
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("results")
    ap.add_argument("--gt", default=os.path.join(ROOT, "eval", "ground_truth.json"))
    ap.add_argument("--md"); ap.add_argument("--csv"); ap.add_argument("--compare")
    a = ap.parse_args()
    rows = score(a.results, a.gt); summ = summary(rows)
    md = to_markdown(rows, summ, f"Mira evaluation — {os.path.basename(a.results)}")
    print(md)
    if a.md: open(a.md, "w", encoding="utf-8").write(md)
    if a.csv:
        with open(a.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    if a.compare:
        rows2 = score(a.compare, a.gt); s2 = summary(rows2)
        print(f"\n## Prompt experiment: {os.path.basename(a.results)} vs {os.path.basename(a.compare)}\n")
        print("| Metric | A | B |\n|---|---|---|")
        for k in summ: print(f"| {k} | {summ[k]} | {s2[k]} |")
        print("\n| Test | A | B |\n|---|---|---|")
        b = {r["test_id"]: r for r in rows2}
        for r in rows:
            fa = "—" if r["missing"] else ("PASS" if r["pass"] else "FAIL")
            rb = b.get(r["test_id"]); fb = "—" if not rb or rb["missing"] else ("PASS" if rb["pass"] else "FAIL")
            print(f"| {r['test_id']} | {fa} | {fb} |")


if __name__ == "__main__":
    main()
