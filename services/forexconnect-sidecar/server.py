#!/usr/bin/env python3
"""
KWIZERA ForexConnect sidecar — Phase 33.
Binds to localhost only. Wraps official forexconnect SDK when installed.
Never logs passwords or returns secrets.
"""
from __future__ import annotations

import json
import os
import re
import threading
import traceback
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional
from urllib.parse import urlparse

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5179
DEFAULT_URL = "https://www.fxcorporate.com/Hosts.jsp"

_state_lock = threading.RLock()
_fx: Any = None
_state: dict[str, Any] = {
    "status": "DISCONNECTED",
    "errorCode": None,
    "errorMessage": None,
    "connectedAt": None,
    "lastInstrumentAt": None,
    "instrumentCount": 0,
    "instruments": [],
    "sdkAvailable": False,
    "sdkImportError": None,
    "environment": "demo",
    "connectionLabel": "Demo",
    "usernameConfigured": False,
    "enabled": False,
    "connecting": False,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _truthy(raw: Optional[str]) -> bool:
    return str(raw or "").strip().lower() in ("1", "true", "yes", "on")


def _env(name: str, default: str = "") -> str:
    return str(os.environ.get(name, default) or "").strip()


def _sanitize(message: str) -> str:
    text = str(message or "")
    password = _env("KWIZERA_FOREXCONNECT_PASSWORD")
    if password and len(password) >= 4:
        text = text.replace(password, "[redacted]")
    text = re.sub(r"(?i)(password|passwd|pwd)\s*[:=]\s*\S+", r"\1=[redacted]", text)
    text = re.sub(r"[0-9a-f]{32,}", "[redacted]", text, flags=re.I)
    return text[:500]


def _probe_sdk() -> tuple[bool, Optional[str]]:
    try:
        import forexconnect  # noqa: F401
        return True, None
    except Exception as exc:  # pragma: no cover - depends on host
        return False, _sanitize(f"{type(exc).__name__}: {exc}")


def _config_snapshot() -> dict[str, Any]:
    enabled = _truthy(_env("KWIZERA_FOREXCONNECT_ENABLED"))
    environment = _env("KWIZERA_FOREXCONNECT_ENVIRONMENT", "demo").lower()
    if environment in ("live", "production", "prod", "real"):
        environment = "real"
    else:
        environment = "demo"
    username = _env("KWIZERA_FOREXCONNECT_USERNAME")
    password = _env("KWIZERA_FOREXCONNECT_PASSWORD")
    return {
        "enabled": enabled,
        "environment": environment,
        "connectionLabel": "Real" if environment == "real" else "Demo",
        "url": _env("KWIZERA_FOREXCONNECT_URL", DEFAULT_URL) or DEFAULT_URL,
        "usernameConfigured": bool(username),
        "passwordConfigured": bool(password) and len(password) >= 4,
        "sessionIdConfigured": bool(_env("KWIZERA_FOREXCONNECT_SESSION_ID")),
        "pinConfigured": bool(_env("KWIZERA_FOREXCONNECT_PIN")),
    }


def _safe_status() -> dict[str, Any]:
    cfg = _config_snapshot()
    sdk_ok, sdk_err = _probe_sdk()
    with _state_lock:
        status = str(_state["status"])
        if not cfg["enabled"]:
            status = "DISABLED"
        elif not (cfg["usernameConfigured"] and cfg["passwordConfigured"]):
            if status not in ("CONNECTED", "AUTHENTICATION_FAILED", "SDK_UNAVAILABLE", "ERROR"):
                status = "NOT_CONFIGURED"
        elif not sdk_ok and status != "CONNECTED":
            status = "SDK_UNAVAILABLE"
        payload = {
            "ok": True,
            "provider": "FOREXCONNECT",
            "apiPath": "FXCM ForexConnect SDK (sidecar)",
            "status": status,
            "enabled": cfg["enabled"],
            "configured": bool(cfg["usernameConfigured"] and cfg["passwordConfigured"]),
            "environment": cfg["environment"],
            "environmentLabel": "FXCM REAL" if cfg["environment"] == "real" else "FXCM DEMO",
            "connectionLabel": cfg["connectionLabel"],
            "urlHost": urlparse(cfg["url"]).hostname or "",
            "usernameConfigured": cfg["usernameConfigured"],
            "passwordConfigured": cfg["passwordConfigured"],
            "sdkAvailable": sdk_ok,
            "sdkImportError": sdk_err,
            "connecting": bool(_state["connecting"]),
            "connectedAt": _state["connectedAt"],
            "lastInstrumentAt": _state["lastInstrumentAt"],
            "instrumentCount": int(_state["instrumentCount"] or 0),
            "errorCode": _state["errorCode"],
            "errorMessage": _state["errorMessage"],
            "trading": "DISABLED",
            "note": (
                "ForexConnect sidecar. Trading disabled. "
                "CONNECTED only after authenticated SDK session."
            ),
            "checkedAt": _now_iso(),
        }
    return payload


def _set_error(code: str, message: str, status: str) -> None:
    with _state_lock:
        _state["status"] = status
        _state["errorCode"] = code
        _state["errorMessage"] = _sanitize(message)
        _state["connecting"] = False


def _logout_locked() -> None:
    global _fx
    if _fx is not None:
        try:
            _fx.logout()
        except Exception:
            pass
        try:
            # context-manager style cleanup if available
            close = getattr(_fx, "__exit__", None)
            if callable(close):
                close(None, None, None)
        except Exception:
            pass
        _fx = None
    _state["connectedAt"] = None
    _state["instruments"] = []
    _state["instrumentCount"] = 0
    _state["lastInstrumentAt"] = None


def _row_get(row: Any, *names: str) -> Any:
    for name in names:
        try:
            if hasattr(row, name):
                value = getattr(row, name)
                if callable(value):
                    continue
                if value is not None and value != "":
                    return value
        except Exception:
            pass
        try:
            value = row[name]
            if value is not None and value != "":
                return value
        except Exception:
            pass
    return None


def _normalize_offer(row: Any) -> Optional[dict[str, Any]]:
    instrument = _row_get(row, "instrument", "Instrument", "symbol", "Symbol")
    if instrument is None:
        return None
    provider_symbol = str(instrument).strip()
    if not provider_symbol:
        return None
    canonical = re.sub(r"[^A-Za-z0-9]", "", provider_symbol).upper()
    parts = re.split(r"[/\s_-]+", provider_symbol)
    base = parts[0].upper() if parts else None
    quote = parts[1].upper() if len(parts) > 1 else None
    offer_id = _row_get(row, "offer_id", "OfferID", "offerId")
    return {
        "provider": "FOREXCONNECT",
        "providerSymbol": provider_symbol,
        "canonicalSymbol": canonical,
        "displaySymbol": provider_symbol if "/" in provider_symbol else (
            f"{base}/{quote}" if base and quote else provider_symbol
        ),
        "marketType": "FOREX",
        "baseAsset": base,
        "quoteAsset": quote,
        "status": "available",
        "offerId": str(offer_id) if offer_id is not None else None,
        "source": "forexconnect-offers",
    }


def _discover_instruments(fx: Any) -> list[dict[str, Any]]:
    from forexconnect import ForexConnect

    offers = fx.get_table(ForexConnect.OFFERS)
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in offers:
        item = _normalize_offer(row)
        if not item:
            continue
        key = item["canonicalSymbol"]
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    out.sort(key=lambda x: x["providerSymbol"])
    return out


def connect_session() -> dict[str, Any]:
    global _fx
    cfg = _config_snapshot()
    if not cfg["enabled"]:
        _set_error("FOREXCONNECT_DISABLED", "ForexConnect is disabled.", "DISABLED")
        return _safe_status()
    if not (cfg["usernameConfigured"] and cfg["passwordConfigured"]):
        _set_error(
            "FOREXCONNECT_NOT_CONFIGURED",
            "Set KWIZERA_FOREXCONNECT_USERNAME and KWIZERA_FOREXCONNECT_PASSWORD on the server.",
            "NOT_CONFIGURED",
        )
        return _safe_status()

    sdk_ok, sdk_err = _probe_sdk()
    if not sdk_ok:
        _set_error(
            "FOREXCONNECT_SDK_UNAVAILABLE",
            sdk_err or "forexconnect Python package is not installed on this host.",
            "SDK_UNAVAILABLE",
        )
        return _safe_status()

    with _state_lock:
        if _state["connecting"]:
            return _safe_status()
        _state["connecting"] = True
        _state["status"] = "CONNECTING"
        _state["errorCode"] = None
        _state["errorMessage"] = None

    try:
        from forexconnect import ForexConnect

        username = _env("KWIZERA_FOREXCONNECT_USERNAME")
        password = _env("KWIZERA_FOREXCONNECT_PASSWORD")
        url = cfg["url"]
        connection = cfg["connectionLabel"]
        session_id = _env("KWIZERA_FOREXCONNECT_SESSION_ID") or None
        pin = _env("KWIZERA_FOREXCONNECT_PIN") or None

        with _state_lock:
            _logout_locked()

        fx = ForexConnect()
        fx.login(username, password, url, connection, session_id, pin)

        instruments = _discover_instruments(fx)
        with _state_lock:
            _fx = fx
            _state["status"] = "CONNECTED"
            _state["connectedAt"] = _now_iso()
            _state["instruments"] = instruments
            _state["instrumentCount"] = len(instruments)
            _state["lastInstrumentAt"] = _now_iso()
            _state["errorCode"] = None
            _state["errorMessage"] = None
            _state["connecting"] = False
        return _safe_status()
    except Exception as exc:
        with _state_lock:
            _logout_locked()
        msg = _sanitize(str(exc))
        lower = msg.lower()
        if "login" in lower or "auth" in lower or "password" in lower or "denied" in lower:
            _set_error("FOREXCONNECT_AUTHENTICATION_FAILED", msg, "AUTHENTICATION_FAILED")
        else:
            _set_error("FOREXCONNECT_ERROR", msg, "ERROR")
        return _safe_status()


def disconnect_session() -> dict[str, Any]:
    with _state_lock:
        _logout_locked()
        cfg = _config_snapshot()
        if not cfg["enabled"]:
            _state["status"] = "DISABLED"
        elif not (cfg["usernameConfigured"] and cfg["passwordConfigured"]):
            _state["status"] = "NOT_CONFIGURED"
        else:
            _state["status"] = "DISCONNECTED"
        _state["errorCode"] = None
        _state["errorMessage"] = None
        _state["connecting"] = False
    return _safe_status()


def instruments_payload() -> dict[str, Any]:
    status = _safe_status()
    if status["status"] != "CONNECTED":
        return {
            "ok": False,
            "error": {
                "code": status.get("errorCode") or f"FOREXCONNECT_{status['status']}",
                "message": status.get("errorMessage")
                or "ForexConnect is not connected. Call POST /connect first.",
            },
            "status": status,
        }
    with _state_lock:
        instruments = list(_state["instruments"])
        count = int(_state["instrumentCount"] or 0)
        fetched_at = _state["lastInstrumentAt"]
    return {
        "ok": True,
        "count": count,
        "instruments": instruments,
        "fetchedAt": fetched_at,
        "status": status,
        "note": "Instruments from authenticated ForexConnect Offers table. No fabricated entries.",
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "KWIZERA-ForexConnect/33"

    def log_message(self, fmt: str, *args: Any) -> None:
        # Avoid logging request bodies / credentials.
        try:
            msg = fmt % args
        except Exception:
            msg = str(fmt)
        print(f"[forexconnect-sidecar] {_sanitize(msg)}", flush=True)

    def _send(self, code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8", errors="replace").strip()
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/health":
            self._send(200, {"ok": True, "service": "forexconnect-sidecar", "checkedAt": _now_iso()})
            return
        if path == "/status":
            self._send(200, _safe_status())
            return
        if path == "/instruments":
            payload = instruments_payload()
            self._send(200 if payload.get("ok") else 503, payload)
            return
        self._send(404, {"ok": False, "error": {"code": "NOT_FOUND", "message": "Unknown route."}})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        _ = self._read_json()  # consume body; ignore client credentials
        if path == "/connect":
            result = connect_session()
            code = 200 if result.get("status") == "CONNECTED" else 503
            self._send(code, {"ok": result.get("status") == "CONNECTED", **result})
            return
        if path == "/disconnect":
            result = disconnect_session()
            self._send(200, {"ok": True, **result})
            return
        self._send(404, {"ok": False, "error": {"code": "NOT_FOUND", "message": "Unknown route."}})


def main() -> None:
    host = _env("KWIZERA_FOREXCONNECT_SIDECAR_HOST", DEFAULT_HOST) or DEFAULT_HOST
    if host not in ("127.0.0.1", "localhost", "::1"):
        # Hard safety: never bind publicly.
        host = DEFAULT_HOST
    port = int(_env("KWIZERA_FOREXCONNECT_SIDECAR_PORT", str(DEFAULT_PORT)) or DEFAULT_PORT)
    sdk_ok, sdk_err = _probe_sdk()
    print(
        f"[forexconnect-sidecar] starting on {host}:{port} sdkAvailable={sdk_ok}"
        + (f" importError={sdk_err}" if sdk_err else ""),
        flush=True,
    )
    server = ThreadingHTTPServer((host, port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        with _state_lock:
            _logout_locked()
        server.server_close()


if __name__ == "__main__":
    main()
