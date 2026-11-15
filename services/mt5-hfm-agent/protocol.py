"""Framing + HMAC helpers for the HFM MT5 Demo agent (stdlib only)."""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import struct
from typing import Any

MAX_REQUEST_BYTES = 8192
MAX_RESPONSE_BYTES = 65536
TIMESTAMP_WINDOW_SEC = 30

ALLOWED_METHODS = frozenset(
    {
        "health",
        "demo.login",
        "demo.account_snapshot",
        "demo.quotes_snapshot",
        "demo.candles",
        "demo.symbols",
        "demo.open_positions_snapshot",
        "demo.pending_orders_snapshot",
        "demo.trade_history_snapshot",
        "demo.logout",
        "demo.connection_status",
    }
)

FORBIDDEN_PREFIX = re.compile(r"^(live\.|order\.|ea\.|shell\.|buy|sell|trade_)", re.I)
SECRET_KEY_RE = re.compile(r"pass|token|mac|secret|pwd|hmac", re.I)


def body_hash(body: dict[str, Any]) -> str:
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    return hmac.new(b"mt5-hfm-body", canonical.encode("utf-8"), hashlib.sha256).hexdigest()


def sign(token: str, request_id: str, ts: int, method: str, body: dict[str, Any]) -> str:
    msg = f"{request_id}|{ts}|{method}|{body_hash(body)}"
    return hmac.new(token.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_mac(token: str, req: dict[str, Any]) -> bool:
    expected = sign(token, str(req.get("requestId")), int(req.get("ts") or 0), str(req.get("method")), req.get("body") or {})
    got = str(req.get("mac") or "")
    if len(expected) != len(got):
        return False
    return hmac.compare_digest(expected, got)


def encode_frame(obj: dict[str, Any]) -> bytes:
    raw = json.dumps(obj, separators=(",", ":")).encode("utf-8")
    if len(raw) > MAX_RESPONSE_BYTES:
        raise ValueError("FRAME_TOO_LARGE")
    return struct.pack(">I", len(raw)) + raw


def try_decode_frame(buf: bytes) -> tuple[dict[str, Any], bytes] | tuple[None, bytes]:
    if len(buf) < 4:
        return None, buf
    (length,) = struct.unpack(">I", buf[:4])
    if length <= 0 or length > MAX_REQUEST_BYTES:
        raise ValueError("FRAME_TOO_LARGE")
    if len(buf) < 4 + length:
        return None, buf
    payload = buf[4 : 4 + length]
    rest = buf[4 + length :]
    obj = json.loads(payload.decode("utf-8"))
    if not isinstance(obj, dict):
        raise ValueError("MALFORMED")
    return obj, rest


def redact(value: Any) -> Any:
    if isinstance(value, list):
        return [redact(v) for v in value]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            out[k] = "[redacted]" if SECRET_KEY_RE.search(str(k)) else redact(v)
        return out
    return value


def is_forbidden_method(method: str) -> bool:
    return bool(FORBIDDEN_PREFIX.search(method)) or method not in ALLOWED_METHODS
