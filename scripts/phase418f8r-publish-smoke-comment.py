#!/usr/bin/env python3
"""Publish a redacted Phase 4.18F.8R System Master smoke excerpt as a commit comment."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request

raw = sys.stdin.read()
m = None
for match in re.finditer(r"\{[\s\S]*\}", raw):
    m = match
text = m.group(0) if m else raw[-20000:]

try:
    obj = json.loads(text)
    slim = {
        "phase": obj.get("phase"),
        "expectSha": obj.get("expectSha"),
        "instrument": obj.get("instrument"),
        "timeframe": obj.get("timeframe"),
        "usedAnalyzeNow": obj.get("usedAnalyzeNow"),
        "labels": obj.get("labels"),
        "blockers": obj.get("blockers"),
        "tests": obj.get("tests"),
        "cycles": obj.get("cycles"),
        "historyCycles": (obj.get("historyCycles") or [])[:6],
        "placesOrders": obj.get("placesOrders"),
        "acceptsForExecution": obj.get("acceptsForExecution"),
        "mutatesBroker": obj.get("mutatesBroker"),
    }
    payload = json.dumps(slim, indent=2)[:18000]
except Exception as exc:  # noqa: BLE001
    payload = text[-12000:] + f"\nparse_error {str(exc)[:120]}"

expect = os.environ.get("EXPECT_SHA") or os.environ.get("COMMENT_SHA") or os.environ.get("GITHUB_SHA") or ""
rc = os.environ.get("F8R_EXIT_CODE") or ""
body = "\n".join(
    [
        "### Phase 4.18F.8R System Master smoke (redacted)",
        "",
        f"expectSha=`{expect}` exit=`{rc}`",
        "",
        "```json",
        payload,
        "```",
        "",
        "System Master ON/OFF + scheduled analysis. placesOrders=false. No analyze-now.",
    ]
)

token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
repo = os.environ.get("GITHUB_REPOSITORY") or ""
if not token or not repo or not expect:
    print("commit_comment_skip_missing_env", file=sys.stderr)
    sys.exit(0)

url = f"https://api.github.com/repos/{repo}/commits/{expect}/comments"
req = urllib.request.Request(
    url,
    data=json.dumps({"body": body}).encode("utf-8"),
    method="POST",
    headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "kwizera-f8r-smoke",
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        print("commit_comment_published", resp.status)
except urllib.error.HTTPError as err:
    print(f"commit_comment_http_{err.code}", file=sys.stderr)
    sys.exit(0)
except Exception as exc:  # noqa: BLE001
    print(f"commit_comment_error:{str(exc)[:120]}", file=sys.stderr)
    sys.exit(0)
