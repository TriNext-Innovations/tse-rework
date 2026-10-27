#!/usr/bin/env python3
"""Generate the n8n workflow JSON in ../n8n/ (importable into n8n 2.37.x).

The workflows are thin on purpose: n8n owns schedules, sequencing, retries
and notifications; every decision that needs state, locking or money control
lives in the agency service, where it is tested. Edit this file, not the JSON.

    python scripts/build_workflows.py
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "n8n"
AGENCY = "http://tse-agency:8080"  # service name on the shared docker network
AGENCY_CRED = {"httpHeaderAuth": {"id": "REPLACE_AGENCY_CREDENTIAL_ID", "name": "TSE Agency API"}}
DISCORD_CRED = {"discordWebhookApi": {"id": "hK9mTseDiscordW1", "name": "TSE Social Discord Webhook"}}
ERROR_WORKFLOW_ID = "tseAgencyAlert01"


def _id(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"tse-agency/{name}"))


def schedule(name: str, cron: str, pos) -> dict:
    return {"id": _id(name), "name": name, "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2,
            "position": pos, "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": cron}]}}}


def agency(name: str, method: str, path: str, pos, body: dict | None = None, timeout_ms: int = 600_000,
           retries: int = 2) -> dict:
    params = {
        "method": method, "url": f"{AGENCY}{path}",
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "options": {"timeout": timeout_ms},
    }
    if body is not None:
        params.update({"sendBody": True, "specifyBody": "json", "jsonBody": json.dumps(body)})
    return {"id": _id(name), "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
            "position": pos, "parameters": params, "credentials": AGENCY_CRED,
            # Retries are safe: every agency endpoint is idempotent.
            "retryOnFail": True, "maxTries": retries + 1, "waitBetweenTries": 5000}


def code(name: str, js: str, pos) -> dict:
    return {"id": _id(name), "name": name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos,
            "parameters": {"jsCode": js}}


def discord(name: str, content_expr: str, pos) -> dict:
    return {"id": _id(name), "name": name, "type": "n8n-nodes-base.discord", "typeVersion": 2, "position": pos,
            "parameters": {"authentication": "webhook", "content": content_expr, "options": {}},
            "credentials": DISCORD_CRED}


def if_true(name: str, expr: str, pos) -> dict:
    return {"id": _id(name), "name": name, "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": pos,
            "parameters": {"conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                "conditions": [{"id": _id(name + "/c"), "leftValue": expr, "rightValue": "",
                                "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                "combinator": "and"}, "options": {}}}


def manual(pos) -> dict:
    return {"id": _id("Run now"), "name": "Run now", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1,
            "position": pos, "parameters": {}}


def fan(src: str, *targets: str) -> dict:
    return {src: {"main": [[{"node": t, "type": "main", "index": 0} for t in targets]]}}


def chain(*names: str) -> dict:
    return {a: {"main": [[{"node": b, "type": "main", "index": 0}]]} for a, b in zip(names, names[1:])}


def workflow(wid: str, name: str, nodes: list[dict], connections: dict, description: str, error_wf: bool = True,
             run_now: tuple[str, ...] = ()) -> dict:
    if run_now:  # an operator "Run now" button; also what `n8n execute` starts from
        nodes = [manual([-240, 120]), *nodes]
        connections = {**connections, **fan("Run now", *run_now)}
    settings = {"executionOrder": "v1", "timezone": "Africa/Johannesburg", "saveManualExecutions": True,
                "callerPolicy": "workflowsFromSameOwner"}
    if error_wf:
        settings["errorWorkflow"] = ERROR_WORKFLOW_ID
    return {"id": wid, "name": name, "description": description, "active": False, "nodes": nodes,
            "connections": connections, "settings": settings, "tags": [], "meta": {"templateCredsSetupCompleted": False}}


def build() -> dict[str, dict]:
    wfs = {}

    # 1 — Campaign planning + fact verification (daily; planning is a no-op once a week is planned).
    wfs["1-planning.tseAgencyPlan01.json"] = workflow(
        "tseAgencyPlan01", "TSE Agency — 1 Planning",
        [schedule("Daily 05:30", "30 5 * * *", [0, 0]),
         agency("Verify facts on tse.co.za", "POST", "/v1/facts/verify", [240, 0], {}, timeout_ms=120_000),
         agency("Plan unplanned weeks", "POST", "/v1/plan", [480, 0], {}),
         code("New campaigns", "const planned = ($json.result && $json.result.planned) || [];\n"
              "return planned.filter(p => p.created).map(p => ({ json: p }));", [720, 0]),
         discord("Announce campaign",
                 "={{ '🗓️ **New TSE campaign planned** — week of ' + $json.week_start + '\\n**' + $json.name + '**\\n'"
                 " + $json.proposition + '\\n' + $json.assignments + ' assignments queued.' }}", [960, 0])],
        chain("Daily 05:30", "Verify facts on tse.co.za", "Plan unplanned weeks", "New campaigns", "Announce campaign"),
        "Stage A. Re-verifies the fact sheet against the live site, then plans any week in the next 8 days "
        "without a campaign (current week included). Idempotent.", run_now=("Verify facts on tse.co.za",))

    # 2–4 — Creative development, artwork production and QC, advanced in small steps.
    wfs["2-production.tseAgencyProd01.json"] = workflow(
        "tseAgencyProd01", "TSE Agency — 2 Creative production loop",
        [schedule("Every 20 minutes", "*/20 * * * *", [0, 0]),
         agency("Advance pipeline", "POST", "/v1/cycle", [240, 0], {"max_steps": 6}, timeout_ms=900_000, retries=0),
         code("Summarise", "const steps = ($json.result && $json.result.steps) || [];\n"
              "const notable = steps.filter(s => ['approved', 'failed', 'render_failed'].includes(s.status));\n"
              "return notable.map(s => ({ json: s }));", [480, 0]),
         discord("Report approvals",
                 "={{ ($json.status === 'approved' ? '✅ Creative #' + $json.creative_id + ' approved (vision ' + $json.score + ')'"
                 " : '⚠️ ' + $json.stage + ' ' + $json.status + ' ' + JSON.stringify($json).slice(0, 300)) }}", [720, 0])],
        chain("Every 20 minutes", "Advance pipeline", "Summarise", "Report approvals"),
        "Stages B–F. Each run does QC → collect finished generations → submit new generations → develop new "
        "concepts, a few steps at a time. State lives in Postgres; an interrupted run resumes on the next tick. "
        "No retries on this node: the next tick is the retry.", run_now=("Advance pipeline",))

    # 5 — Publishing. Runs every 15 minutes; the service publishes only slots that are due.
    wfs["5-publishing.tseAgencyPub01.json"] = workflow(
        "tseAgencyPub01", "TSE Agency — 5 Publishing",
        [schedule("Every 15 minutes", "*/15 * * * *", [0, 0]),
         agency("Publish due slot", "POST", "/v1/publish", [240, 0], {}, timeout_ms=300_000, retries=0),
         if_true("Something happened?", "={{ ['done','partial','failed','preflight_failed'].includes($json.result.status) }}",
                 [480, 0]),
         discord("Report publication",
                 "={{ ($json.result.mode === 'dry_run' ? '🧪 DRY RUN ' : '📣 ') + 'Slot result: **' + $json.result.status"
                 " + '** — creative #' + $json.result.creative_id + '\\n' + JSON.stringify($json.result.platforms || $json.result.problems || {}) }}",
                 [720, -80])],
        {**chain("Every 15 minutes", "Publish due slot", "Something happened?"),
         "Something happened?": {"main": [[{"node": "Report publication", "type": "main", "index": 0}], []]}},
        "Stage: publishing. Fires every 15 minutes so the 08:00/20:00 slots (configurable in the service's "
        "settings, not here) are met to within the quarter-hour. Duplicate-safe by construction: the service "
        "locks the slot, writes one row per creative+platform under a UNIQUE constraint, and reconciles "
        "interrupted calls against Meta instead of re-posting. No n8n retries — never retry a publish blindly.",
        run_now=("Publish due slot",))

    # 6 — Performance: daily metrics, Monday report.
    wfs["6-performance.tseAgencyPerf01.json"] = workflow(
        "tseAgencyPerf01", "TSE Agency — 6 Performance",
        [schedule("Daily 06:15", "15 6 * * *", [0, 0]),
         agency("Collect Meta metrics", "POST", "/v1/metrics/collect", [240, 0], {}, timeout_ms=300_000),
         schedule("Monday 07:30", "30 7 * * 1", [0, 220]),
         agency("Weekly report", "POST", "/v1/report/weekly", [240, 220], {}),
         if_true("Report created?", "={{ $json.result.created === true }}", [480, 220]),
         discord("Post weekly report",
                 "={{ '📊 **TSE ads — week of ' + $json.result.week_start + '**\\n' + $json.result.summary.headline_summary"
                 " + '\\n\\n**Next week:** ' + $json.result.summary.next_week_guidance }}", [720, 160])],
        {**chain("Daily 06:15", "Collect Meta metrics"), **chain("Monday 07:30", "Weekly report", "Report created?"),
         "Report created?": {"main": [[{"node": "Post weekly report", "type": "main", "index": 0}], []]}},
        "Stage: performance analysis. Metrics feed the weekly report, which feeds the next planning cycle.",
        run_now=("Collect Meta metrics", "Weekly report"))

    # 7 — Monitoring and recovery.
    wfs["7-monitoring.tseAgencyMon01.json"] = workflow(
        "tseAgencyMon01", "TSE Agency — 7 Monitoring",
        [schedule("Hourly", "5 * * * *", [0, 0]),
         agency("Recover", "POST", "/v1/recover", [240, 0], {}),
         agency("Claim alerts", "POST", "/v1/alerts/claim", [480, 0], {}),
         code("One item per alert", "return (($json.result && $json.result.alerts) || []).map(a => ({ json: a }));", [720, 0]),
         discord("Send alert", "={{ '🚨 **TSE agency** [' + $json.stage + '] ' + $json.message }}", [960, 0]),
         schedule("Daily 07:00", "0 7 * * *", [0, 220]),
         agency("Health", "GET", "/v1/health", [240, 220], timeout_ms=60_000),
         discord("Daily digest",
                 "={{ ($json.result.ok ? '🟢' : '🟠') + ' **TSE agency daily** — mode ' + $json.result.mode"
                 " + ' (effective ' + $json.result.effective_mode + ')' + ($json.result.paused ? ' · **PAUSED**' : '')"
                 " + '\\nQueue: ' + $json.result.queue.days_covered + ' days ready (' + $json.result.queue.approved_slots + '/'"
                 " + $json.result.queue.expected_slots + ' slots)'"
                 " + '\\nSpend this month: visual $' + $json.result.spend_month_usd.visual + ' / $' + $json.result.spend_month_usd.visual_limit"
                 " + ' · Claude $' + $json.result.spend_month_usd.claude"
                 " + ($json.result.problems.length ? '\\nProblems: ' + $json.result.problems.join('; ') : '') }}", [480, 220])],
        {**chain("Hourly", "Recover", "Claim alerts", "One item per alert", "Send alert"),
         **chain("Daily 07:00", "Health", "Daily digest")},
        "Stage: monitoring. Hourly: release expired leases, flag interrupted publications, deliver new alerts "
        "(each exactly once). Daily: queue depth, spend against limits, mode and pause state.",
        run_now=("Recover", "Health"))

    # Error workflow for all of the above: n8n-level failures (service down, auth broken).
    wfs["0-alert.tseAgencyAlert01.json"] = workflow(
        ERROR_WORKFLOW_ID, "TSE Agency — Failure Alert",
        [{"id": _id("Error Trigger"), "name": "Error Trigger", "type": "n8n-nodes-base.errorTrigger", "typeVersion": 1,
          "position": [0, 0], "parameters": {}},
         discord("Alert", "={{ '🚨 **TSE agency workflow FAILED**\\nWorkflow: **' + $json.workflow.name + '**\\nNode: `'"
                          " + ($json.execution.lastNodeExecuted || 'unknown') + '`\\nError: '"
                          " + ($json.execution.error ? $json.execution.error.message : 'unknown') }}", [240, 0])],
        chain("Error Trigger", "Alert"), "Error workflow wired into every TSE Agency workflow.", error_wf=False)
    return wfs


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for fname, wf in build().items():
        (OUT / fname).write_text(json.dumps(wf, indent=2, ensure_ascii=False) + "\n")
        print("wrote", OUT / fname)
