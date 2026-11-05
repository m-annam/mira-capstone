#!/usr/bin/env python3
"""Send every ground-truth test to the live Mira workflow and save the outputs.

Uses the n8n Chat Trigger's public chat URL (turn on "Make Chat Publicly Available"
in the trigger, copy the Chat URL). Standard library only.

Usage:
  export N8N_CHAT_URL="https://<you>.app.n8n.cloud/webhook/<id>/chat"
  python3 eval/run_baseline.py --out results/baseline_v2.jsonl            # all 23 tests
  python3 eval/run_baseline.py --only T1,T8 --out results/smoke.jsonl
  python3 eval/score.py results/baseline_v2.jsonl --md results/report_v2.md
"""
import argparse, json, os, sys, time, urllib.request, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ask(url, text, session):
    body = json.dumps({"action": "sendMessage", "sessionId": session, "chatInput": text}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode()
    ms = int((time.time() - t0) * 1000)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {"output": raw}
    if isinstance(data, list): data = data[0] if data else {}
    return data, ms


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=os.environ.get("N8N_CHAT_URL"))
    ap.add_argument("--out", default=os.path.join(ROOT, "results", "baseline.jsonl"))
    ap.add_argument("--only", help="comma-separated test ids, e.g. T1,T8,E3")
    ap.add_argument("--label", default="", help="free text stored with each row, e.g. 'prompt v1'")
    a = ap.parse_args()
    if not a.url: sys.exit("Set N8N_CHAT_URL or pass --url")
    tests = json.load(open(os.path.join(ROOT, "eval", "ground_truth.json"), encoding="utf-8"))["tests"]
    if a.only: tests = [t for t in tests if t["test_id"] in a.only.split(",")]
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        for t in tests:
            try:
                data, ms = ask(a.url, t["input"], f"eval-{uuid.uuid4().hex[:8]}")  # fresh session per test
            except Exception as e:  # keep going; the row records the error
                data, ms = {"output": f"ERROR: {e}"}, None
            row = {"test_id": t["test_id"], "input": t["input"], "output": data.get("output", ""), "route": data.get("route"),
                   "agent": data.get("agent"), "latency_ms": data.get("latency_ms") or ms, "tokens_in": data.get("tokens_in"),
                   "tokens_out": data.get("tokens_out"), "cost_usd": data.get("cost_usd"), "prompt_version": data.get("prompt_version"),
                   "trace_id": data.get("trace_id"), "label": a.label}
            f.write(json.dumps(row, ensure_ascii=False) + "\n"); f.flush()
            print(f"{t['test_id']:>4}  route={row['route']}  {str(row['output'])[:70].replace(chr(10), ' ')}")
    print(f"\nSaved {len(tests)} results to {a.out}\nNext: python3 eval/score.py {a.out}")


if __name__ == "__main__":
    main()
