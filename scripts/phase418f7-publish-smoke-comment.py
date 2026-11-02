#!/usr/bin/env python3
"""Publish a redacted Phase 4.18F.7 multimodal smoke excerpt as a commit comment."""
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
text = m.group(0) if m else raw[-16000:]

try:
    obj = json.loads(text)
    slim = {
        "phase": obj.get("phase"),
        "expectSha": obj.get("expectSha"),
        "instrument": obj.get("instrument"),
        "timeframe": obj.get("timeframe"),
        "labels": obj.get("labels"),
        "blockers": obj.get("blockers"),
        "checks": {
            "health": (obj.get("checks") or {}).get("health"),
            "version": (obj.get("checks") or {}).get("version"),
            "sidecar": (obj.get("checks") or {}).get("sidecar"),
            "dashboard": (obj.get("checks") or {}).get("dashboard"),
            "verify": (obj.get("checks") or {}).get("verify"),
            "monitorStatus": (obj.get("checks") or {}).get("monitorStatus"),
            "monitorAnalyzeNow": (obj.get("checks") or {}).get("monitorAnalyzeNow"),
            "monitorAfterAnalyze": (obj.get("checks") or {}).get("monitorAfterAnalyze"),
            "openaiStatus": (obj.get("checks") or {}).get("openaiStatus"),
            "atStatus": {
                k: ((obj.get("checks") or {}).get("atStatus") or {}).get(k)
                for k in (
                    "http",
                    "selectedEnvironment",
                    "placesOrders",
                    "acceptsForExecution",
                    "mutatesBroker",
                )
            },
        },
        "placesOrders": obj.get("placesOrders"),
        "acceptsForExecution": obj.get("acceptsForExecution"),
        "mutatesBroker": obj.get("mutatesBroker"),
    }
    payload = json.dumps(slim, indent=2)[:16000]
except Exception as exc:  # noqa: BLE001
    payload = text[-10000:] + f"\nparse_error {str(exc)[:120]}"

expect = os.environ.get("EXPECT_SHA") or os.environ.get("COMMENT_SHA") or os.environ.get("GITHUB_SHA") or ""
rc = os.environ.get("F7_EXIT_CODE") or ""
body = "\n".join(
    [
        "### Phase 4.18F.7 multimodal image smoke (redacted)",
        "",
        f"expectSha=`{expect}` exit=`{rc}`",
        "",
        "```json",
        payload,
        "```",
        "",
        "Analysis-only. Image source SERVER_OHLC_RENDER (not Trading Station). placesOrders=false.",
    ]
)

token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
repo = os.environ.get("GITHUB_REPOSITORY") or ""
sha = expect
if not token or not repo or not sha:
    print("commit_comment_skipped missing token/repo/sha", file=sys.stderr)
    sys.exit(0)

url = f"https://api.github.com/repos/{repo}/commits/{sha}/comments"
req = urllib.request.Request(
    url,
    data=json.dumps({"body": body}).encode("utf-8"),
    method="POST",
    headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "kwizera-phase418f7-smoke",
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        print(f"commit_comment_ok status={resp.status}")
except urllib.error.HTTPError as err:
    print(f"commit_comment_http_error {err.code}", file=sys.stderr)
    sys.exit(0)
except Exception as exc:  # noqa: BLE001
    print(f"commit_comment_failed {str(exc)[:160]}", file=sys.stderr)
    sys.exit(0)
