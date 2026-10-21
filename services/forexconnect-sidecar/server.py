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
    "lastQuoteAt": None,  # last genuine bid/ask change (not heartbeat)
    "lastReceiptAt": None,  # last Offers receipt including same-price heartbeat
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
    _stream["lastReceiptAt"] = None
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
    # Drop seeded quote age; next subscribe re-seeds from the Offers table.
    _stream["lastQuoteAt"] = None
    _stream["lastReceiptAt"] = None
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
                    # Phase 47A — some SDK wrappers expose getters (e.g. getPipCost).
                    try:
                        value = value()
                    except TypeError:
                        continue
                    except Exception:
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


def _primary_account_row(fx: Any) -> Any:
    """First Accounts-table row for TradingSettings lookups. Never invents accounts."""
    try:
        from forexconnect import ForexConnect

        accounts = fx.get_table(ForexConnect.ACCOUNTS)
        for row in accounts:
            if row is not None:
                return row
    except Exception:
        return None
    return None


def _trading_settings_for(fx: Any, instrument: str, account: Any) -> dict[str, Any]:
    """
    Phase 47A — TradingSettingsProvider fields (BaseUnitSize, absolute MMR).
    Never invent values; return nulls when SDK/account lookup fails.
    Note: FXCM get_mmr returns absolute margin for 1 lot (not a decimal rate).
    """
    out: dict[str, Any] = {
        "baseUnitSize": None,
        "mmrPerLot": None,
        # Phase 56.2.5 — getMinQuantity is NOT a fractional lot step.
        "minQuantity": None,
        "lotStep": None,
        # Phase 56.2.4 — CondDist* are stop/limit distances, NEVER quantity steps.
        "condDistStop": None,
        "condDistLimit": None,
        "condDistEntryStop": None,
        "condDistEntryLimit": None,
        "condDistAvailable": False,
        # Phase 56.2.6 — official ForexConnect docs: CondDist* values are in pips.
        # Only set unit to "pips" when a documented SDK method actually returned a value.
        "condDistUnit": "unknown",
        "condDistMethod": None,
    }
    if not instrument or account is None:
        return out
    try:
        login_rules = getattr(fx, "login_rules", None)
        if login_rules is None and hasattr(fx, "get_login_rules"):
            try:
                login_rules = fx.get_login_rules()
            except Exception:
                login_rules = None
        if login_rules is None:
            return out
        tsp = getattr(login_rules, "trading_settings_provider", None)
        if tsp is None and hasattr(login_rules, "get_trading_settings_provider"):
            try:
                tsp = login_rules.get_trading_settings_provider()
            except Exception:
                tsp = None
        if tsp is None:
            return out
        for meth in ("get_base_unit_size", "getBaseUnitSize"):
            if hasattr(tsp, meth):
                try:
                    out["baseUnitSize"] = _finite(getattr(tsp, meth)(instrument, account))
                    break
                except Exception:
                    pass
        for meth in ("get_mmr", "getMMR"):
            if hasattr(tsp, meth):
                try:
                    # Absolute margin amount for 1 lot — not a rate.
                    out["mmrPerLot"] = _finite(getattr(tsp, meth)(instrument, account))
                    break
                except Exception:
                    pass
        # Phase 56.2.5 — MinQuantity is the minimum order amount (CFD → contracts).
        # Official ForexConnect: amounts must be multiples of BaseUnitSize; there is
        # no separate fractional "lotStep" on O2GTradingSettingsProvider.
        # Never map CondDistEntry/stop distances (pips) to lotStep.
        # Never map CondDist* (pips) into minQuantity.
        for meth in ("get_min_quantity", "getMinQuantity"):
            if hasattr(tsp, meth):
                try:
                    mq = _finite(getattr(tsp, meth)(instrument, account))
                    if mq is not None and mq > 0:
                        out["minQuantity"] = mq
                        # Backward-compatible alias only — consumers must treat this as min, not step.
                        out["lotStep"] = mq
                        break
                except Exception:
                    pass
        # Optional genuine step APIs only (rarely present); never invent 0.01.
        if out["lotStep"] is None:
            for meth in ("get_base_unit_step", "getBaseUnitStep", "get_quantity_step", "getQuantityStep"):
                if hasattr(tsp, meth):
                    try:
                        step = _finite(getattr(tsp, meth)(instrument, account))
                        if step is not None and step > 0:
                            out["lotStep"] = step
                            break
                    except Exception:
                        pass
        # Phase 56.2.4/56.2.6 — read-only CondDist probes (never invent; never use for lotStep).
        # Official O2G names: getCondDistStopForTrade / getCondDistLimitForTrade /
        # getCondDistEntryStop / getCondDistEntryLimit — values expressed in **pips**.
        cond_any = False
        documented_hit = False
        for key, methods in (
            (
                "condDistStop",
                (
                    "get_cond_dist_stop_for_trade",
                    "getCondDistStopForTrade",
                    "get_cond_dist_stop",
                    "getCondDistStop",
                ),
            ),
            (
                "condDistLimit",
                (
                    "get_cond_dist_limit_for_trade",
                    "getCondDistLimitForTrade",
                    "get_cond_dist_limit",
                    "getCondDistLimit",
                ),
            ),
            (
                "condDistEntryStop",
                ("get_cond_dist_entry_stop", "getCondDistEntryStop"),
            ),
            (
                "condDistEntryLimit",
                ("get_cond_dist_entry_limit", "getCondDistEntryLimit"),
            ),
        ):
            for meth in methods:
                if hasattr(tsp, meth):
                    try:
                        try:
                            val = _finite(getattr(tsp, meth)(instrument))
                        except TypeError:
                            val = _finite(getattr(tsp, meth)(instrument, account))
                        if val is not None:
                            out[key] = val
                            cond_any = True
                            if key == "condDistStop":
                                out["condDistMethod"] = meth
                            if "ForTrade" in meth or "for_trade" in meth or meth in (
                                "get_cond_dist_entry_stop",
                                "getCondDistEntryStop",
                                "get_cond_dist_entry_limit",
                                "getCondDistEntryLimit",
                            ):
                                documented_hit = True
                        break
                    except Exception:
                        pass
        out["condDistAvailable"] = bool(cond_any)
        # Documented ForexConnect APIs express CondDist in pips.
        if documented_hit:
            out["condDistUnit"] = "pips"
        elif cond_any:
            out["condDistUnit"] = "unknown"
    except Exception:
        return out
    return out


def _normalize_offer(
    row: Any,
    trading: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
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
    # FXCM Offers InstrumentType numeric codes (Demo-verified).
    _type_labels = {
        "1": "Forex",
        "2": "Indices",
        "3": "Commodity",
        "4": "Treasury",
        "5": "Bullion",
        "7": "Forex Basket",
        "8": "Shares",
        "9": "Crypto",
    }
    type_key = str(instrument_type).strip() if instrument_type is not None else ""
    instrument_type_label = _type_labels.get(type_key)
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
    # Phase 45/47A — surface Offers + TradingSettings sizing fields when SDK exposes them.
    # Never invent PointSize / PipCost / BaseUnitSize / ContractMultiplier.
    point_size = _finite(
        _row_get(row, "point_size", "PointSize", "pointSize", "get_point_size", "getPointSize")
    )
    pip_cost = _finite(
        _row_get(row, "pip_cost", "PipCost", "pipCost", "get_pip_cost", "getPipCost")
    )
    contract_multiplier = _finite(
        _row_get(row, "contract_multiplier", "ContractMultiplier", "contractMultiplier")
    )
    digits = _row_get(row, "digits", "Digits", "digits", "get_digits", "getDigits")
    digits_n = None
    try:
        if digits is not None and str(digits).strip() != "":
            digits_n = int(float(str(digits)))
    except Exception:
        digits_n = None
    ts = trading if isinstance(trading, dict) else {}
    base_unit_size = _finite(ts.get("baseUnitSize"))
    mmr_per_lot = _finite(ts.get("mmrPerLot"))
    lot_step = _finite(ts.get("lotStep"))
    min_quantity = _finite(ts.get("minQuantity"))
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
        "instrumentTypeLabel": instrument_type_label,
        "contractCurrency": str(contract_currency) if contract_currency is not None else None,
        "bid": bid,
        "ask": ask,
        "tradingStatus": str(trading_status) if trading_status is not None else None,
        "pointSize": point_size,
        "pipCost": pip_cost,
        "contractMultiplier": contract_multiplier,
        "digits": digits_n,
        "baseUnitSize": base_unit_size,
        "mmrPerLot": mmr_per_lot,
        "minQuantity": min_quantity,
        "lotStep": lot_step,
        "condDistStop": ts.get("condDistStop"),
        "condDistLimit": ts.get("condDistLimit"),
        "condDistEntryStop": ts.get("condDistEntryStop"),
        "condDistEntryLimit": ts.get("condDistEntryLimit"),
        "condDistAvailable": bool(ts.get("condDistAvailable")),
        "condDistUnit": ts.get("condDistUnit") or "unknown",
        "condDistMethod": ts.get("condDistMethod"),
    }


def _discover_instruments(fx: Any) -> list[dict[str, Any]]:
    from forexconnect import ForexConnect

    offers = fx.get_table(ForexConnect.OFFERS)
    account = _primary_account_row(fx)
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in offers:
        instrument = _row_get(row, "instrument", "Instrument", "symbol", "Symbol")
        trading = (
            _trading_settings_for(fx, str(instrument).strip(), account)
            if instrument is not None
            else {}
        )
        item = _normalize_offer(row, trading=trading)
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


def _mask_account_id(raw: Any) -> Optional[str]:
    text = str(raw).strip() if raw is not None else ""
    if not text:
        return None
    if len(text) <= 4:
        return "***" + text
    return "***" + text[-4:]


def _parse_currency_token(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    # Some SDK wrappers return property objects with .value / .Value.
    for attr in ("value", "Value", "property_value", "PropertyValue"):
        try:
            if hasattr(raw, attr):
                nested = getattr(raw, attr)
                if nested is not None and not callable(nested):
                    raw = nested
                    break
        except Exception:
            pass
    text = str(raw).strip().upper()
    if len(text) == 3 and text.isalpha():
        return text
    return None


def _account_currency_from_session(fx: Any) -> tuple[Optional[str], Optional[str]]:
    """
    Phase 47C — account currency from documented FXCM system property BASE_CRNCY.
    Path: login_rules.system_properties_response → fx.create_reader → find_property.
    Never invents a currency from balance/account id/environment.
    """
    try:
        login_rules = getattr(fx, "login_rules", None)
        if login_rules is None and hasattr(fx, "get_login_rules"):
            try:
                login_rules = fx.get_login_rules()
            except Exception:
                login_rules = None
        if login_rules is None:
            return None, None

        response = getattr(login_rules, "system_properties_response", None)
        if response is None and hasattr(login_rules, "get_system_properties_response"):
            try:
                response = login_rules.get_system_properties_response()
            except Exception:
                response = None

        keys = ("BASE_CRNCY", "BASE_CURRENCY", "AccountCurrency", "ACCOUNT_CURRENCY")

        # Preferred FXCM path: response reader + find_property("BASE_CRNCY").
        if response is not None and hasattr(fx, "create_reader"):
            try:
                reader = fx.create_reader(response)
            except Exception:
                reader = None
            if reader is not None:
                # Constants.SystemProperties.BASE_CRNCY when available.
                const_keys: list[Any] = list(keys)
                try:
                    from forexconnect import fxcorepy  # type: ignore

                    sp = getattr(getattr(fxcorepy, "Constants", None), "SystemProperties", None)
                    base_const = getattr(sp, "BASE_CRNCY", None) if sp is not None else None
                    if base_const is not None:
                        const_keys.insert(0, base_const)
                except Exception:
                    pass

                finder = getattr(reader, "find_property", None) or getattr(reader, "findProperty", None)
                if callable(finder):
                    for key in const_keys:
                        try:
                            found = finder(key)
                        except Exception:
                            found = None
                        ccy = _parse_currency_token(found)
                        if ccy:
                            return ccy, f"system_properties_reader:find_property:{key}"

                # Iterable reader of name/value pairs.
                try:
                    for item in reader:
                        name = _row_get(item, "name", "Name", "key", "Key", "property", "Property")
                        value = _row_get(item, "value", "Value", "property_value", "PropertyValue")
                        if name is None:
                            continue
                        if str(name).strip().upper() in {str(k).strip().upper() for k in keys}:
                            ccy = _parse_currency_token(value if value is not None else item)
                            if ccy:
                                return ccy, f"system_properties_reader:iter:{name}"
                except Exception:
                    pass

                getter = getattr(reader, "get", None) or getattr(reader, "get_property", None)
                if callable(getter):
                    for key in keys:
                        try:
                            value = getter(key)
                        except TypeError:
                            try:
                                # Some getters are index-based; skip.
                                continue
                            except Exception:
                                continue
                        except Exception:
                            value = None
                        ccy = _parse_currency_token(value)
                        if ccy:
                            return ccy, f"system_properties_reader:get:{key}"

        # Fallback: treat system_properties as a mapping if the wrapper exposes one.
        props = getattr(login_rules, "system_properties", None)
        if props is not None:
            mapper = getattr(props, "get", None) or getattr(props, "get_property", None)
            if callable(mapper):
                for key in keys:
                    try:
                        value = mapper(key)
                    except Exception:
                        value = None
                    ccy = _parse_currency_token(value)
                    if ccy:
                        return ccy, f"system_properties_map:{key}"
            if isinstance(props, dict):
                for key in keys:
                    ccy = _parse_currency_token(props.get(key))
                    if ccy:
                        return ccy, f"system_properties_dict:{key}"
    except Exception:
        return None, None
    return None, None


def _normalize_account_row(
    row: Any,
    *,
    environment: str,
    session_currency: Optional[str],
    currency_source: Optional[str],
) -> Optional[dict[str, Any]]:
    account_id = _row_get(row, "account_id", "AccountID", "accountId", "get_account_id", "getAccountID")
    if account_id is None or str(account_id).strip() == "":
        return None
    account_id_s = str(account_id).strip()
    account_name = _row_get(row, "account_name", "AccountName", "accountName", "get_account_name", "getAccountName")
    balance = _finite(_row_get(row, "balance", "Balance", "get_balance", "getBalance"))
    equity = _finite(_row_get(row, "equity", "Equity", "get_equity", "getEquity"))
    used_margin = _finite(
        _row_get(row, "used_margin", "UsedMargin", "usedMargin", "get_used_margin", "getUsedMargin")
    )
    usable_margin = _finite(
        _row_get(
            row,
            "usable_margin",
            "UsableMargin",
            "usableMargin",
            "get_usable_margin",
            "getUsableMargin",
        )
    )
    row_currency = _row_get(
        row,
        "account_currency",
        "AccountCurrency",
        "currency",
        "Currency",
        "get_account_currency",
        "getAccountCurrency",
    )
    currency = None
    currency_src = None
    if row_currency is not None and str(row_currency).strip():
        ccy = str(row_currency).strip().upper()
        if len(ccy) == 3 and ccy.isalpha():
            currency = ccy
            currency_src = "accounts-row"
    if currency is None and session_currency:
        currency = session_currency
        currency_src = currency_source

    missing: list[str] = []
    if balance is None:
        missing.append("balance")
    if equity is None:
        missing.append("equity")
    if used_margin is None:
        missing.append("usedMargin")
    if usable_margin is None:
        missing.append("usableMargin")
    if currency is None:
        missing.append("accountCurrency")

    return {
        "accountId": account_id_s,
        "accountIdMasked": _mask_account_id(account_id_s),
        "accountNameMasked": _mask_account_id(account_name) if account_name is not None else None,
        "environment": environment,
        "accountCurrency": currency,
        "balance": balance,
        "equity": equity,
        "usedMargin": used_margin,
        "usableMargin": usable_margin,
        "currencySource": currency_src,
        "missingFields": missing,
        "source": "forexconnect-accounts",
    }


def _discover_accounts(fx: Any, environment: str) -> tuple[list[dict[str, Any]], Optional[str]]:
    from forexconnect import ForexConnect

    session_currency, currency_source = _account_currency_from_session(fx)
    accounts_table = fx.get_table(ForexConnect.ACCOUNTS)
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in accounts_table:
        item = _normalize_account_row(
            row,
            environment=environment,
            session_currency=session_currency,
            currency_source=currency_source,
        )
        if not item:
            continue
        key = str(item["accountId"])
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    out.sort(key=lambda x: str(x.get("accountId") or ""))
    return out, currency_source


def _table_capability(table_attr: str) -> tuple[Any, Optional[str]]:
    """Return (ForexConnect table constant, error) without inventing support."""
    try:
        from forexconnect import ForexConnect
    except Exception as exc:  # pragma: no cover
        return None, f"forexconnect import failed: {str(exc)[:120]}"
    const = getattr(ForexConnect, table_attr, None)
    if const is None:
        return None, f"ForexConnect.{table_attr} is not available on this installed SDK."
    return const, None


def _normalize_order_row(row: Any) -> Optional[dict[str, Any]]:
    try:
        order_id = getattr(row, "order_id", None) or getattr(row, "OrderID", None)
        offer = getattr(row, "instrument", None) or getattr(row, "OfferID", None) or getattr(row, "Symbol", None)
        side = getattr(row, "buy_sell", None) or getattr(row, "BuySell", None)
        amount = getattr(row, "amount", None) or getattr(row, "Amount", None)
        rate = getattr(row, "rate", None) or getattr(row, "Rate", None)
        status = getattr(row, "status", None) or getattr(row, "Status", None)
        return {
            "orderId": str(order_id) if order_id is not None else None,
            "instrument": str(offer) if offer is not None else None,
            "side": str(side) if side is not None else None,
            "amount": float(amount) if amount is not None and str(amount).strip() != "" else None,
            "rate": float(rate) if rate is not None and str(rate).strip() != "" else None,
            "status": str(status) if status is not None else None,
            "source": "forexconnect-orders",
        }
    except Exception:
        return None


def _normalize_trade_row(row: Any) -> Optional[dict[str, Any]]:
    try:
        trade_id = getattr(row, "trade_id", None) or getattr(row, "TradeID", None)
        offer = getattr(row, "instrument", None) or getattr(row, "OfferID", None) or getattr(row, "Symbol", None)
        side = getattr(row, "buy_sell", None) or getattr(row, "BuySell", None)
        amount = getattr(row, "amount", None) or getattr(row, "Amount", None)
        open_rate = getattr(row, "open_rate", None) or getattr(row, "OpenRate", None)
        sl = getattr(row, "stop", None) or getattr(row, "Stop", None)
        tp = getattr(row, "limit", None) or getattr(row, "Limit", None)
        return {
            "tradeId": str(trade_id) if trade_id is not None else None,
            "instrument": str(offer) if offer is not None else None,
            "side": str(side) if side is not None else None,
            "amount": float(amount) if amount is not None and str(amount).strip() != "" else None,
            "openRate": float(open_rate) if open_rate is not None and str(open_rate).strip() != "" else None,
            "stopLoss": float(sl) if sl is not None and str(sl).strip() != "" else None,
            "takeProfit": float(tp) if tp is not None and str(tp).strip() != "" else None,
            "source": "forexconnect-trades",
        }
    except Exception:
        return None


def _ro_table_payload(table_attr: str, item_key: str, normalizer: Any) -> dict[str, Any]:
    """Phase 56.2.3 — generic RO table snapshot. Never places/cancels/amends orders."""
    status = _safe_status()
    fetched_at = _now_iso()
    base = {
        "fetchedAt": fetched_at,
        "status": status,
        "trading": "DISABLED",
        "mutatesBroker": False,
        "placesOrders": False,
        item_key: [],
        "count": 0,
    }
    const, err = _table_capability(table_attr)
    if const is None:
        return {
            **base,
            "ok": False,
            "capabilityStatus": "UNSUPPORTED",
            "code": f"{table_attr}_UNSUPPORTED",
            "error": {
                "code": f"FOREXCONNECT_{table_attr}_UNSUPPORTED",
                "message": err or f"{table_attr} table is not available.",
            },
            "note": f"Installed SDK does not expose ForexConnect.{table_attr}. Not reported as empty success.",
        }
    if status["status"] != "CONNECTED":
        return {
            **base,
            "ok": False,
            "capabilityStatus": "AVAILABLE_BUT_DISCONNECTED",
            "code": "DISCONNECTED",
            "error": {
                "code": status.get("errorCode") or f"FOREXCONNECT_{status['status']}",
                "message": status.get("errorMessage")
                or f"ForexConnect is not connected. Connect before reading {table_attr}.",
            },
            "note": f"Read-only {table_attr} unavailable while disconnected.",
        }
    with _state_lock:
        fx = _fx
    if fx is None:
        return {
            **base,
            "ok": False,
            "capabilityStatus": "AVAILABLE_BUT_DISCONNECTED",
            "code": "DISCONNECTED",
            "error": {
                "code": "FOREXCONNECT_DISCONNECTED",
                "message": "ForexConnect session handle is not available.",
            },
        }
    try:
        table = fx.get_table(const)
        items: list[dict[str, Any]] = []
        for row in table:
            item = normalizer(row)
            if item:
                items.append(item)
        return {
            **base,
            "ok": True,
            "capabilityStatus": "AVAILABLE",
            "code": "OK" if items else f"NO_{table_attr}",
            item_key: items,
            "count": len(items),
            "note": f"Read-only ForexConnect.{table_attr} snapshot. Trading disabled. Never mutates broker state.",
        }
    except Exception as exc:
        return {
            **base,
            "ok": False,
            "capabilityStatus": "ERROR",
            "code": f"{table_attr}_UNAVAILABLE",
            "error": {
                "code": f"FOREXCONNECT_{table_attr}_UNAVAILABLE",
                "message": f"{table_attr} table read failed: {str(exc)[:200]}",
            },
        }


def orders_payload() -> dict[str, Any]:
    """Phase 56.2.3 — read-only Orders table. Never creates/cancels/amends orders."""
    return _ro_table_payload("ORDERS", "orders", _normalize_order_row)


def trades_payload() -> dict[str, Any]:
    """Phase 56.2.3 — read-only Trades (open positions) table. Never closes/modifies positions."""
    return _ro_table_payload("TRADES", "trades", _normalize_trade_row)


def accounts_payload() -> dict[str, Any]:
    """Phase 47B — read-only Accounts table snapshot. Never places orders."""
    status = _safe_status()
    fetched_at = _now_iso()
    if status["status"] != "CONNECTED":
        return {
            "ok": False,
            "code": "DISCONNECTED",
            "error": {
                "code": status.get("errorCode") or f"FOREXCONNECT_{status['status']}",
                "message": status.get("errorMessage")
                or "ForexConnect is not connected. Connect before reading accounts.",
            },
            "accounts": [],
            "count": 0,
            "fetchedAt": fetched_at,
            "status": status,
            "trading": "DISABLED",
            "note": "Read-only Accounts snapshot unavailable while disconnected.",
        }
    with _state_lock:
        fx = _fx
        environment = str(status.get("environment") or _state.get("environment") or "demo")
    if fx is None:
        return {
            "ok": False,
            "code": "DISCONNECTED",
            "error": {
                "code": "FOREXCONNECT_DISCONNECTED",
                "message": "ForexConnect session handle is not available.",
            },
            "accounts": [],
            "count": 0,
            "fetchedAt": fetched_at,
            "status": status,
            "trading": "DISABLED",
        }
    try:
        accounts, currency_source = _discover_accounts(fx, environment)
    except Exception as exc:
        return {
            "ok": False,
            "code": "ACCOUNTS_UNAVAILABLE",
            "error": {
                "code": "FOREXCONNECT_ACCOUNTS_UNAVAILABLE",
                "message": f"Accounts table read failed: {str(exc)[:200]}",
            },
            "accounts": [],
            "count": 0,
            "fetchedAt": fetched_at,
            "status": status,
            "trading": "DISABLED",
            "currencySource": None,
        }
    code = "OK"
    if not accounts:
        code = "NO_ACCOUNTS"
    elif len(accounts) > 1:
        code = "MULTIPLE_ACCOUNTS"
    any_missing_ccy = any(
        "accountCurrency" in (a.get("missingFields") or []) for a in accounts
    )
    return {
        "ok": True,
        "code": code,
        "accounts": accounts,
        "count": len(accounts),
        "fetchedAt": fetched_at,
        "status": status,
        "trading": "DISABLED",
        "currencySource": currency_source,
        "note": (
            "Read-only ForexConnect Accounts table snapshot. "
            "Account currency from system property BASE_CRNCY via create_reader when available. "
            "Equity/usableMargin are SDK calculated fields when available. "
            "Never invents currency/balance. Trading disabled."
            + (
                " BASE_CRNCY was not returned by the SDK session."
                if any_missing_ccy and not currency_source
                else ""
            )
        ),
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
    """Persist a genuine Offers quote. Increments updateCount only on bid/ask changes."""
    with _state_lock:
        if not _quote_subscribed_locked(quote):
            return False
        prev = _quotes.get(quote["canonicalSymbol"])
        if require_change and prev is not None:
            if prev.get("bid") == quote.get("bid") and prev.get("ask") == quote.get("ask"):
                # Same bid/ask: refresh receipt time so feed health can distinguish
                # active Offers reads (NO_RECENT_MARKET_UPDATES) from a dead feed (STALE).
                # Do not increment updateCount or lastQuoteAt (price-change only).
                heart = dict(prev)
                heart["receivedAt"] = quote["receivedAt"]
                heart["receivedAtMs"] = quote.get("receivedAtMs", prev.get("receivedAtMs"))
                heart["sourceTimestampMs"] = quote.get(
                    "sourceTimestampMs", prev.get("sourceTimestampMs")
                )
                heart["eventSource"] = event_source
                _quotes[quote["canonicalSymbol"]] = heart
                _stream["lastReceiptAt"] = quote["receivedAt"]
                _stream["lastEventSource"] = event_source
                _stream["lastStreamError"] = None
                if event_source == "offers-callback":
                    _stream["lastCallbackAt"] = quote["receivedAt"]
                elif event_source == "offers-table-diff":
                    _stream["lastPollChangeAt"] = quote["receivedAt"]
                return False
        quote = dict(quote)
        quote["eventSource"] = event_source
        _quotes[quote["canonicalSymbol"]] = quote
        _stream["updateCount"] = int(_stream["updateCount"] or 0) + 1
        _stream["lastQuoteAt"] = quote["receivedAt"]
        _stream["lastReceiptAt"] = quote["receivedAt"]
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
        # Seed current bids for already-subscribed symbols (does NOT increment updateCount
        # and must not set lastQuoteAt — that tracks genuine bid/ask changes only).
        for row in offers:
            quote = _offer_to_quote(row)
            if quote and quote["providerSymbol"] in _subscriptions:
                _quotes[quote["canonicalSymbol"]] = quote
                if _stream.get("lastReceiptAt") is None:
                    _stream["lastReceiptAt"] = quote["receivedAt"]
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
        # Seed current Offers row for this symbol (no updateCount / lastQuoteAt advance).
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
                    _stream["lastReceiptAt"] = seeded["receivedAt"]
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


def _age_ms_from_iso(value: Any) -> Optional[int]:
    if not value:
        return None
    try:
        last_ms = int(
            datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000
        )
        return max(0, int(datetime.now(timezone.utc).timestamp() * 1000) - last_ms)
    except Exception:
        return None


def stream_status_payload() -> dict[str, Any]:
    status = _safe_status()
    with _state_lock:
        last_price_at = _stream["lastQuoteAt"]
        last_receipt_at = _stream.get("lastReceiptAt") or _stream.get("lastPollChangeAt") or _stream.get(
            "lastCallbackAt"
        )
        price_age_ms = _age_ms_from_iso(last_price_at)
        receipt_age_ms = _age_ms_from_iso(last_receipt_at)
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
        elif price_age_ms is not None and price_age_ms <= 15_000:
            stream_state = "LIVE"
        elif receipt_age_ms is not None and receipt_age_ms <= 15_000:
            # Offers receipts continue but bid/ask have not changed recently.
            stream_state = "NO_RECENT_MARKET_UPDATES"
        else:
            # No recent price change and no recent Offers receipt ⇒ feed unhealthy.
            stream_state = "STALE"
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
            "lastQuoteAt": last_price_at,
            "lastQuoteAgeMs": price_age_ms,
            "lastReceiptAt": last_receipt_at,
            "lastReceiptAgeMs": receipt_age_ms,
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
                "lastReceiptAt": last_receipt_at,
                "lastReceiptAgeMs": receipt_age_ms,
                "lastPriceChangeAgeMs": price_age_ms,
            },
            "latency": {
                "providerEventTimestampAvailable": False,
                "sidecarReceiptAgeMs": receipt_age_ms,
                "note": (
                    "FXCM Offers rows do not expose a distinct broker event timestamp in this SDK path; "
                    "sourceTimestampMs equals sidecar receipt time. lastQuoteAgeMs is last bid/ask "
                    "change age; lastReceiptAgeMs is last Offers receipt age (includes same-price heartbeats)."
                ),
            },
            "priceBasis": "bid",
            "trading": "DISABLED",
            "note": (
                "LIVE only after a genuine Offers bid/ask change within 15s "
                "(SDK callback or Offers table diff). Active receipts without a recent price "
                "change are NO_RECENT_MARKET_UPDATES. Seeded snapshots do not set LIVE."
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
        if path == "/accounts":
            # Phase 47B — read-only account balances. Never triggers orders.
            payload = accounts_payload()
            self._send(200 if payload.get("ok") else 503, payload)
            return
        if path == "/orders":
            # Phase 56.2.3 — read-only Orders table if SDK exposes it. Never mutates.
            payload = orders_payload()
            self._send(200 if payload.get("ok") or payload.get("capabilityStatus") == "UNSUPPORTED" else 503, payload)
            return
        if path == "/trades":
            # Phase 56.2.3 — read-only Trades table if SDK exposes it. Never mutates.
            payload = trades_payload()
            self._send(200 if payload.get("ok") or payload.get("capabilityStatus") == "UNSUPPORTED" else 503, payload)
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
