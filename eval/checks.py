"""Mira check engine (Python). Same rules as n8n/src/eval_checks.js — keep in sync.

A check is a dict {id, type, required (default True), ...}; see eval_checks.js for the types.
tests/test_checks.py verifies both engines give identical results on the same outputs.
"""
import re

ID_RX = re.compile(r"\b(T\d{3}|R\d{2})\b")


def _rx(pattern, flags="i"):
    f = 0
    if "i" in (flags or "i"): f |= re.IGNORECASE
    if "m" in (flags or ""): f |= re.MULTILINE
    if "s" in (flags or ""): f |= re.DOTALL
    return re.compile(pattern, f)


def run_checks(output, route, chat_input, checks, data_ids):
    text, user = str(output or ""), str(chat_input or "")
    known = set(data_ids.get("tasks", [])) | set(data_ids.get("risks", []))
    user_ids = set(ID_RX.findall(user))
    mentioned = list(dict.fromkeys(ID_RX.findall(text)))
    unknown = [i for i in mentioned if i not in known and i not in user_ids]

    results = []
    for c in checks or []:
        t, ok, detail = c.get("type"), False, ""
        if t == "regex":
            ok = bool(_rx(c["pattern"], c.get("flags")).search(text))
        elif t == "not_regex":
            m = _rx(c["pattern"], c.get("flags")).search(text)
            ok = m is None
            if m: detail = f"found: {m.group(0)[:60]}"
        elif t == "route":
            allowed = c["value"] if isinstance(c["value"], list) else [c["value"]]
            ok, detail = route in allowed, f"route={route}"
        elif t == "ids_grounded":
            ok = not unknown
            if unknown: detail = "unknown: " + ",".join(unknown)
        elif t == "forbid_ids":
            hit = [i for i in c.get("ids", []) if re.search(rf"\b{i}\b", text)]
            ok = not hit
            if hit: detail = "found: " + ",".join(hit)
        elif t == "percents_allowed":
            found = list(dict.fromkeys(re.sub(r"\s|%", "", s) for s in re.findall(r"\b\d+(?:\.\d+)?\s?%", text)))
            bad = [n for n in found if n not in c.get("allowed", [])]
            ok = not bad
            if bad: detail = "unexpected: " + ",".join(b + "%" for b in bad)
        elif t == "min_distinct":
            found = {m.group(0) for m in _rx(c["pattern"], c.get("flags")).finditer(text)}
            ok, detail = len(found) >= c.get("min", 1), f"distinct={len(found)}"
        else:
            detail = f"unknown check type {t}"
        results.append({"id": c.get("id"), "type": t, "required": c.get("required", True) is not False,
                        "pass": ok, "detail": detail, "label": c.get("label", "")})

    req = [r for r in results if r["required"]]
    return {
        "results": results,
        "pass": all(r["pass"] for r in req) if req else None,
        "required_passed": sum(r["pass"] for r in req),
        "required_total": len(req),
        "check_rate": (sum(r["pass"] for r in results) / len(results)) if results else None,
        "mentioned_ids": mentioned,
        "unknown_ids": unknown,
        "id_grounding": (len(mentioned) - len(unknown)) / len(mentioned) if mentioned else 1.0,
    }
