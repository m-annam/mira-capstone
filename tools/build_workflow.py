#!/usr/bin/env python3
"""Build n8n/mira_workflow.json from source files.

Sources of truth:
  data/*                    -> embedded in "Project Knowledge Base"
  prompts/v1, prompts/v2    -> embedded in "Prompt Registry"
  eval/ground_truth.json    -> embedded in "Baseline Test Cases"
  n8n/src/*.js              -> Code node bodies
Run after changing any of them:  python3 tools/build_workflow.py
"""
import json, os, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda *p: open(os.path.join(ROOT, *p), encoding="utf-8").read()
js = lambda s: json.dumps(s, ensure_ascii=False)
NS = uuid.UUID("6d1c3f0e-9a57-4f3b-8c2e-6a0a7c1d2e3f")
nid = lambda name: str(uuid.uuid5(NS, name))  # stable node ids across rebuilds


def code(name):
    s = rd("n8n", "src", name)
    s = s.replace("__DESCRIPTION__", js(rd("data", "project_description.txt").strip()))
    s = s.replace("__TIMELINE_CSV__", js(rd("data", "project_timeline.csv")))
    s = s.replace("__RISKS_CSV__", js(rd("data", "project_risks.csv")))
    s = s.replace("__TASKS_CSV__", js(rd("data", "sample_task_board.csv")))
    if "__PROMPTS__" in s:
        prompts = {v: {k: rd("prompts", v, f"{k}.md").strip() for k in ["global", "router", "planner", "risk", "status", "update"]} for v in ["v1", "v2", "v3", "v4", "v5"]}
        s = s.replace("__PROMPTS__", json.dumps(prompts, indent=2, ensure_ascii=False))
    if "__TEST_CASES__" in s:
        tests = json.load(open(os.path.join(ROOT, "eval", "ground_truth.json"), encoding="utf-8"))["tests"]
        slim = [{k: t[k] for k in ["test_id", "type", "category", "input", "expected_route", "checks"]} for t in tests]
        s = s.replace("__TEST_CASES__", json.dumps(slim, indent=1, ensure_ascii=False))
    if "__TEST_INDEX__" in s:
        import re
        tests = json.load(open(os.path.join(ROOT, "eval", "ground_truth.json"), encoding="utf-8"))["tests"]
        norm = lambda x: re.sub(r"[^a-z0-9]+", " ", re.sub(r"[\u2018\u2019\u201c\u201d\"'`]", "", x.lower())).strip()
        idx = {norm(t["input"]): {k: t[k] for k in ["test_id", "type", "expected_route", "checks"]} for t in tests}
        s = s.replace("__TEST_INDEX__", json.dumps(idx, ensure_ascii=False, separators=(",", ":")))
    if "/*__CHECK_ENGINE__*/" in s:
        s = s.replace("/*__CHECK_ENGINE__*/", rd("n8n", "src", "eval_checks.js"))
    return s


def code_node(name, src, pos, per_item=True):
    p = {"jsCode": code(src)}
    if per_item: p = {"mode": "runOnceForEachItem", **p}
    return {"parameters": p, "id": nid(name), "name": name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos}


def openai_node(name, pos, system_expr, user_expr, json_mode=False, temp_expr="$json.config.temperature"):
    body = (f"={{{{ JSON.stringify({{ model: $json.config.model, temperature: {temp_expr}, max_tokens: $json.config.max_tokens, "
            + ("response_format: { type: 'json_object' }, " if json_mode else "")
            + f"messages: [ {{ role: 'system', content: {system_expr} }}, {{ role: 'user', content: {user_expr} }} ] }}) }}}}")
    return {"parameters": {"method": "POST", "url": "https://api.openai.com/v1/chat/completions",
                           "authentication": "predefinedCredentialType", "nodeCredentialType": "openAiApi",
                           "sendBody": True, "specifyBody": "json", "jsonBody": body, "options": {"timeout": 90000}},
            "id": nid(name), "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": pos,
            "retryOnFail": True, "maxTries": 2, "waitBetweenTries": 2000,
            "credentials": {"openAiApi": {"id": "REPLACE_WITH_YOUR_OPENAI_CREDENTIAL", "name": "OpenAI account"}}}


def specialist(name, key, pos):
    user = f"'## Project Knowledge Base (your ONLY source)\\n' + $json.kb.{key} + '\\n\\n## Request\\n' + $json.chatInput"
    return openai_node(name, pos, f"$json.global_prompt + '\\n\\n' + $json.prompts.{'planner' if key == 'planner' else key}", user)


def langfuse_node(name, path, field, pos, otel=False):
    # Read from "Build Langfuse Trace" by name: the Scores node's own input ($json) is the OTel response.
    src = "$('Build Langfuse Trace').item.json"
    p = {"method": "POST", "url": "={{ " + src + ".config.langfuse_host }}" + path,
         "authentication": "genericCredentialType", "genericAuthType": "httpBasicAuth",
         "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify(" + src + "." + field + ") }}",
         "options": {"timeout": 20000}}
    if otel:
        p["sendHeaders"] = True
        p["headerParameters"] = {"parameters": [{"name": "x-langfuse-ingestion-version", "value": "4"}]}
    return {"parameters": p, "id": nid(name), "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
            "position": pos, "onError": "continueRegularOutput",
            "credentials": {"httpBasicAuth": {"id": "REPLACE_WITH_YOUR_LANGFUSE_CREDENTIAL", "name": "Langfuse (public key / secret key)"}}}


def switch_rule(value, label):
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                           "conditions": [{"id": nid("rule-" + value), "leftValue": "={{ $json.route }}", "rightValue": value,
                                           "operator": {"type": "string", "operation": "equals"}}],
                           "combinator": "and"}, "renameOutput": True, "outputKey": label}


def sticky(name, text, pos, w, h, color=None):
    p = {"content": text, "height": h, "width": w}
    if color: p["color"] = color
    return {"parameters": p, "id": nid(name), "name": name, "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": pos}


def main():
    X = lambda i: 240 * i
    nodes = [
        sticky("Note: Overview",
               "## Mira — AI Project Intelligence Assistant (multi-agent)\nRouter + 4 specialist agents, each with a **strictly scoped** knowledge base.\n"
               "1. Chat (or **Run Baseline Tests**) → 2. Knowledge base + deterministic FACTS → 3. Prompt Registry (v1–v5) → 4. **Router agent** → 5. Specialist agent → 6. Formatter → 7. Metrics → 8. Langfuse trace.\n\n"
               "**Setup:** set the *OpenAI account* credential on the 5 OpenAI nodes and a *Basic Auth* credential (user = Langfuse public key, password = secret key) on **Langfuse: Traces (OTel)** and **Langfuse: Scores**. "
               "Host is US (`us.cloud.langfuse.com`); for EU change `langfuse_host` in *Project Knowledge Base*.",
               [X(0) - 40, -520], 760, 260, 4),
        sticky("Note: Agents",
               "### Agents (system prompts in *Prompt Registry*)\n- **Router**: plan / risk / status / update / clarify (answers vague requests itself)\n"
               "- **Planner**: description + timeline only\n- **Risk Assessor**: risk register + description + live evidence\n"
               "- **Status Reporter**: task board + timeline + FACTS\n- **Stakeholder Update**: per-sprint view + FACTS",
               [X(4) - 40, -520], 520, 260, 5),
        sticky("Note: Evaluation",
               "### Metrics + tracing\n*Evaluate Output* scores every answer (ID grounding, footer, tokens, cost, latency) and, for test runs, the ground-truth checks. "
               "*Build Langfuse Trace* sends the trace + 2 generations via OpenTelemetry (`/api/public/otel/v1/traces`) and the scores via `/api/public/ingestion` (score-create, still supported after Langfuse's 2026-11-16 cutover).",
               [X(8) - 40, -520], 600, 200, 6),
        {"parameters": {"options": {}}, "id": nid("When chat message received"), "name": "When chat message received",
         "type": "@n8n/n8n-nodes-langchain.chatTrigger", "typeVersion": 1.1, "position": [X(0), 0], "webhookId": nid("chat-webhook")},
        {"parameters": {}, "id": nid("Run Baseline Tests"), "name": "Run Baseline Tests", "type": "n8n-nodes-base.manualTrigger",
         "typeVersion": 1, "position": [X(0) - 240, 220]},
        code_node("Baseline Test Cases", "baseline_test_cases.js", [X(0), 220], per_item=False),
        code_node("Normalize Input", "normalize_input.js", [X(1), 0]),
        code_node("Project Knowledge Base", "project_kb.js", [X(2), 0]),
        code_node("Prompt Registry", "prompt_registry.js", [X(3), 0]),
        openai_node("Agent: Router", [X(4), 0], "$json.prompts.router", "$json.chatInput", json_mode=True, temp_expr="$json.config.router_temperature"),
        code_node("Parse Route", "parse_route.js", [X(5), 0]),
        {"parameters": {"rules": {"values": [switch_rule("plan", "Planner"), switch_rule("risk", "Risk Assessor"),
                                             switch_rule("status", "Status Reporter"), switch_rule("update", "Stakeholder Update"),
                                             switch_rule("clarify", "Clarify")]}, "options": {}},
         "id": nid("Route to Specialist"), "name": "Route to Specialist", "type": "n8n-nodes-base.switch", "typeVersion": 3.2, "position": [X(6), 0]},
        specialist("Agent: Planner", "planner", [X(7), -360]),
        specialist("Agent: Risk Assessor", "risk", [X(7), -180]),
        specialist("Agent: Status Reporter", "status", [X(7), 0]),
        specialist("Agent: Stakeholder Update", "update", [X(7), 180]),
        code_node("Response Formatter", "format_response.js", [X(8), 0]),
        code_node("Evaluate Output", "evaluate_output.js", [X(9), 0]),
        code_node("Build Langfuse Trace", "build_langfuse_batch.js", [X(10), 0]),
        langfuse_node("Langfuse: Traces (OTel)", "/api/public/otel/v1/traces", "langfuse_otel", [X(11), 0], otel=True),
        langfuse_node("Langfuse: Scores", "/api/public/ingestion", "langfuse_scores", [X(12), 0]),
        code_node("Chat Response", "chat_response.js", [X(13), 0]),
    ]
    M = lambda *targets: [[{"node": t, "type": "main", "index": 0} for t in targets]]
    connections = {
        "When chat message received": {"main": M("Normalize Input")},
        "Run Baseline Tests": {"main": M("Baseline Test Cases")},
        "Baseline Test Cases": {"main": M("Normalize Input")},
        "Normalize Input": {"main": M("Project Knowledge Base")},
        "Project Knowledge Base": {"main": M("Prompt Registry")},
        "Prompt Registry": {"main": M("Agent: Router")},
        "Agent: Router": {"main": M("Parse Route")},
        "Parse Route": {"main": M("Route to Specialist")},
        "Route to Specialist": {"main": [
            [{"node": "Agent: Planner", "type": "main", "index": 0}],
            [{"node": "Agent: Risk Assessor", "type": "main", "index": 0}],
            [{"node": "Agent: Status Reporter", "type": "main", "index": 0}],
            [{"node": "Agent: Stakeholder Update", "type": "main", "index": 0}],
            [{"node": "Response Formatter", "type": "main", "index": 0}]]},
        "Agent: Planner": {"main": M("Response Formatter")},
        "Agent: Risk Assessor": {"main": M("Response Formatter")},
        "Agent: Status Reporter": {"main": M("Response Formatter")},
        "Agent: Stakeholder Update": {"main": M("Response Formatter")},
        "Response Formatter": {"main": M("Evaluate Output")},
        "Evaluate Output": {"main": M("Build Langfuse Trace")},
        "Build Langfuse Trace": {"main": M("Langfuse: Traces (OTel)")},
        "Langfuse: Traces (OTel)": {"main": M("Langfuse: Scores")},
        "Langfuse: Scores": {"main": M("Chat Response")},
    }
    wf = {"name": "Mira — AI Project Intelligence Assistant (multi-agent)", "nodes": nodes, "connections": connections,
          "pinData": {}, "settings": {"executionOrder": "v1"}, "active": False,
          "meta": {"templateCredsSetupCompleted": False}, "tags": []}
    out = os.path.join(ROOT, "n8n", "mira_workflow.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)
    print(f"wrote {out}: {len(nodes)} nodes, {sum(len(v['main']) for v in connections.values())} connection groups")


if __name__ == "__main__":
    main()
