#!/usr/bin/env python3
"""Publish a redacted Phase 4.18F.2.1 live-observation excerpt as a commit comment."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

raw = sys.stdin.read()
m = None
for match in re.finditer(r"\{[\s\S]*\}", raw):
    m = match
text = m.group(0) if m else raw[-12000:]

slim: dict
try:
    obj = json.loads(text)
    outcomes = {}
    for k, v in (obj.get("instrumentOutcomes") or {}).items():
        last = v.get("last") or {}
        outcomes[k] = {
            "outcome": v.get("outcome"),
            "genuineChanges": v.get("genuineChanges"),
            "identicalSamples": v.get("identicalSamples"),
            "samples": v.get("samples"),
            "netBidMove": v.get("netBidMove"),
            "netAskMove": v.get("netAskMove"),
            "first": v.get("first"),
            "last": {
                kk: last.get(kk)
                for kk in (
                    "symbol",
                    "bid",
                    "ask",
                    "mid",
                    "spread",
                    "tradingStatus",
                    "eventClass",
                    "at",
                    "prevBid",
                    "prevAsk",
                )
                if kk in last
            },
        }
    evidence = obj.get("evidence") or {}
    slim = {
        "phase": obj.get("phase"),
        "focusInstrument": obj.get("focusInstrument"),
        "observeSeconds": obj.get("observeSeconds"),
        "labels": obj.get("labels"),
        "evidence": {
            "deployment": evidence.get("deployment"),
            "forexconnect": evidence.get("forexconnect"),
            "summary": evidence.get("summary"),
        },
        "instrumentOutcomes": outcomes,
        "blockers": obj.get("blockers"),
        "sampleCount": len(obj.get("samples") or []),
        "lastSample": (obj.get("samples") or [None])[-1],
    }
    payload = json.dumps(slim, indent=2)[:14000]
except Exception as exc:  # noqa: BLE001
    payload = text[-8000:] + f"\nparse_error {str(exc)[:120]}"

expect = os.environ.get("EXPECT_SHA") or os.environ.get("GITHUB_SHA") or ""
observe = os.environ.get("OBSERVE_SECONDS") or ""
rc = os.environ.get("OBS_EXIT_CODE") or ""
body = "\n".join(
    [
        "### Phase 4.18F.2.1 live observation (redacted)",
        "",
        f"expectSha=`{expect}` observeSeconds=`{observe}` exit=`{rc}`",
        "",
        "```json",
        payload,
        "```",
        "",
    ]
)

token = os.environ.get("GITHUB_TOKEN") or ""
repo = os.environ.get("GITHUB_REPOSITORY") or ""
sha = os.environ.get("COMMENT_SHA") or os.environ.get("GITHUB_SHA") or ""
if not token or not repo or not sha:
    print("skip_comment missing token/repo/sha", file=sys.stderr)
    sys.exit(0)

req = urllib.request.Request(
    f"https://api.github.com/repos/{repo}/commits/{sha}/comments",
    data=json.dumps({"body": body}).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "kwizera-phase418f2-live-obs",
    },
    method="POST",
)
with urllib.request.urlopen(req) as resp:
    print("commit_comment_status", resp.status)
