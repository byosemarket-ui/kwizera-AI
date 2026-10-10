#!/usr/bin/env python3
"""
KWIZERA ForexConnect sidecar — Phase 33/34/35.
Binds to localhost only. Wraps official forexconnect SDK when installed.
Historical: get_history (bid OHLC). Live: Offers table updates via Common.subscribe_table_updates.
Never logs passwords. Read-only — no trading.
"""
from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5179
DEFAULT_URL = "https://www.fxcorporate.com/Hosts.jsp"
MAX_CANDLES = 300
MAX_SUBSCRIPTIONS = 8

# Project timeframe → ForexConnect.get_history period id (exact 1:1 only).
TIMEFRAME_MAP: dict[str, str] = {
    "1m": "m1",
    "5m": "m5",
    "15m": "m15",
    "30m": "m30",
    "1h": "H1",
    "4h": "H4",
    "1d": "D1",
    "1w": "W1",
}
TIMEFRAME_MS: dict[str, int] = {
    "1m": 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
    "1w": 7 * 24 * 60 * 60_000,
}

_state_lock = threading.RLock()
_fx: Any = None
_offers_listener: Any = None
_offers_poller_stop = threading.Event()
_offers_poller_thread: Optional[threading.Thread] = None
_subscriptions: set[str] = set()  # provider symbols (e.g. EUR/USD)
_quotes: dict[str, dict[str, Any]] = {}  # canonical -> quote
_stream: dict[str, Any] = {
    "updateCount": 0,
    "lastQuoteAt": None,
    "lastStreamError": None,
    "offersListenerActive": False,
    # Phase 36E diagnostics — never include secrets.
    "callbackRegistered": False,
    "callbackInvocations": 0,
    "callbackAccepted": 0,
    "callbackFiltered": 0,
    "callbackNoBid": 0,
    "callbackParseFailures": 0,
    "pollCycles": 0,
    "pollChanges": 0,
    "lastEventSource": None,
    "lastCallbackAt": None,
    "lastPollChangeAt": None,
    "offersPollerActive": False,
}
_state: dict[str, Any] = {
    "status": "DISCONNECTED",
    "errorCode": None,
    "errorMessage": None,
    "connectedAt": None,
    "lastInstrumentAt": None,
    "lastHistoricalAt": None,
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
# Active session auth (localhost Node bridge may supply per-profile overrides).
# Password retained only for log redaction; never returned in HTTP payloads.
_session_auth: dict[str, Any] = {
    "username": None,
    "password": None,
    "environment": None,
    "connectionLabel": None,
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
    session_pwd = _session_auth.get("password")
    if isinstance(session_pwd, str) and len(session_pwd) >= 4:
        text = text.replace(session_pwd, "[redacted]")
    text = re.sub(r"(?i)(password|passwd|pwd)\s*[:=]\s*\S+", r"\1=[redacted]", text)
    text = re.sub(r"[0-9a-f]{32,}", "[redacted]", text, flags=re.I)
    return text[:500]


def _normalize_environment(raw: Any) -> tuple[str, str]:
    value = str(raw or "").strip().lower()
    if value in ("live", "real", "production", "prod"):
        return "real", "Real"
    return "demo", "Demo"


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
        session_env = _session_auth.get("environment")
        session_label = _session_auth.get("connectionLabel")
        session_user = bool(_session_auth.get("username"))
        session_pwd = bool(_session_auth.get("password")) and len(str(_session_auth.get("password") or "")) >= 4
        configured = bool(
            (cfg["usernameConfigured"] and cfg["passwordConfigured"])
            or (session_user and session_pwd)
            or status == "CONNECTED"
        )
        if not cfg["enabled"]:
            status = "DISABLED"
        elif not configured and status not in (
            "CONNECTED", "AUTHENTICATION_FAILED", "SDK_UNAVAILABLE", "ERROR", "CONNECTING",
        ):
            status = "NOT_CONFIGURED"
        elif not sdk_ok and status != "CONNECTED":
            status = "SDK_UNAVAILABLE"
        environment = session_env if session_env in ("demo", "real") else cfg["environment"]
        connection_label = session_label if session_label in ("Demo", "Real") else cfg["connectionLabel"]
        payload = {
            "ok": True,
            "provider": "FOREXCONNECT",
            "apiPath": "FXCM ForexConnect SDK (sidecar)",
            "status": status,
            "enabled": cfg["enabled"],
            "configured": configured,
            "environment": environment,
            "environmentLabel": "FXCM REAL" if environment == "real" else "FXCM DEMO",
            "connectionLabel": connection_label,
            "urlHost": urlparse(cfg["url"]).hostname or "",
            "usernameConfigured": bool(cfg["usernameConfigured"] or session_user),
            "passwordConfigured": bool(cfg["passwordConfigured"] or session_pwd),
            "sdkAvailable": sdk_ok,
            "sdkImportError": sdk_err,
            "connecting": bool(_state["connecting"]),
            "connectedAt": _state["connectedAt"],
            "lastInstrumentAt": _state["lastInstrumentAt"],
            "lastHistoricalAt": _state["lastHistoricalAt"],
            "instrumentCount": int(_state["instrumentCount"] or 0),
            "historicalCapable": status == "CONNECTED",
            "streamingCapable": status == "CONNECTED",
            "supportedTimeframes": sorted(TIMEFRAME_MAP.keys()),
            "priceBasis": "bid",
            "subscriptionCount": len(_subscriptions),
            "subscriptions": sorted(_subscriptions),
            "offersListenerActive": bool(_stream["offersListenerActive"]),
            "lastQuoteAt": _stream["lastQuoteAt"],
            "streamUpdateCount": int(_stream["updateCount"] or 0),
            "lastStreamError": _stream["lastStreamError"],
            "errorCode": _state["errorCode"],
            "errorMessage": _state["errorMessage"],
            "trading": "DISABLED",
            "note": (
                "ForexConnect sidecar. Trading disabled. "
                "Historical via get_history (bid OHLC). "
                "Live via Offers table updates (bid candle basis). "
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


def _reset_stream_diagnostics_locked() -> None:
    _stream["updateCount"] = 0
    _stream["lastQuoteAt"] = None
    _stream["lastStreamError"] = None
    _stream["callbackRegistered"] = False
    _stream["callbackInvocations"] = 0
    _stream["callbackAccepted"] = 0
    _stream["callbackFiltered"] = 0
    _stream["callbackNoBid"] = 0
    _stream["callbackParseFailures"] = 0
    _stream["pollCycles"] = 0
    _stream["pollChanges"] = 0
    _stream["lastEventSource"] = None
    _stream["lastCallbackAt"] = None
    _stream["lastPollChangeAt"] = None
    _stream["offersPollerActive"] = False


def _stop_offers_poller_locked() -> None:
    global _offers_poller_thread
    _offers_poller_stop.set()
    thread = _offers_poller_thread
    _offers_poller_thread = None
    _stream["offersPollerActive"] = False
    if thread is not None and thread.is_alive() and thread is not threading.current_thread():
        try:
            thread.join(timeout=1.5)
        except Exception:
            pass


def _stop_offers_listener_locked() -> None:
    global _offers_listener
    _stop_offers_poller_locked()
    if _offers_listener is not None:
        try:
            _offers_listener.unsubscribe()
        except Exception:
            pass
        _offers_listener = None
    _stream["offersListenerActive"] = False
    _stream["callbackRegistered"] = False
    _subscriptions.clear()
    _quotes.clear()
    # Drop seeded quote age — does not invent ticks; next subscribe re-seeds.
    _stream["lastQuoteAt"] = None
    _stream["updateCount"] = 0
    _stream["lastEventSource"] = None
    _stream["pollCycles"] = 0
    _stream["pollChanges"] = 0
    _stream["callbackInvocations"] = 0
    _stream["callbackAccepted"] = 0
    _stream["callbackFiltered"] = 0
    _stream["callbackNoBid"] = 0
    _stream["callbackParseFailures"] = 0
    _stream["lastCallbackAt"] = None
    _stream["lastPollChangeAt"] = None


def _logout_locked() -> None:
    global _fx
    _stop_offers_listener_locked()
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
    _state["lastHistoricalAt"] = None
    _reset_stream_diagnostics_locked()
    _session_auth["username"] = None
    _session_auth["password"] = None
    _session_auth["environment"] = None
    _session_auth["connectionLabel"] = None


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
    # Preserve dots in share symbols (AAPL.us) — only strip separators for canonical id.
    canonical = re.sub(r"[^A-Za-z0-9.]", "", provider_symbol).upper()
    parts = re.split(r"[/\s_-]+", provider_symbol)
    base = parts[0].upper() if parts else None
    quote = parts[1].upper() if len(parts) > 1 else None
    offer_id = _row_get(row, "offer_id", "OfferID", "offerId")
    instrument_type = _row_get(
        row,
        "instrument_type",
        "InstrumentType",
        "instrumentType",
        "InstrumentTypeID",
    )
    contract_currency = _row_get(
        row,
        "contract_currency",
        "ContractCurrency",
        "contractCurrency",
        "Currency",
    )
    description = _row_get(
        row,
        "instrument",
        "Instrument",
        "description",
        "Description",
        "name",
        "Name",
    )
    bid = _finite(_row_get(row, "bid", "Bid"))
    ask = _finite(_row_get(row, "ask", "Ask"))
    trading_status = _row_get(row, "trading_status", "TradingStatus", "tradingStatus")
    return {
        "provider": "FOREXCONNECT",
        "providerSymbol": provider_symbol,
        "canonicalSymbol": canonical,
        "displaySymbol": provider_symbol,
        "marketType": "FOREX",
        "baseAsset": base,
        "quoteAsset": quote,
        "status": "available",
        "offerId": str(offer_id) if offer_id is not None else None,
        "source": "forexconnect-offers",
        "description": str(description).strip() if description is not None else provider_symbol,
        "instrumentType": str(instrument_type) if instrument_type is not None else None,
        "contractCurrency": str(contract_currency) if contract_currency is not None else None,
        "bid": bid,
        "ask": ask,
        "tradingStatus": str(trading_status) if trading_status is not None else None,
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


def connect_session(overrides: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    global _fx
    cfg = _config_snapshot()
    overrides = overrides if isinstance(overrides, dict) else {}

    username = str(overrides.get("username") or "").strip() or _env("KWIZERA_FOREXCONNECT_USERNAME")
    password = str(overrides.get("password") or "").strip() or _env("KWIZERA_FOREXCONNECT_PASSWORD")
    if overrides.get("environment") is not None and str(overrides.get("environment") or "").strip():
        environment, connection = _normalize_environment(overrides.get("environment"))
    else:
        environment = cfg["environment"]
        connection = cfg["connectionLabel"]

    if not cfg["enabled"]:
        _set_error("FOREXCONNECT_DISABLED", "ForexConnect is disabled.", "DISABLED")
        return _safe_status()
    if not username or len(password) < 4:
        _set_error(
            "FOREXCONNECT_NOT_CONFIGURED",
            "ForexConnect credentials are not configured for the selected environment.",
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
        _session_auth["username"] = username
        _session_auth["password"] = password
        _session_auth["environment"] = environment
        _session_auth["connectionLabel"] = connection

    try:
        from forexconnect import ForexConnect

        url = cfg["url"]
        # Official ForexConnect.login(user_id, password, url, connection, session_id, pin)
        # connection must be "Demo" or "Real". Empty strings are preferred over None for optional fields.
        session_id = _env("KWIZERA_FOREXCONNECT_SESSION_ID") or ""
        pin = _env("KWIZERA_FOREXCONNECT_PIN") or ""

        with _state_lock:
            # Preserve intended auth while clearing prior SDK session.
            intended = dict(_session_auth)
            _logout_locked()
            _session_auth.update(intended)

        fx = ForexConnect()
        # Synchronous official login — waits for authenticated session or raises.
        fx.login(str(username), str(password), str(url), str(connection), session_id, pin)

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
            _session_auth["username"] = username
            _session_auth["password"] = password
            _session_auth["environment"] = environment
            _session_auth["connectionLabel"] = connection
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


def _resolve_instrument(symbol: str) -> Optional[dict[str, Any]]:
    compact = re.sub(r"[^A-Za-z0-9]", "", symbol).upper()
    slash = symbol.strip().upper() if "/" in symbol else None
    with _state_lock:
        instruments = list(_state["instruments"])
    for item in instruments:
        if item.get("canonicalSymbol") == compact:
            return item
        if str(item.get("providerSymbol", "")).upper() == slash:
            return item
        if str(item.get("providerSymbol", "")).upper() == symbol.strip().upper():
            return item
        if re.sub(r"[^A-Za-z0-9]", "", str(item.get("providerSymbol", ""))).upper() == compact:
            return item
    return None


def _finite(value: Any) -> Optional[float]:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if n == n and abs(n) != float("inf") else None  # noqa: PLR0124 — NaN check


def _validate_ohlc(o: float, h: float, l: float, c: float) -> bool:
    if h < l:
        return False
    if h < o or h < c:
        return False
    if l > o or l > c:
        return False
    return True


def _coerce_history_row(row: Any) -> Optional[dict[str, Any]]:
    """Turn numpy/pandas/tuple history rows into a plain dict for field access."""
    if isinstance(row, dict):
        return {str(k): v for k, v in row.items()}
    names = getattr(getattr(row, "dtype", None), "names", None)
    if names:
        try:
            return {str(n): row[n] for n in names}
        except Exception:
            pass
    if hasattr(row, "_asdict") and callable(row._asdict):
        try:
            return {str(k): v for k, v in row._asdict().items()}
        except Exception:
            pass
    try:
        seq = list(row)
    except Exception:
        seq = None
    if seq is not None and len(seq) >= 5 and not isinstance(row, (str, bytes)):
        keys = ["Date", "BidOpen", "BidHigh", "BidLow", "BidClose", "Volume"]
        return {keys[i]: seq[i] for i in range(min(len(seq), len(keys)))}
    return None


def _history_ts_sec(date_val: Any) -> Optional[int]:
    if date_val is None:
        return None
    if hasattr(date_val, "timestamp") and callable(getattr(date_val, "timestamp", None)):
        try:
            return int(date_val.timestamp())
        except Exception:
            pass
    try:
        import numpy as np  # type: ignore

        if isinstance(date_val, np.datetime64):
            return int(date_val.astype("datetime64[s]").astype(np.int64))
    except Exception:
        pass
    text = str(date_val).strip()
    if not text or text.lower() in {"nat", "none", "nan"}:
        return None
    # numpy datetime64 string often includes nanoseconds — trim for fromisoformat.
    if "." in text:
        head, rest = text.split(".", 1)
        digits = ""
        for ch in rest:
            if ch.isdigit():
                digits += ch
            else:
                break
        suffix = rest[len(digits):]
        text = f"{head}.{digits[:6]}{suffix}" if digits else f"{head}{suffix}"
    text = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return int(parsed.timestamp())
    except Exception:
        return None


def _row_to_candle(row: Any, timeframe_ms: int, now_ms: int) -> Optional[dict[str, Any]]:
    """Normalize one ForexConnect history bar (bid OHLC). Never invent values."""
    mapping = _coerce_history_row(row) or {}
    view: Any = mapping if mapping else row

    date_val = _row_get(view, "Date", "date", "Time", "time", "datetime")
    if date_val is None:
        date_val = _try_index(view, "Date")
    ts_sec = _history_ts_sec(date_val)
    if ts_sec is None or ts_sec <= 0:
        return None

    bid_open = _finite(_row_get(view, "BidOpen", "bidOpen", "Open", "open"))
    if bid_open is None:
        bid_open = _finite(_try_index(view, "BidOpen"))
    bid_high = _finite(_row_get(view, "BidHigh", "bidHigh", "High", "high"))
    if bid_high is None:
        bid_high = _finite(_try_index(view, "BidHigh"))
    bid_low = _finite(_row_get(view, "BidLow", "bidLow", "Low", "low"))
    if bid_low is None:
        bid_low = _finite(_try_index(view, "BidLow"))
    bid_close = _finite(_row_get(view, "BidClose", "bidClose", "Close", "close"))
    if bid_close is None:
        bid_close = _finite(_try_index(view, "BidClose"))
    volume_raw = _finite(_row_get(view, "Volume", "volume"))
    if volume_raw is None:
        volume_raw = _finite(_try_index(view, "Volume"))

    if bid_open is None or bid_high is None or bid_low is None or bid_close is None:
        return None
    if not _validate_ohlc(bid_open, bid_high, bid_low, bid_close):
        return None

    close_ms = (ts_sec * 1000) + timeframe_ms if timeframe_ms > 0 else ts_sec * 1000
    closed = close_ms <= now_ms if timeframe_ms > 0 else True
    volume = volume_raw if volume_raw is not None and volume_raw >= 0 else None

    return {
        "Date": datetime.fromtimestamp(ts_sec, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "time": ts_sec,
        "BidOpen": bid_open,
        "BidHigh": bid_high,
        "BidLow": bid_low,
        "BidClose": bid_close,
        "open": bid_open,
        "high": bid_high,
        "low": bid_low,
        "close": bid_close,
        "Volume": volume,
        "volume": volume,
        "closed": closed,
        "isClosed": closed,
        "priceBasis": "bid",
    }


def _try_index(row: Any, name: str) -> Any:
    try:
        return row[name]
    except Exception:
        return None


def _row_keys(row: Any) -> list[str]:
    if isinstance(row, dict):
        return [str(k) for k in row.keys()]
    if hasattr(row, "_fields"):
        try:
            return [str(k) for k in row._fields]
        except Exception:
            pass
    if hasattr(row, "dtype") and getattr(row.dtype, "names", None):
        return [str(k) for k in row.dtype.names]
    try:
        return [str(k) for k in dir(row) if not str(k).startswith("_")][:24]
    except Exception:
        return []


def _history_raw_len(history: Any) -> int:
    if history is None:
        return 0
    try:
        return int(len(history))
    except Exception:
        return -1


def _history_rows(history: Any) -> list[Any]:
    """Normalize ForexConnect get_history return types (DataFrame / ndarray / list)."""
    if history is None:
        return []
    # pandas DataFrame — list(df) yields column names, not rows.
    if hasattr(history, "to_dict") and callable(getattr(history, "to_dict", None)):
        try:
            records = history.to_dict("records")
            if isinstance(records, list):
                return records
        except Exception:
            pass
    if hasattr(history, "itertuples") and callable(getattr(history, "itertuples", None)):
        try:
            return list(history.itertuples(index=False))
        except Exception:
            pass
    # numpy structured array / ndarray
    if hasattr(history, "dtype") and hasattr(history, "__len__"):
        try:
            return [history[i] for i in range(len(history))]
        except Exception:
            pass
    try:
        return list(history)
    except Exception:
        return []


def candles_payload(symbol: str, timeframe: str, limit: int) -> dict[str, Any]:
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
            "candles": [],
            "count": 0,
        }

    tf = timeframe.strip().lower()
    # Accept canonical project ids (1m) or SDK ids (m1 / H1).
    period = TIMEFRAME_MAP.get(tf)
    project_tf = tf
    if period is None:
        for proj, pid in TIMEFRAME_MAP.items():
            if pid.lower() == tf.lower() or pid == timeframe.strip():
                period = pid
                project_tf = proj
                break
    if period is None:
        return {
            "ok": False,
            "error": {
                "code": "FOREXCONNECT_UNSUPPORTED_TIMEFRAME",
                "message": (
                    f'Unsupported timeframe "{timeframe}". '
                    f"Supported: {', '.join(sorted(TIMEFRAME_MAP.keys()))}."
                ),
            },
            "status": status,
            "candles": [],
            "count": 0,
        }

    quotes_count = max(1, min(MAX_CANDLES, int(limit)))
    instrument = _resolve_instrument(symbol)
    if instrument is None:
        # Refresh offers once before failing — session may have new instruments.
        with _state_lock:
            fx = _fx
        if fx is not None:
            try:
                refreshed = _discover_instruments(fx)
                with _state_lock:
                    _state["instruments"] = refreshed
                    _state["instrumentCount"] = len(refreshed)
                    _state["lastInstrumentAt"] = _now_iso()
            except Exception:
                pass
            instrument = _resolve_instrument(symbol)
    if instrument is None:
        return {
            "ok": False,
            "error": {
                "code": "FOREXCONNECT_UNKNOWN_INSTRUMENT",
                "message": (
                    f'Instrument "{symbol}" is not available in the authenticated ForexConnect session.'
                ),
            },
            "status": status,
            "candles": [],
            "count": 0,
        }

    provider_symbol = str(instrument["providerSymbol"])
    with _state_lock:
        fx = _fx
    if fx is None:
        return {
            "ok": False,
            "error": {
                "code": "FOREXCONNECT_DISCONNECTED",
                "message": "ForexConnect session is not active.",
            },
            "status": status,
            "candles": [],
            "count": 0,
        }

    date_to = datetime.now(timezone.utc).replace(tzinfo=None)
    lookback_days = {
        "m1": 3,
        "m5": 7,
        "m15": 14,
        "m30": 21,
        "H1": 60,
        "H4": 120,
        "D1": 365,
        "W1": 730,
    }.get(period, 60)
    date_from = date_to - timedelta(days=lookback_days)
    history = None
    history_error: Optional[str] = None
    history_mode = "dated"
    try:
        # Official API: get_history(instrument, timeframe, date_from, date_to, quotes_count)
        # Naive UTC datetimes are more compatible with the FXCM Python wrapper than tz-aware.
        history = fx.get_history(provider_symbol, period, date_from, date_to, quotes_count)
    except Exception as exc:
        history_error = _sanitize(str(exc))
        history = None

    # Fallback: some Demo builds accept quotes_count with open-ended dates.
    if history is None or _history_raw_len(history) == 0:
        try:
            history = fx.get_history(provider_symbol, period, None, None, quotes_count)
            history_mode = "open-ended"
            if history_error is None:
                history_error = None
        except Exception as exc:
            if history is None:
                return {
                    "ok": False,
                    "error": {
                        "code": "FOREXCONNECT_HISTORICAL_FAILED",
                        "message": _sanitize(str(exc) if not history_error else history_error),
                    },
                    "status": status,
                    "candles": [],
                    "count": 0,
                }

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    timeframe_ms = TIMEFRAME_MS.get(project_tf, 0)
    candles: list[dict[str, Any]] = []
    invalid = 0
    seen: set[int] = set()
    duplicates = 0
    iterable = _history_rows(history)
    sample_keys: list[str] = []

    for row in iterable:
        if not sample_keys:
            sample_keys = _row_keys(row)[:12]
        candle = _row_to_candle(row, timeframe_ms, now_ms)
        if candle is None:
            invalid += 1
            continue
        t = int(candle["time"])
        if t in seen:
            duplicates += 1
            continue
        seen.add(t)
        candles.append(candle)

    candles.sort(key=lambda c: int(c["time"]))
    fetched_at = _now_iso()
    with _state_lock:
        _state["lastHistoricalAt"] = fetched_at

    note = (
        "ForexConnect historical candles from official get_history. "
        "Price basis: bid OHLC. Volume is SDK tick volume when supplied. "
        "No fabricated bars. Trading disabled."
    )
    if len(candles) == 0:
        note += (
            f" Empty authentic response ({history_mode}; rawRows={len(iterable)}; "
            f"invalid={invalid}; historyType={type(history).__name__ if history is not None else 'None'})."
        )

    return {
        "ok": True,
        "provider": "FOREXCONNECT",
        "marketType": "FOREX",
        "providerSymbol": provider_symbol,
        "canonicalSymbol": instrument.get("canonicalSymbol"),
        "displaySymbol": instrument.get("displaySymbol") or provider_symbol,
        "timeframe": project_tf,
        "periodId": period,
        "priceBasis": "bid",
        "environment": status.get("environment"),
        "environmentLabel": status.get("environmentLabel"),
        "candles": candles,
        "count": len(candles),
        "invalidCandles": invalid,
        "duplicatesRemoved": duplicates,
        "fetchedAt": fetched_at,
        "lastHistoricalAt": fetched_at if candles else fetched_at,
        "status": _safe_status(),
        "historyDiagnostics": {
            "mode": history_mode,
            "historyType": type(history).__name__ if history is not None else "None",
            "rawRowCount": len(iterable),
            "sampleKeys": sample_keys,
            "dateFrom": date_from.isoformat() + "Z",
            "dateTo": date_to.isoformat() + "Z",
            "quotesCount": quotes_count,
            "lastError": history_error,
        },
        "note": note,
    }


def _canonical(symbol: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", symbol).upper()


def _offer_to_quote(row: Any) -> Optional[dict[str, Any]]:
    instrument = _row_get(row, "instrument", "Instrument")
    if instrument is None:
        try:
            instrument = row.instrument
        except Exception:
            instrument = None
    if not instrument:
        return None
    provider_symbol = str(instrument).strip()
    if not provider_symbol:
        return None
    bid = _finite(_row_get(row, "bid", "Bid"))
    if bid is None:
        bid = _finite(_try_index(row, "bid"))
    ask = _finite(_row_get(row, "ask", "Ask"))
    if ask is None:
        ask = _finite(_try_index(row, "ask"))
    offer_id = _row_get(row, "offer_id", "OfferID", "offerId")
    mid = (bid + ask) / 2 if bid is not None and ask is not None and bid <= ask else None
    received = _now_iso()
    received_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    return {
        "provider": "FOREXCONNECT",
        "providerSymbol": provider_symbol,
        "canonicalSymbol": _canonical(provider_symbol),
        "displaySymbol": provider_symbol,
        "bid": bid,
        "ask": ask,
        "mid": mid,
        "candlePrice": bid,
        "priceBasis": "bid",
        "offerId": str(offer_id) if offer_id is not None else None,
        "sourceTimestampMs": received_ms,
        "receivedAt": received,
        "receivedAtMs": received_ms,
    }


def _quote_subscribed_locked(quote: dict[str, Any]) -> bool:
    if quote["providerSymbol"] in _subscriptions:
        return True
    wanted = {_canonical(s) for s in _subscriptions}
    return quote["canonicalSymbol"] in wanted


def _store_quote(
    quote: dict[str, Any],
    *,
    event_source: str,
    require_change: bool = True,
) -> bool:
    """Persist a genuine Offers quote. Increments updateCount only on accepted events."""
    with _state_lock:
        if not _quote_subscribed_locked(quote):
            return False
        prev = _quotes.get(quote["canonicalSymbol"])
        if require_change and prev is not None:
            if prev.get("bid") == quote.get("bid") and prev.get("ask") == quote.get("ask"):
                return False
        quote = dict(quote)
        quote["eventSource"] = event_source
        _quotes[quote["canonicalSymbol"]] = quote
        _stream["updateCount"] = int(_stream["updateCount"] or 0) + 1
        _stream["lastQuoteAt"] = quote["receivedAt"]
        _stream["lastEventSource"] = event_source
        _stream["lastStreamError"] = None
        if event_source == "offers-callback":
            _stream["callbackAccepted"] = int(_stream["callbackAccepted"] or 0) + 1
            _stream["lastCallbackAt"] = quote["receivedAt"]
        elif event_source == "offers-table-diff":
            _stream["pollChanges"] = int(_stream["pollChanges"] or 0) + 1
            _stream["lastPollChangeAt"] = quote["receivedAt"]
        return True


def _on_offer_changed(_table_listener: Any, _row_id: Any, row: Any) -> None:
    with _state_lock:
        _stream["callbackInvocations"] = int(_stream["callbackInvocations"] or 0) + 1
    try:
        # Official GetOffers.py filters by Offers table type when present.
        try:
            from forexconnect import ForexConnect

            table_type = getattr(row, "table_type", None)
            if table_type is not None and table_type != ForexConnect.OFFERS:
                with _state_lock:
                    _stream["callbackFiltered"] = int(_stream["callbackFiltered"] or 0) + 1
                return
        except Exception:
            pass

        quote = _offer_to_quote(row)
        if quote is None:
            with _state_lock:
                _stream["callbackParseFailures"] = int(_stream["callbackParseFailures"] or 0) + 1
            return
        with _state_lock:
            subscribed = _quote_subscribed_locked(quote)
        if not subscribed:
            with _state_lock:
                _stream["callbackFiltered"] = int(_stream["callbackFiltered"] or 0) + 1
            return
        if quote.get("bid") is None:
            with _state_lock:
                _stream["callbackNoBid"] = int(_stream["callbackNoBid"] or 0) + 1
            return
        _store_quote(quote, event_source="offers-callback", require_change=True)
    except Exception as exc:  # pragma: no cover
        with _state_lock:
            _stream["callbackParseFailures"] = int(_stream["callbackParseFailures"] or 0) + 1
            _stream["lastStreamError"] = _sanitize(str(exc))


def _poll_offers_table_once() -> None:
    """Read live Offers table rows and accept only real bid/ask changes for subscriptions.

    This complements SDK callbacks. FXCM Table Manager updates Offers in-memory even when
    Python on_change callbacks are delayed/missed under ThreadingHTTPServer. Never invents prices.
    """
    with _state_lock:
        fx = _fx
        subs = set(_subscriptions)
        if fx is None or not subs:
            return
        _stream["pollCycles"] = int(_stream["pollCycles"] or 0) + 1
    try:
        from forexconnect import ForexConnect

        offers = fx.get_table(ForexConnect.OFFERS)
    except Exception as exc:
        with _state_lock:
            _stream["lastStreamError"] = _sanitize(str(exc))
        return

    wanted_canon = {_canonical(s) for s in subs}
    for row in offers:
        try:
            quote = _offer_to_quote(row)
            if quote is None or quote.get("bid") is None:
                continue
            if quote["providerSymbol"] not in subs and quote["canonicalSymbol"] not in wanted_canon:
                continue
            _store_quote(quote, event_source="offers-table-diff", require_change=True)
        except Exception:
            continue


def _offers_poller_main() -> None:
    while not _offers_poller_stop.wait(0.5):
        try:
            _poll_offers_table_once()
        except Exception as exc:  # pragma: no cover
            with _state_lock:
                _stream["lastStreamError"] = _sanitize(str(exc))


def _ensure_offers_poller_locked() -> None:
    global _offers_poller_thread
    if _offers_poller_thread is not None and _offers_poller_thread.is_alive():
        _stream["offersPollerActive"] = True
        return
    _offers_poller_stop.clear()
    thread = threading.Thread(
        target=_offers_poller_main,
        name="forexconnect-offers-poller",
        daemon=True,
    )
    _offers_poller_thread = thread
    _stream["offersPollerActive"] = True
    thread.start()


def _ensure_offers_listener_locked() -> tuple[bool, Optional[str]]:
    global _offers_listener
    if _offers_listener is not None:
        _ensure_offers_poller_locked()
        return True, None
    if _fx is None:
        return False, "ForexConnect session is not active."
    try:
        from forexconnect import ForexConnect, Common

        offers = _fx.get_table(ForexConnect.OFFERS)
        _offers_listener = Common.subscribe_table_updates(
            offers,
            on_change_callback=_on_offer_changed,
            on_add_callback=_on_offer_changed,
        )
        _stream["offersListenerActive"] = True
        _stream["callbackRegistered"] = True
        # Seed current bids for already-subscribed symbols (does NOT increment updateCount).
        for row in offers:
            quote = _offer_to_quote(row)
            if quote and quote["providerSymbol"] in _subscriptions:
                _quotes[quote["canonicalSymbol"]] = quote
                if _stream["lastQuoteAt"] is None:
                    _stream["lastQuoteAt"] = quote["receivedAt"]
        _ensure_offers_poller_locked()
        return True, None
    except Exception as exc:
        _stream["offersListenerActive"] = False
        _stream["callbackRegistered"] = False
        _stream["lastStreamError"] = _sanitize(str(exc))
        return False, _sanitize(str(exc))


def subscribe_symbol(symbol: str) -> dict[str, Any]:
    status = _safe_status()
    if status["status"] != "CONNECTED":
        return {
            "ok": False,
            "error": {
                "code": status.get("errorCode") or f"FOREXCONNECT_{status['status']}",
                "message": status.get("errorMessage") or "Connect before subscribing.",
            },
            "status": status,
        }
    instrument = _resolve_instrument(symbol)
    if instrument is None:
        return {
            "ok": False,
            "error": {
                "code": "FOREXCONNECT_UNKNOWN_INSTRUMENT",
                "message": f'Instrument "{symbol}" is not available in the authenticated session.',
            },
            "status": status,
        }
    provider_symbol = str(instrument["providerSymbol"])
    with _state_lock:
        if provider_symbol not in _subscriptions and len(_subscriptions) >= MAX_SUBSCRIPTIONS:
            return {
                "ok": False,
                "error": {
                    "code": "FOREXCONNECT_SUBSCRIPTION_LIMIT",
                    "message": f"Max concurrent ForexConnect subscriptions is {MAX_SUBSCRIPTIONS}.",
                },
                "status": status,
            }
        _subscriptions.add(provider_symbol)
        ok, err = _ensure_offers_listener_locked()
        if not ok:
            _subscriptions.discard(provider_symbol)
            return {
                "ok": False,
                "error": {
                    "code": "FOREXCONNECT_STREAM_ERROR",
                    "message": err or "Failed to subscribe Offers table updates.",
                },
                "status": _safe_status(),
            }
        # Seed current Offers row for this symbol (no updateCount advance).
        if instrument["canonicalSymbol"] not in _quotes and _fx is not None:
            try:
                from forexconnect import ForexConnect

                for row in _fx.get_table(ForexConnect.OFFERS):
                    seeded = _offer_to_quote(row)
                    if not seeded:
                        continue
                    if seeded["providerSymbol"] != provider_symbol:
                        continue
                    _quotes[seeded["canonicalSymbol"]] = seeded
                    _stream["lastQuoteAt"] = seeded["receivedAt"]
                    break
            except Exception as exc:
                _stream["lastStreamError"] = _sanitize(str(exc))
        quote = _quotes.get(instrument["canonicalSymbol"])
    return {
        "ok": True,
        "provider": "FOREXCONNECT",
        "providerSymbol": provider_symbol,
        "canonicalSymbol": instrument["canonicalSymbol"],
        "displaySymbol": instrument.get("displaySymbol") or provider_symbol,
        "subscribed": True,
        "subscriptionCount": len(_subscriptions),
        "quote": quote,
        "priceBasis": "bid",
        "status": _safe_status(),
        "note": "Subscribed to Offers table updates. Candle OHLC uses bid.",
    }


def unsubscribe_symbol(symbol: str) -> dict[str, Any]:
    instrument = _resolve_instrument(symbol)
    provider_symbol = str(instrument["providerSymbol"]) if instrument else symbol.strip()
    canonical = instrument["canonicalSymbol"] if instrument else _canonical(symbol)
    with _state_lock:
        _subscriptions.discard(provider_symbol)
        # Also discard by matching canonical
        for s in list(_subscriptions):
            if _canonical(s) == canonical:
                _subscriptions.discard(s)
        _quotes.pop(canonical, None)
        if not _subscriptions:
            _stop_offers_listener_locked()
    return {
        "ok": True,
        "provider": "FOREXCONNECT",
        "providerSymbol": provider_symbol,
        "subscribed": False,
        "subscriptionCount": len(_subscriptions),
        "status": _safe_status(),
    }


def stream_status_payload() -> dict[str, Any]:
    status = _safe_status()
    with _state_lock:
        last_at = _stream["lastQuoteAt"]
        age_ms = None
        if last_at:
            try:
                last_ms = int(datetime.fromisoformat(str(last_at).replace("Z", "+00:00")).timestamp() * 1000)
                age_ms = max(0, int(datetime.now(timezone.utc).timestamp() * 1000) - last_ms)
            except Exception:
                age_ms = None
        stream_state = "DISCONNECTED"
        if status["status"] == "DISABLED":
            stream_state = "DISABLED"
        elif status["status"] == "NOT_CONFIGURED":
            stream_state = "NOT_CONFIGURED"
        elif status["status"] != "CONNECTED":
            stream_state = str(status["status"])
        elif not _subscriptions:
            stream_state = "AUTHENTICATED_IDLE"
        elif int(_stream["updateCount"] or 0) <= 0:
            # Poller cycling with zero bid/ask diffs ⇒ market inactive / no ticks yet.
            # Keep SUBSCRIBED_WAITING until enough evidence; then MARKET_INACTIVE.
            if (
                bool(_stream["offersPollerActive"])
                and bool(_stream["callbackRegistered"])
                and int(_stream["pollCycles"] or 0) >= 20
                and int(_stream["pollChanges"] or 0) == 0
                and int(_stream["callbackAccepted"] or 0) == 0
            ):
                stream_state = "MARKET_INACTIVE"
            else:
                stream_state = "SUBSCRIBED_WAITING"
        elif age_ms is not None and age_ms > 15_000:
            stream_state = "STALE"
        else:
            stream_state = "LIVE"
        return {
            "ok": True,
            "provider": "FOREXCONNECT",
            "sessionStatus": status["status"],
            "streamState": stream_state,
            "offersListenerActive": bool(_stream["offersListenerActive"]),
            "offersPollerActive": bool(_stream["offersPollerActive"]),
            "callbackRegistered": bool(_stream["callbackRegistered"]),
            "subscriptionCount": len(_subscriptions),
            "subscriptions": sorted(_subscriptions),
            "maxSubscriptions": MAX_SUBSCRIPTIONS,
            "lastQuoteAt": last_at,
            "lastQuoteAgeMs": age_ms,
            "lastStreamError": _stream["lastStreamError"],
            "updateCount": int(_stream["updateCount"] or 0),
            "lastEventSource": _stream.get("lastEventSource"),
            "diagnostics": {
                "callbackRegistered": bool(_stream["callbackRegistered"]),
                "callbackInvocations": int(_stream["callbackInvocations"] or 0),
                "callbackAccepted": int(_stream["callbackAccepted"] or 0),
                "callbackFiltered": int(_stream["callbackFiltered"] or 0),
                "callbackNoBid": int(_stream["callbackNoBid"] or 0),
                "callbackParseFailures": int(_stream["callbackParseFailures"] or 0),
                "pollCycles": int(_stream["pollCycles"] or 0),
                "pollChanges": int(_stream["pollChanges"] or 0),
                "lastCallbackAt": _stream.get("lastCallbackAt"),
                "lastPollChangeAt": _stream.get("lastPollChangeAt"),
                "offersPollerActive": bool(_stream["offersPollerActive"]),
            },
            "priceBasis": "bid",
            "trading": "DISABLED",
            "note": (
                "LIVE only after a genuine Offers bid/ask change "
                "(SDK callback or Offers table diff). Seeded snapshots do not set LIVE."
            ),
            "status": status,
        }


def quotes_payload(symbol: Optional[str] = None) -> dict[str, Any]:
    status = _safe_status()
    if status["status"] != "CONNECTED":
        return {
            "ok": False,
            "error": {
                "code": status.get("errorCode") or f"FOREXCONNECT_{status['status']}",
                "message": status.get("errorMessage") or "Not connected.",
            },
            "quotes": [],
            "count": 0,
            "status": status,
        }
    if symbol:
        inst = _resolve_instrument(symbol)
        if inst is None:
            return {
                "ok": False,
                "error": {
                    "code": "FOREXCONNECT_UNKNOWN_INSTRUMENT",
                    "message": f'Instrument "{symbol}" not found.',
                },
                "quotes": [],
                "count": 0,
            }
        with _state_lock:
            q = _quotes.get(inst["canonicalSymbol"])
        return {
            "ok": True,
            "quotes": [q] if q else [],
            "count": 1 if q else 0,
            "providerSymbol": inst["providerSymbol"],
            "status": status,
        }
    with _state_lock:
        quotes = list(_quotes.values())
    return {"ok": True, "quotes": quotes, "count": len(quotes), "status": status}


class Handler(BaseHTTPRequestHandler):
    server_version = "KWIZERA-ForexConnect/35"

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
        if length > 8192:
            # Bound credential/body size from localhost bridge.
            self.rfile.read(length)
            return {"__error": "PAYLOAD_TOO_LARGE"}
        raw = self.rfile.read(length).decode("utf-8", errors="replace").strip()
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
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
        if path == "/candles":
            qs = parse_qs(parsed.query or "")
            symbol = (qs.get("symbol") or [""])[0].strip()
            timeframe = (qs.get("timeframe") or [""])[0].strip()
            try:
                limit = int((qs.get("limit") or ["100"])[0])
            except ValueError:
                limit = 100
            if not symbol or not timeframe:
                self._send(400, {
                    "ok": False,
                    "error": {
                        "code": "FOREXCONNECT_INVALID_REQUEST",
                        "message": "symbol and timeframe query parameters are required.",
                    },
                    "candles": [],
                    "count": 0,
                })
                return
            payload = candles_payload(symbol, timeframe, limit)
            code = 200 if payload.get("ok") else (
                400 if str((payload.get("error") or {}).get("code", "")).endswith(
                    ("UNSUPPORTED_TIMEFRAME", "UNKNOWN_INSTRUMENT", "INVALID_REQUEST")
                ) else 503
            )
            self._send(code, payload)
            return
        if path == "/stream/status":
            self._send(200, stream_status_payload())
            return
        if path == "/quote" or path == "/quotes":
            qs = parse_qs(parsed.query or "")
            symbol = (qs.get("symbol") or [""])[0].strip() or None
            payload = quotes_payload(symbol)
            self._send(200 if payload.get("ok") else 503, payload)
            return
        self._send(404, {"ok": False, "error": {"code": "NOT_FOUND", "message": "Unknown route."}})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        body = self._read_json()
        if body.get("__error") == "PAYLOAD_TOO_LARGE":
            self._send(413, {
                "ok": False,
                "error": {"code": "PAYLOAD_TOO_LARGE", "message": "Request body too large."},
            })
            return
        if path == "/connect":
            # Localhost Node bridge may supply isolated DEMO/LIVE profile credentials.
            # Never log body fields. Passwords are never echoed in responses.
            overrides = {
                "username": body.get("username"),
                "password": body.get("password"),
                "environment": body.get("environment"),
            }
            result = connect_session(overrides)
            # Strip any accidental credential echo
            result.pop("username", None)
            result.pop("password", None)
            code = 200 if result.get("status") == "CONNECTED" else 503
            self._send(code, {"ok": result.get("status") == "CONNECTED", **result})
            return
        if path == "/disconnect":
            result = disconnect_session()
            self._send(200, {"ok": True, **result})
            return
        if path == "/subscribe":
            symbol = str(body.get("symbol") or "").strip()
            if not symbol:
                self._send(400, {
                    "ok": False,
                    "error": {"code": "FOREXCONNECT_INVALID_REQUEST", "message": "symbol is required."},
                })
                return
            payload = subscribe_symbol(symbol)
            self._send(200 if payload.get("ok") else 503, payload)
            return
        if path == "/unsubscribe":
            symbol = str(body.get("symbol") or "").strip()
            if not symbol:
                self._send(400, {
                    "ok": False,
                    "error": {"code": "FOREXCONNECT_INVALID_REQUEST", "message": "symbol is required."},
                })
                return
            payload = unsubscribe_symbol(symbol)
            self._send(200, payload)
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
