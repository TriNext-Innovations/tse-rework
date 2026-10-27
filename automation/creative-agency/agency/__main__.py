"""Operator CLI.  python -m agency <command>"""

from __future__ import annotations

import argparse
import json
import sys

from . import factcheck, memory, ops, pipeline, publisher
from .app import build_ctx


def _print(obj) -> None:
    print(json.dumps(obj, indent=2, default=str))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="agency", description="TSE creative agency")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate", help="apply database migrations and default settings")
    s = sub.add_parser("serve", help="run the HTTP service")
    s.add_argument("--port", type=int, default=8080)
    sub.add_parser("plan", help="plan any unplanned week in the next 14 days")
    c = sub.add_parser("cycle", help="advance development/production/QC a few steps")
    c.add_argument("--steps", type=int, default=8)
    sub.add_parser("publish", help="publish the next due slot (respects mode and pause)")
    sub.add_parser("recover", help="release expired leases, flag interrupted publications")
    sub.add_parser("health", help="queue, spend and pipeline status")
    sub.add_parser("settings", help="show operating settings")
    st = sub.add_parser("set", help="change a setting, e.g. set mode '\"review\"'")
    st.add_argument("key")
    st.add_argument("value", help="JSON value")
    sub.add_parser("pause", help="stop all publishing immediately")
    sub.add_parser("resume", help="allow publishing again")
    m = sub.add_parser("mode", help="dry_run | review | autonomous")
    m.add_argument("mode", choices=["dry_run", "review", "autonomous"])
    r = sub.add_parser("review", help="human decision on a creative")
    r.add_argument("creative_id", type=int)
    r.add_argument("decision", choices=["approved", "rejected"])
    r.add_argument("--note")
    sub.add_parser("facts-verify", help="re-check every fact against the live site")
    ms = sub.add_parser("memory", help="search all concepts ever written")
    ms.add_argument("query")
    sub.add_parser("upcoming", help="the next 14 days of slots")
    sub.add_parser("report", help="weekly performance report for last week")
    d = sub.add_parser("demo", help="offline end-to-end dry run with fakes")
    d.add_argument("--slots", type=int, default=4)
    args = p.parse_args(argv)

    if args.cmd == "serve":
        from .server import serve
        serve(port=args.port)
        return 0
    if args.cmd == "demo":
        from .demo import run_demo
        return run_demo(args.slots)

    ctx = build_ctx()
    if args.cmd == "migrate":
        _print({"applied": ctx.db.migrate()})
    elif args.cmd == "plan":
        _print(pipeline.ensure_planned(ctx))
    elif args.cmd == "cycle":
        _print(pipeline.cycle(ctx, args.steps))
    elif args.cmd == "publish":
        _print(publisher.publish_due(ctx))
    elif args.cmd == "recover":
        _print(ops.recover(ctx))
    elif args.cmd == "health":
        _print(ops.health(ctx))
    elif args.cmd == "settings":
        _print(ctx.db.settings())
    elif args.cmd == "set":
        ctx.db.set_setting(args.key, json.loads(args.value), by="cli")
        _print(ctx.db.settings())
    elif args.cmd == "pause":
        ctx.db.set_setting("publishing_paused", True, by="cli")
        print("publishing PAUSED")
    elif args.cmd == "resume":
        ctx.db.set_setting("publishing_paused", False, by="cli")
        print("publishing resumed")
    elif args.cmd == "mode":
        ctx.db.set_setting("mode", args.mode, by="cli")
        _print(publisher.effective_mode(ctx, ctx.db.settings()))
    elif args.cmd == "review":
        _print(ops.review(ctx, args.creative_id, args.decision, args.note, by="cli"))
    elif args.cmd == "facts-verify":
        _print(factcheck.verify(ctx.db))
    elif args.cmd == "memory":
        _print(memory.search(ctx.db, args.query))
    elif args.cmd == "upcoming":
        _print(ops.upcoming(ctx))
    elif args.cmd == "report":
        _print(ops.weekly_report(ctx))
    return 0


if __name__ == "__main__":
    sys.exit(main())
