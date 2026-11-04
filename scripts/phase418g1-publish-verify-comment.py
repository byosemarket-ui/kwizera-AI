#!/usr/bin/env python3
"""Publish redacted Phase 4.18G.1 verify JSON as a commit comment. Never prints tokens."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request

sha = (os.environ.get("COMMENT_SHA") or os.environ.get("EXPECT_SHA") or "").strip()
token = (os.environ.get("GITHUB_TOKEN") or "").strip()
repo = (os.environ.get("GITHUB_REPOSITORY") or "").strip()
exit_code = (os.environ.get("G1_EXIT_CODE") or "").strip() or "?"

raw = sys.stdin.read()
raw = re.sub(r"(?i)KWIZERA_ADMIN_API_TOKEN\s*=\s*\S+", "KWIZERA_ADMIN_API_TOKEN=***REDACTED***", raw)
raw = re.sub(r"(?i)Bearer\s+[A-Za-z0-9._\-]+", "Bearer ***REDACTED***", raw)
raw = re.sub(r"sk-[A-Za-z0-9]{8,}", "***REDACTED***", raw)

# Keep the trailing JSON object if present.
tail = raw.strip().split("\n")
json_block = "\n".join(tail[-700:]) if len(tail) > 700 else "\n".join(tail)

body = (
  "### Phase 4.18G.1 result-intake verify (redacted)\n\n"
  f"expectSha=`{sha}` exit=`{exit_code}`\n\n"
  "```json\n"
  f"{json_block}\n"
  "```\n\n"
  "Analysis-result intake only. placesOrders=false. mutatesBroker=false.\n"
)

if not sha or not token or not repo:
  print("missing COMMENT_SHA/GITHUB_TOKEN/GITHUB_REPOSITORY", file=sys.stderr)
  sys.exit(0)

url = f"https://api.github.com/repos/{repo}/commits/{sha}/comments"
req = urllib.request.Request(
  url,
  data=json.dumps({"body": body}).encode("utf-8"),
  headers={
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
  method="POST",
)
try:
  with urllib.request.urlopen(req, timeout=30) as res:
    print(f"comment_http={res.status}")
except urllib.error.HTTPError as e:
  print(f"comment_http={e.code}", file=sys.stderr)
  sys.exit(0)
