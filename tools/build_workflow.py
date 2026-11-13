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
MAIN_WORKFLOW_ID = "N7xYy18Untlea5YX"          # the live Mira workflow on n8n Cloud
WEEKLY_REPORT_TO = "mallika.annam@gmail.com"   # who gets the Monday report



CHAT_WELCOME = ("Hi, I'm Mira, the project intelligence assistant for the ABCDE Ltd. AI Adoption Project.\n"
    "Try one of these:\n"
    "• Generate a project plan for the AI Adoption Project at ABCDE Ltd.\n"
    "• Which tasks are blocked or at risk of missing their deadline?\n"
    "• What are the top 3 risks for the ABCDE Ltd project?\n"
    "• Generate a stakeholder update email summarizing Sprint 2 progress.\n"
    "• Generate a weekly status report for: \"Things are going fine.\" (shows how I handle vague input)\n"
    "Every answer is a draft for PM review. Reporting date: 2026-04-24.")

def code(name):
    s = rd("n8n", "src", name)
    s = s.replace("__DESCRIPTION__", js(rd("data", "project_description.txt").strip()))
    s = s.replace("__TIMELINE_CSV__", js(rd("data", "project_timeline.csv")))
    s = s.replace("__RISKS_CSV__", js(rd("data", "project_risks.csv")))
    s = s.replace("__TASKS_CSV__", js(rd("data", "sample_task_board.csv")))
    if "__PROMPTS__" in s:
        keys = ["global", "router", "planner", "risk", "status", "timeline", "update"]
        prompts = {v: {k: rd("prompts", v, f"{k}.md").strip() for k in keys if os.path.exists(os.path.join(ROOT, "prompts", v, f"{k}.md"))}
                   for v in ["v1", "v2", "v3", "v4", "v5", "v6", "v7"]}
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
               "1. Chat (or **Run Baseline Tests**) → 2. Knowledge base + deterministic FACTS → 3. Prompt Registry (v1–v6) → 4. **Router agent** → 5. Specialist agent → 6. Formatter → 7. Metrics → 8. Langfuse trace.\n\n"
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
        # Public hosted chat = the live demo link in the README (no login).
        {"parameters": {"public": True, "mode": "hostedChat", "authentication": "none",
                        "initialMessages": CHAT_WELCOME,
                        "options": {"title": "Mira — AI Project Intelligence Assistant",
                                    "subtitle": "Capstone demo by Mallika Annam · n8n + gpt-4o-mini + Langfuse",
                                    "inputPlaceholder": "Ask about the plan, risks, status or a stakeholder update…"}},
         "id": nid("When chat message received"), "name": "When chat message received",
         "type": "@n8n/n8n-nodes-langchain.chatTrigger", "typeVersion": 1.1, "position": [X(0), 0], "webhookId": nid("chat-webhook")},
        {"parameters": {"inputSource": "passthrough"}, "id": nid("When called by Weekly Report"), "name": "When called by Weekly Report",
         "type": "n8n-nodes-base.executeWorkflowTrigger", "typeVersion": 1.1, "position": [X(0) - 240, 440]},
        {"parameters": {}, "id": nid("Run Baseline Tests"), "name": "Run Baseline Tests", "type": "n8n-nodes-base.manualTrigger",
         "typeVersion": 1, "position": [X(0) - 240, 220]},
        code_node("Baseline Test Cases", "baseline_test_cases.js", [X(0), 220], per_item=False),
        code_node("Normalize Input", "normalize_input.js", [X(1), 0]),
        code_node("Project Knowledge Base", "project_kb.js", [X(2), 0]),
        code_node("Prompt Registry", "prompt_registry.js", [X(3), 0]),
        openai_node("Agent: Router", [X(4), 0], "$json.prompts.router", "$json.chatInput", json_mode=True, temp_expr="$json.config.router_temperature"),
        code_node("Parse Route", "parse_route.js", [X(5), 0]),
        {"parameters": {"rules": {"values": [switch_rule("plan", "Planner"), switch_rule("risk", "Risk Assessor"),
                                             switch_rule("status", "Status Reporter"), switch_rule("timeline", "Timeline Advisor"),
                                             switch_rule("update", "Stakeholder Update"),
                                             switch_rule("clarify", "Clarify")]}, "options": {}},
         "id": nid("Route to Specialist"), "name": "Route to Specialist", "type": "n8n-nodes-base.switch", "typeVersion": 3.2, "position": [X(6), 0]},
        specialist("Agent: Planner", "planner", [X(7), -360]),
        specialist("Agent: Risk Assessor", "risk", [X(7), -180]),
        specialist("Agent: Status Reporter", "status", [X(7), 0]),
        specialist("Agent: Timeline Advisor", "timeline", [X(7), 180]),
        specialist("Agent: Stakeholder Update", "update", [X(7), 360]),
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
        "When called by Weekly Report": {"main": M("Normalize Input")},
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
            [{"node": "Agent: Timeline Advisor", "type": "main", "index": 0}],
            [{"node": "Agent: Stakeholder Update", "type": "main", "index": 0}],
            [{"node": "Response Formatter", "type": "main", "index": 0}]]},
        "Agent: Planner": {"main": M("Response Formatter")},
        "Agent: Risk Assessor": {"main": M("Response Formatter")},
        "Agent: Status Reporter": {"main": M("Response Formatter")},
        "Agent: Timeline Advisor": {"main": M("Response Formatter")},
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
    weekly()


def weekly():
    """Mira — Weekly Status Email: every Monday 08:00 (Pacific) ask Mira for the
    weekly report and email it to the PM as a draft."""
    def node(name, typ, ver, params, pos, **extra):
        return {"parameters": params, "id": nid("weekly:" + name), "name": name, "type": typ, "typeVersion": ver, "position": pos, **extra}
    nodes = [
        node("Every Monday 8:00", "n8n-nodes-base.scheduleTrigger", 1.2,
             {"rule": {"interval": [{"field": "weeks", "triggerAtDay": [1], "triggerAtHour": 8}]}}, [0, 0]),
        node("Weekly Request", "n8n-nodes-base.code", 2, {"jsCode": rd("n8n", "src", "weekly_request.js")}, [240, 0]),
        node("Ask Mira", "n8n-nodes-base.executeWorkflow", 1.2,
             {"workflowId": {"__rl": True, "value": MAIN_WORKFLOW_ID, "mode": "id"}, "options": {"waitForSubWorkflow": True}}, [480, 0]),
        node("Report to HTML", "n8n-nodes-base.markdown", 1,
             {"mode": "markdownToHtml", "markdown": "={{ $json.output }}", "destinationKey": "html", "options": {"tables": True}}, [720, 0]),
        node("Build Email", "n8n-nodes-base.code", 2, {"mode": "runOnceForEachItem", "jsCode": rd("n8n", "src", "weekly_email.js")}, [960, 0]),
        node("Email the PM", "n8n-nodes-base.gmail", 2.1,
             {"sendTo": WEEKLY_REPORT_TO, "subject": "={{ $json.subject }}", "emailType": "html", "message": "={{ $json.html }}",
              "options": {"appendAttribution": False}}, [1200, 0], webhookId=nid("weekly:gmail")),
    ]
    names = [n["name"] for n in nodes]
    connections = {a: {"main": [[{"node": b, "type": "main", "index": 0}]]} for a, b in zip(names, names[1:])}
    wf = {"name": "Mira — Weekly Status Email", "nodes": nodes, "connections": connections, "pinData": {},
          "settings": {"executionOrder": "v1", "timezone": "America/Los_Angeles"}, "active": False, "tags": []}
    out = os.path.join(ROOT, "n8n", "mira_weekly_status_email.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)
    print(f"wrote {out}: {len(nodes)} nodes")
    error_handler()
    prompt_sync()


def error_handler():
    """Mira — Error Handler: set as the error workflow of the Mira workflows;
    logs each failure to Langfuse as an ERROR-level trace."""
    nodes = [
        {"parameters": {}, "id": nid("error:trigger"), "name": "When a Mira workflow fails",
         "type": "n8n-nodes-base.errorTrigger", "typeVersion": 1, "position": [0, 0]},
        {"parameters": {"jsCode": rd("n8n", "src", "error_trace.js")}, "id": nid("error:build"), "name": "Build Error Trace",
         "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 0]},
        langfuse_node("Langfuse: Error Trace", "/api/public/otel/v1/traces", "otel", [480, 0], otel=True),
    ]
    # This workflow's data is the failure itself, not a Mira request: point the URL at the US host directly.
    nodes[2]["parameters"]["url"] = "https://us.cloud.langfuse.com/api/public/otel/v1/traces"
    nodes[2]["parameters"]["jsonBody"] = "={{ JSON.stringify($json.otel) }}"
    nodes[2]["id"] = nid("error:langfuse")
    names = [n["name"] for n in nodes]
    connections = {a: {"main": [[{"node": b, "type": "main", "index": 0}]]} for a, b in zip(names, names[1:])}
    wf = {"name": "Mira — Error Handler", "nodes": nodes, "connections": connections, "pinData": {},
          "settings": {"executionOrder": "v1"}, "active": False, "tags": []}
    out = os.path.join(ROOT, "n8n", "mira_error_handler.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)
    print(f"wrote {out}: {len(nodes)} nodes")



LANGFUSE_PROMPT_VERSION = "v7"   # the repo's prompt version pushed to Langfuse Prompt Management


def prompt_sync():
    """Mira — Sync Prompts to Langfuse: run by hand after a new prompt version.
    Pushes prompts/<version>/*.md to Langfuse Prompt Management as text prompts
    named mira-<agent>, labelled production + <version>. The repo stays the source
    of truth; Langfuse gets a versioned copy that traces link to."""
    v = LANGFUSE_PROMPT_VERSION
    items = [{"name": f"mira-{k}", "prompt": rd("prompts", v, f"{k}.md").strip(), "labels": ["production", v],
              "tags": ["mira"], "commitMessage": f"Mira prompts {v} from GitHub m-annam/mira-capstone"}
             for k in ["global", "router", "planner", "risk", "status", "timeline", "update"]]
    code_js = "// Mira | Prompts to push to Langfuse (generated from prompts/" + v + " by tools/build_workflow.py)\nreturn " + json.dumps(items, ensure_ascii=False, indent=1) + ".map(p => ({ json: p }));\n"
    lf = langfuse_node("Langfuse: Create Prompt", "/api/public/v2/prompts", "", [480, 0])
    lf["parameters"]["url"] = "https://us.cloud.langfuse.com/api/public/v2/prompts"
    lf["parameters"]["jsonBody"] = "={{ JSON.stringify({ name: $json.name, type: 'text', prompt: $json.prompt, labels: $json.labels, tags: $json.tags, commitMessage: $json.commitMessage }) }}"
    lf["id"] = nid("sync:langfuse")
    nodes = [
        {"parameters": {}, "id": nid("sync:trigger"), "name": "Run sync", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0]},
        {"parameters": {"jsCode": code_js}, "id": nid("sync:prompts"), "name": f"Prompts {v}", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 0]},
        lf,
    ]
    names = [n["name"] for n in nodes]
    connections = {a: {"main": [[{"node": b, "type": "main", "index": 0}]]} for a, b in zip(names, names[1:])}
    wf = {"name": "Mira — Sync Prompts to Langfuse", "nodes": nodes, "connections": connections, "pinData": {},
          "settings": {"executionOrder": "v1"}, "active": False, "tags": []}
    out = os.path.join(ROOT, "n8n", "mira_prompt_sync.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)
    print(f"wrote {out}: {len(nodes)} nodes")


if __name__ == "__main__":
    main()
