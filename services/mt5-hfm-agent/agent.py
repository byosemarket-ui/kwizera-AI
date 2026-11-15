#!/usr/bin/env python3
"""
KWIZERA HFM MT5 Demo Agent — AF_UNIX only, user mt5.

Security:
- No public TCP
- SO_PEERCRED allowlist
- HMAC agent token
- Replay window
- Operation allowlist
- Secrets redacted from logs
- Demo-only MT5 login via ephemeral /config INI
"""
from __future__ import annotations

import argparse
import logging
import os
import socket
import struct
import sys
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any

import mt5_control
import protocol

LOG = logging.getLogger("mt5-hfm-agent")

# Linux SO_PEERCRED
SOL_SOCKET = getattr(socket, "SOL_SOCKET", 1)
SO_PEERCRED = 17  # Linux

DEFAULT_SOCK = "/run/kwizera/mt5-hfm-agent.sock"
DEFAULT_TOKEN_FILE = "/run/kwizera/mt5-hfm-agent.token"


class NonceCache:
    def __init__(self, maxlen: int = 4096, ttl_sec: int = 60) -> None:
        self.maxlen = maxlen
        self.ttl = ttl_sec
        self._items: OrderedDict[str, float] = OrderedDict()

    def seen(self, request_id: str) -> bool:
        now = time.time()
        while self._items:
            k, ts = next(iter(self._items.items()))
            if now - ts > self.ttl:
                self._items.popitem(last=False)
            else:
                break
        if request_id in self._items:
            return True
        self._items[request_id] = now
        if len(self._items) > self.maxlen:
            self._items.popitem(last=False)
        return False


def load_token(path: str) -> str:
    p = Path(path)
    if not p.is_file():
        raise SystemExit(f"Agent token file missing: {path}")
    token = p.read_text(encoding="utf-8").strip()
    if len(token) < 16:
        raise SystemExit("Agent token too short")
    return token


def peer_uid(conn: socket.socket) -> int | None:
    try:
        creds = conn.getsockopt(SOL_SOCKET, SO_PEERCRED, struct.calcsize("3i"))
        pid, uid, gid = struct.unpack("3i", creds)
        LOG.info("peercred pid=%s uid=%s gid=%s", pid, uid, gid)
        return uid
    except OSError:
        return None


def allowed_uids() -> set[int]:
    raw = os.environ.get("KWIZERA_MT5_HFM_AGENT_ALLOW_UIDS", "").strip()
    if raw:
        return {int(x) for x in raw.split(",") if x.strip().isdigit()}
    # Defaults: resolve kwizera + mt5 if present
    uids: set[int] = set()
    try:
        import pwd

        for name in ("kwizera", "mt5"):
            try:
                uids.add(pwd.getpwnam(name).pw_uid)
            except KeyError:
                pass
    except ImportError:
        pass
    # Dev fallback: current uid
    uids.add(os.getuid())
    return uids


def respond(conn: socket.socket, obj: dict[str, Any]) -> None:
    # Never include secrets
    safe = protocol.redact(obj)
    conn.sendall(protocol.encode_frame(safe if isinstance(safe, dict) else obj))


def handle_request(token: str, nonces: NonceCache, req: dict[str, Any]) -> dict[str, Any]:
    request_id = str(req.get("requestId") or "")
    method = str(req.get("method") or "")
    ts = int(req.get("ts") or 0)
    body = req.get("body") if isinstance(req.get("body"), dict) else {}

    if req.get("v") != 1 or not request_id or not method:
        return {"v": 1, "requestId": request_id or "unknown", "ok": False, "code": "MALFORMED"}

    now = int(time.time())
    if abs(now - ts) > protocol.TIMESTAMP_WINDOW_SEC:
        return {"v": 1, "requestId": request_id, "ok": False, "code": "TIMESTAMP_SKEW"}

    if nonces.seen(request_id):
        return {"v": 1, "requestId": request_id, "ok": False, "code": "REPLAY"}

    if not protocol.verify_mac(token, req):
        return {"v": 1, "requestId": request_id, "ok": False, "code": "AUTH_FAILED"}

    if protocol.is_forbidden_method(method):
        return {"v": 1, "requestId": request_id, "ok": False, "code": "METHOD_FORBIDDEN"}

    try:
        if method == "health":
            result = {
                "status": "ok",
                "environment": "demo",
                "ordersEnabled": False,
                "mcp": mt5_control.mcp_status(),
                "terminalRunning": mt5_control.terminal_running(),
            }
        elif method == "demo.connection_status":
            result = mt5_control.connection_status()
        elif method == "demo.login":
            env = str(body.get("environment") or "demo").lower()
            if env != "demo":
                return {"v": 1, "requestId": request_id, "ok": False, "code": "LIVE_REJECTED"}
            login = str(body.get("login") or "")
            server = str(body.get("server") or "")
            password = str(body.get("password") or "")
            result = mt5_control.demo_login(login, server, password)
            password = ""
            body["password"] = ""
        elif method == "demo.account_snapshot":
            result = mt5_control.account_snapshot()
        elif method == "demo.quotes_snapshot":
            symbols = body.get("symbols") if isinstance(body.get("symbols"), list) else []
            result = mt5_control.quotes_snapshot([str(s) for s in symbols])
        elif method == "demo.candles":
            result = mt5_control.candles(
                str(body.get("symbol") or ""),
                str(body.get("timeframe") or ""),
                int(body.get("limit") or 100),
            )
        elif method == "demo.symbols":
            result = mt5_control.symbols_snapshot()
        elif method == "demo.open_positions_snapshot":
            result = mt5_control.open_positions_snapshot()
        elif method == "demo.pending_orders_snapshot":
            # Open-positions MCP tool returns positions + pending in current builds.
            result = mt5_control.open_positions_snapshot()
        elif method == "demo.trade_history_snapshot":
            result = mt5_control.trade_history_snapshot()
        elif method == "demo.logout":
            result = mt5_control.demo_logout()
        else:
            return {"v": 1, "requestId": request_id, "ok": False, "code": "METHOD_FORBIDDEN"}
        return {"v": 1, "requestId": request_id, "ok": True, "result": result}
    except ValueError as exc:
        code = str(exc) if str(exc).isupper() or "_" in str(exc) else "VALIDATION_ERROR"
        return {"v": 1, "requestId": request_id, "ok": False, "code": code, "error": code}
    except Exception:
        LOG.exception("handler_error method=%s", method)
        return {"v": 1, "requestId": request_id, "ok": False, "code": "INTERNAL_ERROR"}


def serve(sock_path: str, token: str, allow: set[int]) -> None:
    path = Path(sock_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(sock_path)
    os.chmod(sock_path, 0o660)
    server.listen(5)
    server.settimeout(5.0)
    nonces = NonceCache()
    LOG.info("listening on %s allow_uids=%s", sock_path, sorted(allow))

    while True:
        try:
            conn, _ = server.accept()
        except socket.timeout:
            continue
        with conn:
            conn.settimeout(5.0)
            uid = peer_uid(conn)
            if uid is None or uid not in allow:
                LOG.warning("peer_rejected uid=%s", uid)
                respond(conn, {"v": 1, "requestId": "unknown", "ok": False, "code": "PEER_REJECTED"})
                continue
            buf = b""
            try:
                while True:
                    chunk = conn.recv(65536)
                    if not chunk:
                        break
                    buf += chunk
                    req, buf = protocol.try_decode_frame(buf)
                    if req is None:
                        continue
                    redacted = protocol.redact(req)
                    method_log = redacted.get("method") if isinstance(redacted, dict) else "?"
                    LOG.info("request method=%s", method_log)
                    resp = handle_request(token, nonces, req)
                    respond(conn, resp)
                    break
            except ValueError as exc:
                code = "FRAME_TOO_LARGE" if "FRAME" in str(exc) else "MALFORMED"
                respond(conn, {"v": 1, "requestId": "unknown", "ok": False, "code": code})
            except Exception:
                LOG.exception("connection_error")


def main() -> None:
    parser = argparse.ArgumentParser(description="KWIZERA HFM MT5 Demo Agent")
    parser.add_argument("--socket", default=os.environ.get("KWIZERA_MT5_HFM_AGENT_SOCK", DEFAULT_SOCK))
    parser.add_argument("--token-file", default=os.environ.get("KWIZERA_MT5_HFM_AGENT_TOKEN_FILE", DEFAULT_TOKEN_FILE))
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='{"ts":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}',
    )
    token = load_token(args.token_file)
    allow = allowed_uids()
    serve(args.socket, token, allow)


if __name__ == "__main__":
    main()
