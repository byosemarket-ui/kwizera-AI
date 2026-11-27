"""
Demo-only MT5 control under Wine.

Login mechanism (MetaQuotes-supported):
  wine terminal64.exe /portable /config:<ephemeral.ini>

Account + market data: MetaTrader 5 built-in MCP (127.0.0.1) via mt5_mcp.py
read-only tool allowlist. No trade_* / shell / EA tools.

No Live servers. No orders / EA trading.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any

import mt5_mcp
from candle_cache_sync import (
    merge_candle_maps,
    should_accept_incoming_snapshot,
    snapshot_is_well_formed,
)

WINE_BIN = os.environ.get("KWIZERA_MT5_WINE_BIN", "/opt/wine-staging/bin/wine")
WINEPREFIX = os.environ.get("WINEPREFIX", "/home/mt5/.wine-hfm")
TERM_ROOT = Path(WINEPREFIX) / "drive_c/Program Files/HFM Metatrader 5"
TERM_EXE = TERM_ROOT / "terminal64.exe"
DISPLAY = os.environ.get("DISPLAY", ":97")
XAUTHORITY = os.environ.get("XAUTHORITY", "/home/mt5/.mt5-xauth/Xauthority")
RUN_DIR = Path(os.environ.get("KWIZERA_MT5_HFM_RUN_DIR", "/run/kwizera/mt5-hfm"))
LOG_DIR = TERM_ROOT / "logs"
CONFIG_DIR = TERM_ROOT / "Config"

DEMO_SERVER_ALLOW = {
    "HFMarketsGlobal-Demo",
    "HFMarketsGlobal-Demo3",
    "HFMarketsGlobal-Demo4",
    "HFMarkets-Demo",
    "HFMarketsSC-Demo",
    "HFMarketsSC-Demo2",
    "HFMarketsSC-Demo3",
    "HFMarketsKE-Demo2",
    "HFMarketsKM-Demo",
    "HFMarketsMENA-Demo2",
    "HFMarketsSA-Demo",
    "HFMarketsSA-Demo2",
    "HFMarketsUK-Demo2",
}

_LIVE_RE = re.compile(r"live|real|prod", re.I)
# Prefer exact MT5 Network journal lines over loose keywords.
_AUTH_OK_RE = re.compile(
    r"'(\d{4,})'\s*:\s*authorized on\s+([A-Za-z0-9._-]+)|"
    r"'(\d{4,})'\s*:\s*terminal synchronized with\s+(.+?):\s*(\d+)\s+positions",
    re.I,
)
_AUTH_FAIL_RE = re.compile(
    r"(invalid account|authorization failed|login failed|password\s+incorrect|authentication\s+failed)",
    re.I,
)
_ACCOUNT_RE = re.compile(r"'(\d{4,})'\s*:\s*(?:authorized|terminal synchronized|trading has been)", re.I)
_COMPANY_RE = re.compile(r"'(\d{4,})'\s*:\s*terminal synchronized with\s+(.+?):\s*(\d+)\s+positions,\s*(\d+)\s+orders,\s*(\d+)\s+symbols", re.I)
_DEMO_MODE_RE = re.compile(r"'(\d{4,})'\s*:\s*trading has been enabled,\s*demo account", re.I)

# Last successful Demo login meta (non-secret) for snapshot enrichment.
_last_demo_meta: dict[str, str] = {}


def terminal_running() -> bool:
    try:
        out = subprocess.check_output(["pgrep", "-u", "mt5", "-f", "terminal64.exe"], text=True)
        return bool(out.strip())
    except subprocess.CalledProcessError:
        return False
    except FileNotFoundError:
        return False


def mcp_status() -> dict[str, Any]:
    key_present = mt5_mcp.load_mcp_api_key() is not None
    reachable = mt5_mcp.mcp_reachable()
    return {
        "mcpUrl": mt5_mcp.resolve_mcp_url(),
        "apiKeyConfigured": key_present,
        "reachable": reachable,
    }


def connection_status() -> dict[str, Any]:
    running = terminal_running()
    mcp = mcp_status()
    authenticated = False
    auth_source = None
    account_hint = None
    if running and mcp["apiKeyConfigured"] and mcp["reachable"]:
        try:
            client = mt5_mcp.Mt5McpClient()
            raw = client.call_tool("get_trading_account_info", {})
            acct = mt5_mcp.normalize_account_info(raw, server_hint=_last_demo_meta.get("server"))
            if acct.get("loginExact") or acct.get("balance") is not None or acct.get("currency"):
                authenticated = True
                auth_source = "mt5_mcp"
                account_hint = acct.get("loginHint")
        except ValueError:
            authenticated = False
    if not authenticated and running:
        mql = _read_mql_snapshot(max_age_sec=600.0)
        if mql and not mql.get("error") and mql.get("loginExact"):
            authenticated = True
            auth_source = "mql5_readonly_snapshot"
            account_hint = mql.get("loginHint")
        else:
            journal = parse_journal_snapshot(expected_login=_last_demo_meta.get("login"))
            if journal.get("authenticated"):
                authenticated = True
                auth_source = "journal"
                account_hint = journal.get("loginHint")
    return {
        "terminalRunning": running,
        "terminalConnected": running,
        "authenticated": authenticated,
        "authSource": auth_source,
        "loginHint": account_hint,
        "display": DISPLAY,
        "winePrefix": WINEPREFIX,
        "mcp": mcp,
        "note": (
            "terminalConnected reflects process presence under Xvfb. "
            "authenticated may come from MCP, MQL snapshot, or journal identity lines."
        ),
    }


def _validate_demo(login: str, server: str) -> None:
    login = login.strip()
    server = server.strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]{4,32}", login):
        raise ValueError("INVALID_LOGIN")
    if server not in DEMO_SERVER_ALLOW:
        raise ValueError("DEMO_SERVER_NOT_ALLOWED")
    if _LIVE_RE.search(server):
        raise ValueError("LIVE_SERVER_REJECTED")


SNAPSHOT_REL = "MQL5/Files/kwizera_readonly_snapshot.json"
SNAPSHOT_COMMON = (
    Path(WINEPREFIX)
    / "drive_c/users/mt5/AppData/Roaming/MetaQuotes/Terminal/Common/Files/kwizera_readonly_snapshot.json"
)
SNAPSHOT_LOCAL = TERM_ROOT / "MQL5/Files/kwizera_readonly_snapshot.json"
# Durable CopyRates dump (Expert writes periodically; survives quote-only snapshots).
CANDLES_COMMON = (
    Path(WINEPREFIX)
    / "drive_c/users/mt5/AppData/Roaming/MetaQuotes/Terminal/Common/Files/kwizera_readonly_candles.json"
)
CANDLES_LOCAL = TERM_ROOT / "MQL5/Files/kwizera_readonly_candles.json"
# Agent-side cache so demo.candles works between Expert candle cycles.
CANDLES_CACHE = RUN_DIR / "candles-cache.json"
CATALOG_COMMON_DIR = (
    Path(WINEPREFIX) / "drive_c/users/mt5/AppData/Roaming/MetaQuotes/Terminal/Common/Files"
)
CATALOG_LOCAL_DIR = TERM_ROOT / "MQL5/Files"
CATALOG_META_NAME = "kwizera_catalog_meta.json"
CATALOG_NDJSON_NAME = "kwizera_catalog_symbols.ndjson"
CATALOG_READY_NAME = "kwizera_catalog.ready"
CATALOG_REFRESH_NAME = "kwizera_catalog_refresh.request"
HISTORY_REQUEST_NAME = "kwizera_history.request"
HISTORY_RESPONSE_NAME = "kwizera_history.response.json"
TICKS_REQUEST_NAME = "kwizera_ticks.request"
TICKS_RESPONSE_NAME = "kwizera_ticks.response.json"
QUOTE_WATCH_REQUEST_NAME = "kwizera_quote_watch.request"
CHART_TICK_NAME = "kwizera_chart_tick.json"
# Bounded per-key history cache (provider/symbol/tf) under RUN_DIR.
HISTORY_CACHE_DIR = RUN_DIR / "history-cache"
HISTORY_CACHE_MAX_KEYS = 48
HISTORY_CACHE_MAX_BARS = 500
EXPERT_MQ5_NAME = "KwizeraReadonlySnapshot.mq5"
EXPERT_EX5_NAME = "KwizeraReadonlySnapshot.ex5"
EXPERT_SOURCE_VERSION = "1.40"


def _write_login_ini(login: str, server: str, password: str, *, start_snapshot_expert: bool = True) -> Path:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    path = RUN_DIR / f"login-{os.getpid()}-{int(time.time())}.ini"
    startup = ""
    if start_snapshot_expert and (TERM_ROOT / "MQL5/Experts" / EXPERT_EX5_NAME).is_file():
        # Attach periodic read-only snapshot Expert on EURUSD H1 (timer-driven; no trading).
        startup = (
            "\n[StartUp]\n"
            f"Expert={EXPERT_EX5_NAME.replace('.ex5', '')}\n"
            "Symbol=EURUSD\n"
            "Period=H1\n"
        )
    content = (
        "[Common]\n"
        f"Login={login}\n"
        f"Server={server}\n"
        f"Password={password}\n"
        "KeepPrivate=1\n"
        "ProxyEnable=0\n"
        f"{startup}"
    )
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(str(path), flags, 0o600)
    try:
        os.write(fd, content.encode("ascii", errors="strict"))
    finally:
        os.close(fd)
    return path


def _shred(path: Path) -> None:
    try:
        if path.exists():
            size = path.stat().st_size
            with open(path, "r+b", buffering=0) as f:
                f.write(b"\0" * size)
                f.flush()
                os.fsync(f.fileno())
            path.unlink(missing_ok=True)
    except OSError:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def _stop_terminal() -> None:
    try:
        subprocess.run(["pkill", "-u", "mt5", "-f", "terminal64.exe"], check=False, timeout=5)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    time.sleep(1)
    # Do NOT kill Xvfb.


def _start_terminal_with_config(ini_path: Path) -> None:
    if not TERM_EXE.is_file():
        raise ValueError("TERMINAL_MISSING")
    if not Path(WINE_BIN).is_file():
        raise ValueError("WINE_MISSING")
    win_ini = "Z:\\run\\kwizera\\mt5-hfm\\" + ini_path.name
    env = os.environ.copy()
    env["WINEPREFIX"] = WINEPREFIX
    env["WINEARCH"] = "win64"
    env["WINEDEBUG"] = "-all"
    env["DISPLAY"] = DISPLAY
    env["XAUTHORITY"] = XAUTHORITY
    env["HOME"] = "/home/mt5"
    cmd = [WINE_BIN, str(TERM_EXE), "/portable", f"/config:{win_ini}"]
    subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def _latest_journal_text(max_bytes: int = 200_000) -> str:
    if not LOG_DIR.is_dir():
        return ""
    logs = sorted(
        [p for p in LOG_DIR.glob("*.log") if p.name.lower() != "metaeditor.log"],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not logs:
        return ""
    data = logs[0].read_bytes()[-max_bytes:]
    for enc in ("utf-16-le", "utf-16", "utf-8", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return ""


def parse_journal_snapshot(login_hint: str | None = None, expected_login: str | None = None) -> dict[str, Any]:
    text = _latest_journal_text()
    tail = text[-12000:] if text else ""
    found_login = None
    server = None
    company = None
    positions = None
    orders = None
    symbols = None
    demo_account = None

    m_co = _COMPANY_RE.search(tail)
    if m_co:
        found_login = m_co.group(1)
        company = m_co.group(2).strip()
        positions = int(m_co.group(3))
        orders = int(m_co.group(4))
        symbols = int(m_co.group(5))
    m_ok = _AUTH_OK_RE.search(tail)
    if m_ok and not found_login:
        found_login = m_ok.group(1) or m_ok.group(3)
        server = m_ok.group(2) if m_ok.group(2) else None
    if not found_login:
        m = _ACCOUNT_RE.search(tail)
        if m:
            found_login = m.group(1)
    if _DEMO_MODE_RE.search(tail):
        demo_account = True

    auth_fail = bool(_AUTH_FAIL_RE.search(tail[-4000:]))
    authenticated = bool(m_ok or m_co) and not auth_fail
    if expected_login and found_login and found_login != expected_login:
        authenticated = False
        auth_error = "ACCOUNT_MISMATCH"
    elif auth_fail:
        authenticated = False
        auth_error = "AUTH_FAILED"
    else:
        auth_error = None

    return {
        "authenticated": authenticated,
        "authError": auth_error,
        "loginExact": found_login,
        "loginHint": (f"••••{found_login[-4:]}" if found_login else login_hint),
        "server": server,
        "company": company,
        "openPositionsCount": positions,
        "pendingOrdersCount": orders,
        "symbolsCount": symbols,
        "demoAccount": demo_account,
        "journalAvailable": bool(text),
        "source": "journal",
    }


def _mcp_account(server_hint: str | None = None) -> dict[str, Any] | None:
    try:
        client = mt5_mcp.Mt5McpClient()
        raw = client.call_tool("get_trading_account_info", {})
        return mt5_mcp.normalize_account_info(raw, server_hint=server_hint)
    except ValueError as exc:
        return {"error": str(exc), "source": "mt5_mcp"}


def _read_mql_snapshot(max_age_sec: float = 120.0) -> dict[str, Any] | None:
    """Read read-only MQL5 Expert dump if present. Never contains passwords.

    When age exceeds max_age_sec, returns error=MQL_SNAPSHOT_STALE (callers may
    still use a higher max_age and then set freshness from ageSec).
    """
    import json

    candidates = [SNAPSHOT_COMMON, SNAPSHOT_LOCAL]
    newest: Path | None = None
    newest_mtime = 0.0
    for p in candidates:
        try:
            if p.is_file():
                m = p.stat().st_mtime
                if m > newest_mtime:
                    newest = p
                    newest_mtime = m
        except OSError:
            continue
    if newest is None:
        return None
    age = time.time() - newest_mtime
    if age > max_age_sec:
        return {"error": "MQL_SNAPSHOT_STALE", "ageSec": age, "source": "mql5_readonly_snapshot", "path": str(newest)}
    try:
        # Cap read size to protect 1-vCPU / low-RAM VPS.
        raw = newest.read_bytes()
        if len(raw) > 512_000:
            return {"error": "MQL_SNAPSHOT_TOO_LARGE", "ageSec": age, "source": "mql5_readonly_snapshot"}
        data = json.loads(raw.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return {"error": f"MQL_SNAPSHOT_BAD_JSON:{type(exc).__name__}", "source": "mql5_readonly_snapshot"}
    if not isinstance(data, dict):
        return {"error": "MQL_SNAPSHOT_BAD_JSON", "source": "mql5_readonly_snapshot"}
    acct = data.get("account") if isinstance(data.get("account"), dict) else {}
    return {
        "loginExact": acct.get("loginExact"),
        "loginHint": (f"••••{str(acct.get('loginExact'))[-4:]}" if acct.get("loginExact") else None),
        "server": acct.get("server"),
        "company": acct.get("company"),
        "currency": acct.get("currency"),
        "leverage": str(acct.get("leverage")) if acct.get("leverage") is not None else None,
        "balance": acct.get("balance"),
        "equity": acct.get("equity"),
        "credit": acct.get("credit"),
        "profit": acct.get("profit"),
        "usedMargin": acct.get("usedMargin"),
        "freeMargin": acct.get("freeMargin"),
        "marginLevel": acct.get("marginLevel"),
        "openPositionsCount": acct.get("openPositionsCount"),
        "pendingOrdersCount": acct.get("pendingOrdersCount"),
        "demoAccount": acct.get("demoAccount"),
        "accountType": "demo" if acct.get("demoAccount") else None,
        "tradePermissions": "allowed" if acct.get("tradeAllowed") else "restricted",
        "quotes": data.get("quotes") if isinstance(data.get("quotes"), list) else [],
        "candles": data.get("candles") if isinstance(data.get("candles"), dict) else {},
        "candlesIncluded": bool(data.get("candlesIncluded")),
        "seq": data.get("seq"),
        "brokerTime": data.get("brokerTime"),
        "gmtTime": data.get("gmtTime"),
        "schemaVersion": data.get("schemaVersion"),
        "authenticated": bool(acct.get("loginExact")),
        "source": "mql5_readonly_snapshot",
        "path": str(newest),
        "ageSec": age,
        "fileMtime": newest_mtime,
    }


def _infer_market_closed(
    broker_time: Any,
    gmt_time: Any,
    terminal_ok: bool,
    lag_sec: float = 3600.0,
) -> bool:
    """Distinguish closed FX session from disconnected feed.

    MT5 TimeCurrent (brokerTime) freezes when the market/session is closed while
    TimeGMT continues. A large positive lag with a live terminal means MARKET_CLOSED,
    not DISCONNECTED. Unchanged bid/ask alone is never treated as stale.
    """
    if not terminal_ok:
        return False
    try:
        bt = float(broker_time)
        gt = float(gmt_time)
    except (TypeError, ValueError):
        return False
    if bt <= 0 or gt <= 0:
        return False
    return (gt - bt) >= lag_sec


def _freshness_from_age(
    age_sec: float | None,
    live_max: float = 15.0,
    stale_max: float = 180.0,
    *,
    market_closed: bool = False,
) -> str:
    if age_sec is None:
        return "DATA_UNAVAILABLE"
    if age_sec <= live_max:
        return "MARKET_CLOSED" if market_closed else "LIVE"
    if age_sec <= stale_max:
        return "STALE"
    return "DISCONNECTED"


def stream_snapshot(include_candles: bool = False) -> dict[str, Any]:
    """Authoritative Demo feed for the Phase 1 realtime hub (read-only)."""
    status = connection_status()
    # Prefer a recent periodic dump; allow up to 600s so weekend/idle still returns state.
    mql = _read_mql_snapshot(max_age_sec=600.0)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    terminal_ok = bool(status.get("terminalRunning"))
    # Keep cache warm from durable Expert dump on every hub poll (not only candle API loads).
    dump_sync = _sync_periodic_candle_dump_cache()
    if not mql or mql.get("error"):
        journal = parse_journal_snapshot(expected_login=_last_demo_meta.get("login"))
        freshness = "DISCONNECTED" if not terminal_ok else "WAITING_FOR_DATA"
        return {
            "broker": "HFM_MT5",
            "environment": "demo",
            "terminalRunning": terminal_ok,
            "terminalConnected": bool(status.get("terminalConnected")),
            "authenticated": bool(journal.get("authenticated")),
            "freshness": freshness,
            "seq": None,
            "brokerTime": None,
            "serverReceivedAt": now,
            "account": {
                "loginHint": journal.get("loginHint"),
                "loginExact": journal.get("loginExact"),
                "server": journal.get("server") or _last_demo_meta.get("server"),
                "currency": None,
                "balance": None,
                "equity": None,
                "freeMargin": None,
                "usedMargin": None,
                "marginLevel": None,
                "leverage": None,
                "openPositionsCount": journal.get("openPositionsCount"),
                "pendingOrdersCount": journal.get("pendingOrdersCount"),
                "company": journal.get("company"),
                "demoAccount": journal.get("demoAccount"),
                "connectionStatus": "connected" if journal.get("authenticated") else "waiting",
            },
            "quotes": [],
            "candles": {},
            "candleCacheSync": dump_sync,
            "source": "journal_fallback" if journal.get("authenticated") else "unavailable",
            "mqlError": (mql or {}).get("error") if isinstance(mql, dict) else "MQL_SNAPSHOT_MISSING",
            "ageSec": (mql or {}).get("ageSec") if isinstance(mql, dict) else None,
            "ordersEnabled": False,
            "mutatesBroker": False,
        }

    age = float(mql.get("ageSec") or 0.0)
    market_closed = _infer_market_closed(mql.get("brokerTime"), mql.get("gmtTime"), terminal_ok)
    freshness = _freshness_from_age(age, market_closed=market_closed)
    if not terminal_ok:
        freshness = "DISCONNECTED"
        market_closed = False
    quotes_out = []
    for item in mql.get("quotes") or []:
        if not isinstance(item, dict):
            continue
        sym = item.get("symbol")
        if not isinstance(sym, str) or not sym:
            continue
        bid = item.get("bid") if isinstance(item.get("bid"), (int, float)) else None
        ask = item.get("ask") if isinstance(item.get("ask"), (int, float)) else None
        last = item.get("last") if isinstance(item.get("last"), (int, float)) else None
        # Pass incomplete/invalid sides through for Node validation — never silently
        # omit a subscribed symbol row that the Expert emitted.
        if bid is None and ask is None and last is None and item.get("tickTime") is None:
            continue
        quotes_out.append(
            {
                "symbol": sym,
                "bid": bid,
                "ask": ask,
                "last": last,
                "spread": item.get("spread"),
                "brokerSpreadPoints": item.get("brokerSpreadPoints"),
                "digits": item.get("digits"),
                "point": item.get("point"),
                "tickSize": item.get("tickSize"),
                "tickTime": item.get("tickTime"),
                "tickTimeMs": item.get("tickTimeMs"),
                "tickVolume": item.get("tickVolume"),
                "realVolume": item.get("realVolume"),
                "tickFlags": item.get("tickFlags"),
                "acquisitionMethod": item.get("acquisitionMethod"),
                "freshness": freshness,
                "source": "mql5_readonly_snapshot",
                "provider": "HFM_MT5",
                "environment": item.get("environment") or "demo",
            }
        )
    candles_out: dict[str, Any] = {}
    if include_candles and isinstance(mql.get("candles"), dict):
        candles_out = mql["candles"]
        if candles_out:
            _persist_candle_cache(candles_out, seq=mql.get("seq"), source="mql5_readonly_snapshot")
    return {
        "broker": "HFM_MT5",
        "environment": "demo",
        "terminalRunning": terminal_ok,
        "terminalConnected": bool(status.get("terminalConnected")),
        "authenticated": bool(mql.get("authenticated")),
        "freshness": freshness,
        "marketClosed": market_closed,
        "seq": mql.get("seq"),
        "brokerTime": mql.get("brokerTime"),
        "gmtTime": mql.get("gmtTime"),
        "schemaVersion": mql.get("schemaVersion"),
        "serverReceivedAt": now,
        "ageSec": age,
        "account": {
            "loginHint": mql.get("loginHint"),
            "loginExact": mql.get("loginExact"),
            "server": mql.get("server") or _last_demo_meta.get("server"),
            "currency": mql.get("currency"),
            "balance": mql.get("balance"),
            "equity": mql.get("equity"),
            "credit": mql.get("credit"),
            "profit": mql.get("profit"),
            "freeMargin": mql.get("freeMargin"),
            "usedMargin": mql.get("usedMargin"),
            "marginLevel": mql.get("marginLevel"),
            "leverage": mql.get("leverage"),
            "openPositionsCount": mql.get("openPositionsCount"),
            "pendingOrdersCount": mql.get("pendingOrdersCount"),
            "company": mql.get("company"),
            "demoAccount": mql.get("demoAccount"),
            "connectionStatus": "connected" if mql.get("authenticated") else "waiting",
            "source": "mql5_readonly_snapshot",
            "freshness": freshness,
            "ageSec": age,
        },
        "quotes": quotes_out,
        "candles": candles_out,
        "candlesIncluded": bool(mql.get("candlesIncluded")) and bool(candles_out),
        "candleCacheSync": dump_sync,
        "source": "mql5_readonly_snapshot",
        "ordersEnabled": False,
        "mutatesBroker": False,
        "placesOrders": False,
        "acceptsForExecution": False,
    }


def ensure_readonly_expert_installed() -> dict[str, Any]:
    """Copy + compile the read-only snapshot Expert into the Wine MT5 tree."""
    src_dir = Path(__file__).resolve().parent / "mql5"
    src = src_dir / EXPERT_MQ5_NAME
    experts = TERM_ROOT / "MQL5/Experts"
    dst = experts / EXPERT_MQ5_NAME
    ex5 = experts / EXPERT_EX5_NAME
    if not src.is_file():
        return {"installed": False, "reason": "SOURCE_MQ5_MISSING", "src": str(src)}
    experts.mkdir(parents=True, exist_ok=True)
    src_bytes = src.read_bytes()
    src_sha = hashlib.sha256(src_bytes).hexdigest()
    # Skip destructive recompile when Experts already match repo source and .ex5 exists.
    if dst.is_file() and ex5.is_file():
        try:
            dst_sha = hashlib.sha256(dst.read_bytes()).hexdigest()
            if dst_sha == src_sha and ex5.stat().st_size > 0:
                return {
                    "installed": True,
                    "skippedCompile": True,
                    "reason": "ALREADY_CURRENT",
                    "ex5Present": True,
                    "ex5Rebuilt": False,
                    "ex5Mtime": ex5.stat().st_mtime,
                    "ex5Size": ex5.stat().st_size,
                    "mq5": str(dst),
                    "ex5": str(ex5),
                    "mq5Sha256": src_sha,
                }
        except OSError:
            pass
    dst.write_bytes(src_bytes)
    metaeditor = TERM_ROOT / "MetaEditor64.exe"
    if not metaeditor.is_file():
        metaeditor = TERM_ROOT / "metaeditor64.exe"
    if not metaeditor.is_file():
        return {"installed": False, "reason": "METAEDITOR_MISSING", "mq5": str(dst), "ex5Present": ex5.is_file()}
    env = os.environ.copy()
    env.update(
        {
            "WINEPREFIX": WINEPREFIX,
            "WINEARCH": "win64",
            "WINEDEBUG": "-all",
            "DISPLAY": DISPLAY,
            "XAUTHORITY": XAUTHORITY,
            "HOME": "/home/mt5",
        }
    )
    # Wine MetaEditor /compile fails when invoked with a "Program Files" path as a
    # single argv. Compile from C:\users\mt5\kwizera-mql-compile via cmd.exe batch.
    compile_dir = Path(WINEPREFIX) / "drive_c/users/mt5/kwizera-mql-compile"
    compile_dir.mkdir(parents=True, exist_ok=True)
    compile_mq5 = compile_dir / EXPERT_MQ5_NAME
    compile_ex5 = compile_dir / EXPERT_EX5_NAME
    compile_log = compile_dir / (EXPERT_MQ5_NAME.replace(".mq5", ".log"))
    compile_mq5.write_bytes(src.read_bytes())
    bat = compile_dir / "compile_kwizera.bat"
    bat.write_text(
        "@echo off\r\n"
        "cd /d C:\\users\\mt5\\kwizera-mql-compile\r\n"
        f"\"C:\\Program Files\\HFM Metatrader 5\\MetaEditor64.exe\" /compile:{EXPERT_MQ5_NAME} /log\r\n",
        encoding="utf-8",
    )
    try:
        if compile_ex5.is_file():
            compile_ex5.unlink()
    except OSError:
        pass
    try:
        if compile_log.is_file():
            compile_log.unlink()
    except OSError:
        pass
    prev_mtime = ex5.stat().st_mtime if ex5.is_file() else 0.0
    prev_size = ex5.stat().st_size if ex5.is_file() else 0
    # Keep a backup until the new EX5 lands.
    bak = experts / (EXPERT_EX5_NAME + ".bak")
    try:
        if ex5.is_file():
            try:
                if bak.is_file():
                    bak.unlink()
            except OSError:
                pass
            ex5.replace(bak)
    except OSError:
        pass
    try:
        proc = subprocess.Popen(
            [WINE_BIN, "cmd", "/c", r"C:\users\mt5\kwizera-mql-compile\compile_kwizera.bat"],
            env=env,
            cwd=str(TERM_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        deadline = time.time() + 180.0
        rebuilt = False
        while time.time() < deadline:
            produced = compile_ex5 if compile_ex5.is_file() else None
            if produced is not None:
                try:
                    st = produced.stat()
                    if st.st_size > 0:
                        size1 = st.st_size
                        time.sleep(0.5)
                        size2 = produced.stat().st_size if produced.is_file() else 0
                        if size1 == size2 and size2 > 0:
                            ex5.write_bytes(produced.read_bytes())
                            rebuilt = True
                            break
                except OSError:
                    pass
            if proc.poll() is not None and time.time() > deadline - 30:
                # Batch may exit before EX5 flush completes; keep polling briefly.
                pass
            time.sleep(0.5)
        stdout = ""
        stderr = ""
        try:
            if proc.poll() is None:
                proc.terminate()
                try:
                    stdout, stderr = proc.communicate(timeout=10)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    stdout, stderr = proc.communicate(timeout=5)
            else:
                stdout, stderr = proc.communicate(timeout=5)
        except Exception:
            pass
        if not rebuilt and not ex5.is_file() and bak.is_file():
            # Restore previous binary so Demo StartUp Expert remains attachable.
            try:
                bak.replace(ex5)
            except OSError:
                pass
        new_mtime = ex5.stat().st_mtime if ex5.is_file() else 0.0
        new_size = ex5.stat().st_size if ex5.is_file() else 0
        return {
            "installed": rebuilt and ex5.is_file(),
            "compileReturncode": proc.returncode,
            "ex5Present": ex5.is_file(),
            "ex5Rebuilt": rebuilt,
            "ex5Mtime": new_mtime or None,
            "ex5Size": new_size or None,
            "prevSize": prev_size or None,
            "mq5": str(dst),
            "ex5": str(ex5),
            "stdoutTail": (stdout or "")[-400:],
            "stderrTail": (stderr or "")[-400:],
        }
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        if not ex5.is_file() and bak.is_file():
            try:
                bak.replace(ex5)
            except OSError:
                pass
        return {
            "installed": ex5.is_file(),
            "reason": type(exc).__name__,
            "ex5Present": ex5.is_file(),
            "mq5": str(dst),
        }


def _wait_for_mcp_account(
    expected_login: str,
    server: str,
    timeout_sec: float = 45.0,
) -> dict[str, Any]:
    deadline = time.time() + timeout_sec
    last: dict[str, Any] = {}
    while time.time() < deadline:
        if not terminal_running():
            time.sleep(1.5)
            continue
        # Give MCP listener time after restart.
        if not mt5_mcp.mcp_reachable():
            time.sleep(1.5)
            continue
        acct = _mcp_account(server_hint=server)
        if not acct or acct.get("error"):
            last = acct or {}
            time.sleep(2.0)
            continue
        exact = str(acct.get("loginExact") or "")
        if exact and exact != expected_login:
            last = {**acct, "authError": "ACCOUNT_MISMATCH", "authenticated": False}
            time.sleep(2.0)
            continue
        if exact == expected_login or acct.get("balance") is not None or acct.get("currency"):
            return {**acct, "authenticated": True, "authError": None}
        last = acct
        # Parallel path: MQL5 read-only snapshot Expert dump.
        mql = _read_mql_snapshot(max_age_sec=180.0)
        if mql and not mql.get("error") and (
            str(mql.get("loginExact") or "") == expected_login or mql.get("balance") is not None
        ):
            return {**mql, "authenticated": True, "authError": None}
        time.sleep(2.0)
    # Fallback: journal inference (identity + sync counts). Financials stay null without MCP/MQL dump.
    journal = parse_journal_snapshot(
        login_hint="••••" + expected_login[-4:],
        expected_login=expected_login,
    )
    return {
        "loginHint": journal.get("loginHint"),
        "loginExact": journal.get("loginExact"),
        "server": journal.get("server") or server,
        "currency": None,
        "balance": None,
        "equity": None,
        "credit": None,
        "profit": None,
        "freeMargin": None,
        "usedMargin": None,
        "marginLevel": None,
        "leverage": None,
        "company": journal.get("company"),
        "openPositionsCount": journal.get("openPositionsCount"),
        "pendingOrdersCount": journal.get("pendingOrdersCount"),
        "symbolsCount": journal.get("symbolsCount"),
        "demoAccount": journal.get("demoAccount"),
        "accountType": "demo" if journal.get("demoAccount") else None,
        "authenticated": bool(journal.get("authenticated")),
        "authError": (
            None
            if journal.get("authenticated")
            else (journal.get("authError") or last.get("error") or "MCP_ACCOUNT_TIMEOUT")
        ),
        "source": "journal_fallback",
        "note": (
            "Journal-verified Demo identity; balance/equity/margin require working MT5 MCP ApiKey."
            if journal.get("authenticated")
            else "MCP account info not available yet; journal-only inference."
        ),
        **{k: v for k, v in last.items() if k not in {"error", "authenticated", "authError"}},
    }


def demo_login(login: str, server: str, password: str) -> dict[str, Any]:
    _validate_demo(login, server)
    if not password or len(password) < 4 or len(password) > 128:
        raise ValueError("INVALID_PASSWORD")
    if "\n" in password or "\r" in password or "\0" in password:
        raise ValueError("INVALID_PASSWORD")

    # Ensure runtime dir exists for Wine Z:\run mapping.
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    # Ensure Z: dosdevice points at / if missing (Wine default usually has z: → /).
    z_link = Path(WINEPREFIX) / "dosdevices/z:"
    if not z_link.exists() and not z_link.is_symlink():
        try:
            z_link.symlink_to("/")
        except OSError:
            pass

    expert_meta = ensure_readonly_expert_installed()
    ini = _write_login_ini(login, server, password, start_snapshot_expert=bool(expert_meta.get("ex5Present") or expert_meta.get("installed")))
    password = ""
    try:
        # Remove stale snapshot so we only accept a post-login dump.
        for stale in (SNAPSHOT_COMMON, SNAPSHOT_LOCAL):
            try:
                stale.unlink(missing_ok=True)
            except OSError:
                pass
        _stop_terminal()
        _start_terminal_with_config(ini)
        # Allow Wine + terminal + MCP to come up before shredding INI.
        time.sleep(10)
        # Journal auth often lands before the StartUp Expert writes the MQL snapshot.
        snap = _wait_for_mcp_account(expected_login=login, server=server, timeout_sec=90)
        status = connection_status()
        authenticated = bool(snap.get("authenticated")) and not snap.get("authError")
        if snap.get("loginExact") and snap["loginExact"] != login:
            authenticated = False
            snap["authError"] = "ACCOUNT_MISMATCH"
        if snap.get("server") and snap["server"] not in DEMO_SERVER_ALLOW and snap["server"] != server:
            # Some builds return short names; keep expected server from login request.
            pass
        _last_demo_meta["login"] = login
        _last_demo_meta["server"] = server

        account = {
            "loginHint": snap.get("loginHint") or ("••••" + login[-4:]),
            "server": server,
            "currency": snap.get("currency"),
            "balance": snap.get("balance"),
            "equity": snap.get("equity"),
            "credit": snap.get("credit"),
            "profit": snap.get("profit"),
            "freeMargin": snap.get("freeMargin"),
            "usedMargin": snap.get("usedMargin"),
            "marginLevel": snap.get("marginLevel"),
            "leverage": snap.get("leverage"),
            "company": snap.get("company"),
            "accountType": snap.get("accountType"),
            "tradePermissions": snap.get("tradePermissions"),
            "mcpTradeAllowed": snap.get("mcpTradeAllowed"),
            "expertsTradeAllowed": snap.get("expertsTradeAllowed"),
            "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": snap.get("source") or "mt5_mcp",
            "note": snap.get("note"),
        }
        return {
            "environment": "demo",
            "loginAccepted": True,
            "server": server,
            "loginHint": "••••" + login[-4:],
            "expectedLogin": login,
            "terminalRunning": status["terminalRunning"],
            "terminalConnected": status["terminalConnected"],
            "authenticated": authenticated,
            "authError": snap.get("authError"),
            "mcp": status.get("mcp"),
            "account": account,
            "marketData": {
                "symbols": None,
                "quotesAvailable": None,
                "stale": None,
                "note": "Use demo.quotes_snapshot / demo.symbols after authentication.",
            },
        }
    finally:
        _shred(ini)


def account_snapshot() -> dict[str, Any]:
    status = connection_status()
    server = _last_demo_meta.get("server")
    expected = _last_demo_meta.get("login")
    snap = _mcp_account(server_hint=server)
    if not snap or snap.get("error"):
        mql = _read_mql_snapshot(max_age_sec=3600.0)
        if mql and not mql.get("error"):
            if expected and mql.get("loginExact") and str(mql["loginExact"]) != expected:
                pass
            else:
                age = mql.get("ageSec")
                stale = isinstance(age, (int, float)) and float(age) > 180.0
                return {
                    "terminalRunning": status["terminalRunning"],
                    "terminalConnected": status["terminalConnected"],
                    "authenticated": True,
                    "mcp": status.get("mcp"),
                    "account": {
                        "loginHint": mql.get("loginHint"),
                        "loginExact": mql.get("loginExact"),
                        "server": mql.get("server") or server,
                        "currency": mql.get("currency"),
                        "balance": mql.get("balance"),
                        "equity": mql.get("equity"),
                        "credit": mql.get("credit"),
                        "profit": mql.get("profit"),
                        "freeMargin": mql.get("freeMargin"),
                        "usedMargin": mql.get("usedMargin"),
                        "marginLevel": mql.get("marginLevel"),
                        "leverage": mql.get("leverage"),
                        "company": mql.get("company"),
                        "demoAccount": mql.get("demoAccount"),
                        "accountType": mql.get("accountType"),
                        "openPositionsCount": mql.get("openPositionsCount"),
                        "pendingOrdersCount": mql.get("pendingOrdersCount"),
                        "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "source": "mql5_readonly_snapshot",
                        "stale": stale,
                        "ageSec": age,
                        "freshness": _freshness_from_age(float(age) if isinstance(age, (int, float)) else None),
                        "note": (
                            "Account fields from read-only MQL5 snapshot Expert (stale; re-login/sync to refresh)."
                            if stale
                            else "Account fields from periodic read-only MQL5 snapshot Expert."
                        ),
                    },
                    "quotes": mql.get("quotes") or [],
                }
        journal = parse_journal_snapshot(expected_login=expected)
        return {
            "terminalRunning": status["terminalRunning"],
            "terminalConnected": status["terminalConnected"],
            "authenticated": bool(journal.get("authenticated")),
            "mcp": status.get("mcp"),
            "account": {
                "loginHint": journal.get("loginHint"),
                "loginExact": journal.get("loginExact"),
                "server": journal.get("server") or server,
                "currency": None,
                "balance": None,
                "equity": None,
                "freeMargin": None,
                "usedMargin": None,
                "marginLevel": None,
                "leverage": None,
                "company": journal.get("company"),
                "openPositionsCount": journal.get("openPositionsCount"),
                "pendingOrdersCount": journal.get("pendingOrdersCount"),
                "symbolsCount": journal.get("symbolsCount"),
                "demoAccount": journal.get("demoAccount"),
                "accountType": "demo" if journal.get("demoAccount") else None,
                "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) if journal.get("authenticated") else None,
                "source": "journal_fallback" if journal.get("authenticated") else "unavailable",
                "note": (
                    "Journal-verified Demo identity; balance/equity require MQL snapshot or working MCP."
                    if journal.get("authenticated")
                    else (snap.get("error") if snap else "MCP_UNAVAILABLE")
                ),
                "unavailableReason": None if journal.get("authenticated") else (snap.get("error") if snap else "MCP_UNAVAILABLE"),
            },
        }

    expected = _last_demo_meta.get("login")
    authenticated = True
    auth_error = None
    if expected and snap.get("loginExact") and snap["loginExact"] != expected:
        authenticated = False
        auth_error = "ACCOUNT_MISMATCH"

    return {
        "terminalRunning": status["terminalRunning"],
        "terminalConnected": status["terminalConnected"],
        "authenticated": authenticated,
        "authError": auth_error,
        "mcp": status.get("mcp"),
        "account": {
            "loginHint": snap.get("loginHint"),
            "server": snap.get("server") or server,
            "currency": snap.get("currency"),
            "balance": snap.get("balance"),
            "equity": snap.get("equity"),
            "credit": snap.get("credit"),
            "profit": snap.get("profit"),
            "freeMargin": snap.get("freeMargin"),
            "usedMargin": snap.get("usedMargin"),
            "marginLevel": snap.get("marginLevel"),
            "leverage": snap.get("leverage"),
            "company": snap.get("company"),
            "accountType": snap.get("accountType"),
            "tradePermissions": snap.get("tradePermissions"),
            "mcpTradeAllowed": snap.get("mcpTradeAllowed"),
            "expertsTradeAllowed": snap.get("expertsTradeAllowed"),
            "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "mt5_mcp",
            "note": snap.get("note"),
        },
    }


def symbols_snapshot() -> dict[str, Any]:
    try:
        client = mt5_mcp.Mt5McpClient()
        raw = client.call_tool("get_marketwatch_symbols", {})
        symbols = mt5_mcp.normalize_symbols(raw)
        return {
            "available": bool(symbols),
            "count": len(symbols),
            "symbols": symbols,
            "source": "mt5_mcp",
            "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    except ValueError as exc:
        return {
            "available": False,
            "count": 0,
            "symbols": [],
            "source": "mt5_mcp",
            "unavailableReason": str(exc),
        }


def quotes_snapshot(symbols: list[str] | None = None) -> dict[str, Any]:
    mql = _read_mql_snapshot(max_age_sec=3600.0)
    if mql and not mql.get("error") and mql.get("quotes"):
        wanted = {s.upper() for s in (symbols or []) if s}
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        age = mql.get("ageSec")
        snapshot_stale = isinstance(age, (int, float)) and float(age) > 180.0
        quotes = []
        for item in mql.get("quotes") or []:
            if not isinstance(item, dict):
                continue
            sym = str(item.get("symbol") or "")
            if wanted and sym.upper() not in wanted:
                continue
            bid = item.get("bid")
            ask = item.get("ask")
            spread = item.get("spread")
            fresh = None
            stale = None
            if isinstance(bid, (int, float)) and isinstance(ask, (int, float)):
                ok = float(bid) > 0 and float(ask) > 0 and float(ask) >= float(bid)
                fresh = ok and not snapshot_stale
                stale = (not ok) or snapshot_stale
            quotes.append(
                {
                    "symbol": sym,
                    "bid": bid,
                    "ask": ask,
                    "spread": spread,
                    "tickTime": item.get("tickTime"),
                    "retrievedAt": now,
                    "fresh": fresh,
                    "stale": stale,
                    "source": "mql5_readonly_snapshot",
                    "provider": "HFM_MT5",
                    "environment": "demo",
                    "ageSec": age,
                }
            )
        any_fresh = any(q.get("fresh") for q in quotes)
        return {
            "quotesAvailable": bool(quotes) and any_fresh is not False,
            "stale": all(q.get("stale") for q in quotes) if quotes else None,
            "quotes": quotes,
            "requestedSymbols": symbols or [],
            "source": "mql5_readonly_snapshot",
            "retrievedAt": now,
            "note": (
                None
                if quotes and any_fresh
                else ("MQL snapshot quotes are stale; re-login/sync to refresh." if quotes else "MQL snapshot had no matching quotes.")
            ),
        }
    try:
        client = mt5_mcp.Mt5McpClient()
        raw = client.call_tool("get_marketwatch_symbols", {})
        all_syms = mt5_mcp.normalize_symbols(raw)
        wanted = {s.upper() for s in (symbols or []) if s}
        quotes = []
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        for item in all_syms:
            sym = str(item.get("brokerSymbol") or "")
            if wanted and sym.upper() not in wanted and not any(sym.upper().startswith(w) for w in wanted):
                continue
            bid = item.get("bid")
            ask = item.get("ask")
            if bid is None and ask is None:
                # Try symbol profile for quote.
                try:
                    detail = client.call_tool("marketdata_symbol_get", {"symbol": sym})
                    detail_n = mt5_mcp.normalize_symbols(detail)
                    if detail_n:
                        bid = detail_n[0].get("bid")
                        ask = detail_n[0].get("ask")
                        item = {**item, **detail_n[0]}
                except ValueError:
                    pass
            spread = item.get("spread")
            if spread is None and isinstance(bid, (int, float)) and isinstance(ask, (int, float)):
                spread = float(ask) - float(bid)
            fresh = None
            stale = None
            if bid is not None and ask is not None:
                ok = float(bid) > 0 and float(ask) > 0
                if ok and float(ask) < float(bid):
                    ok = False
                fresh = ok
                stale = not ok
            quotes.append(
                {
                    "symbol": sym,
                    "bid": bid,
                    "ask": ask,
                    "spread": spread,
                    "last": item.get("last"),
                    "tickTime": item.get("time"),
                    "retrievedAt": now,
                    "fresh": fresh,
                    "stale": stale,
                    "source": "mt5_mcp",
                    "provider": "HFM_MT5",
                    "environment": "demo",
                }
            )
            if wanted and len(quotes) >= len(wanted):
                break
        any_fresh = any(q.get("fresh") for q in quotes)
        return {
            "quotesAvailable": bool(quotes) and any_fresh is not False,
            "stale": all(q.get("stale") for q in quotes) if quotes else None,
            "quotes": quotes,
            "requestedSymbols": symbols or [],
            "source": "mt5_mcp",
            "retrievedAt": now,
            "note": None if quotes else "No symbols/quotes returned from Market Watch.",
        }
    except ValueError as exc:
        return {
            "quotesAvailable": False,
            "stale": None,
            "quotes": [],
            "requestedSymbols": symbols or [],
            "source": "mt5_mcp",
            "unavailableReason": str(exc),
            "note": str(exc),
        }


def _normalize_mql_candle_bars(raw_bars: list[Any], limit: int) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for c in raw_bars:
        if not isinstance(c, dict):
            continue
        try:
            o = float(c["open"])
            h = float(c["high"])
            l = float(c["low"])
            cl = float(c["close"])
            t = int(c["time"])
        except (KeyError, TypeError, ValueError):
            continue
        if h < max(o, cl) or l > min(o, cl) or h < l:
            continue
        cleaned.append(
            {
                "time": t,
                "open": o,
                "high": h,
                "low": l,
                "close": cl,
                "tickVolume": c.get("tickVolume"),
                "realVolume": c.get("realVolume"),
                "spread": c.get("spread"),
            }
        )
    if len(cleaned) > limit:
        cleaned = cleaned[-limit:]
    return cleaned


def _candle_map_from_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    candles = payload.get("candles")
    return candles if isinstance(candles, dict) else {}


def _read_json_file(path: Path, *, max_age_sec: float | None = None) -> dict[str, Any] | None:
    try:
        if not path.is_file():
            return None
        age = time.time() - path.stat().st_mtime
        if max_age_sec is not None and age > max_age_sec:
            return {"error": "CANDLES_STALE", "ageSec": age, "path": str(path)}
        raw = path.read_bytes()
        if len(raw) > 1_500_000:
            return {"error": "CANDLES_TOO_LARGE", "ageSec": age, "path": str(path)}
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            return {"error": "CANDLES_BAD_JSON", "path": str(path)}
        data = dict(data)
        data.setdefault("ageSec", age)
        data.setdefault("path", str(path))
        return data
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def _read_candle_cache_meta() -> dict[str, Any]:
    try:
        if not CANDLES_CACHE.is_file():
            return {}
        st = CANDLES_CACHE.stat()
        raw = CANDLES_CACHE.read_bytes()
        if len(raw) > 2_000_000:
            return {"mtime": st.st_mtime, "error": "CACHE_TOO_LARGE"}
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            return {"mtime": st.st_mtime}
        return {
            "seq": data.get("seq"),
            "mtime": st.st_mtime,
            "cachedAt": data.get("cachedAt"),
            "source": data.get("source"),
            "candles": data.get("candles") if isinstance(data.get("candles"), dict) else {},
            "dumpRetrievedAt": data.get("dumpRetrievedAt"),
        }
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return {}


def _persist_candle_cache(
    candles_by_symbol: dict[str, Any],
    *,
    seq: Any = None,
    source: str = "mql5_readonly_snapshot",
    incoming_mtime: float | None = None,
    incoming_observed_at: Any = None,
) -> dict[str, Any]:
    if not snapshot_is_well_formed(candles_by_symbol):
        return {"updated": False, "reason": "REJECT_MALFORMED"}
    existing = _read_candle_cache_meta()
    accept, reason = should_accept_incoming_snapshot(
        incoming_seq=seq,
        existing_seq=existing.get("seq"),
        incoming_mtime=incoming_mtime,
        existing_mtime=existing.get("mtime") if isinstance(existing.get("mtime"), (int, float)) else None,
        incoming_observed_at=incoming_observed_at,
        existing_observed_at=existing.get("dumpRetrievedAt") or existing.get("cachedAt"),
    )
    if not accept:
        return {
            "updated": False,
            "reason": reason,
            "existingSeq": existing.get("seq"),
            "incomingSeq": seq,
        }
    try:
        RUN_DIR.mkdir(parents=True, exist_ok=True)
        # Partial dumps must not erase unrelated symbol/timeframe entries.
        merged = merge_candle_maps(existing.get("candles"), candles_by_symbol)
        payload = {
            "source": source,
            "provider": "HFM_MT5",
            "environment": "demo",
            "seq": seq,
            "cachedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "dumpRetrievedAt": incoming_observed_at,
            "candles": merged,
            "acceptReason": reason,
        }
        tmp = CANDLES_CACHE.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        # Core (kwizera) must be able to read cache for C7 reconcile / diagnostics.
        try:
            os.chmod(tmp, 0o644)
        except OSError:
            pass
        tmp.replace(CANDLES_CACHE)
        try:
            os.chmod(CANDLES_CACHE, 0o644)
        except OSError:
            pass
        return {
            "updated": True,
            "reason": reason,
            "seq": seq,
            "cachedAt": payload["cachedAt"],
            "source": source,
            "mergedSymbols": sorted(merged.keys()),
        }
    except OSError as exc:
        return {"updated": False, "reason": f"IO_{type(exc).__name__}"}


def _sync_periodic_candle_dump_cache() -> dict[str, Any]:
    """
    Event-driven cache refresh from the Expert durable candle dump file.

    Invoked on every stream_snapshot poll so cache tracks periodic dumps without
    requiring a client demo.candles / REST candle-load request.
    """
    last: dict[str, Any] = {"updated": False, "reason": "NO_DUMP"}
    for path in (CANDLES_COMMON, CANDLES_LOCAL):
        try:
            if not path.is_file():
                continue
            st = path.stat()
            # Skip obviously stale dumps (>30m) — do not wipe a fresher cache.
            if time.time() - st.st_mtime > 1800.0:
                last = {"updated": False, "reason": "DUMP_TOO_OLD", "path": str(path), "mtime": st.st_mtime}
                continue
            dumped = _read_json_file(path, max_age_sec=1800.0)
            if not dumped or dumped.get("error"):
                last = {"updated": False, "reason": (dumped or {}).get("error") or "DUMP_UNREADABLE", "path": str(path)}
                continue
            by_symbol = _candle_map_from_payload(dumped)
            if not by_symbol:
                last = {"updated": False, "reason": "DUMP_EMPTY_CANDLES", "path": str(path)}
                continue
            result = _persist_candle_cache(
                by_symbol,
                seq=dumped.get("seq"),
                source="mql5_readonly_candles",
                incoming_mtime=st.st_mtime,
                incoming_observed_at=dumped.get("retrievedAt"),
            )
            result = dict(result)
            result["path"] = str(path)
            result["dumpSeq"] = dumped.get("seq")
            result["dumpRetrievedAt"] = dumped.get("retrievedAt")
            return result
        except OSError as exc:
            last = {"updated": False, "reason": f"IO_{type(exc).__name__}", "path": str(path)}
    return last


def _load_candle_sources(*, wait_for_cycle_sec: float = 0.0) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (candles_by_symbol, meta) from snapshot / dedicated file / cache.

    Expert only embeds CopyRates every N quote snapshots. Between cycles the quote
    snapshot has candles={} — STEP 1 repairs this by retaining the last dump.
    """
    deadline = time.time() + max(0.0, wait_for_cycle_sec)
    meta: dict[str, Any] = {"source": None, "ageSec": None}
    while True:
        mql = _read_mql_snapshot(max_age_sec=600.0)
        if mql and not mql.get("error"):
            by_symbol = _candle_map_from_payload(mql)
            if by_symbol:
                _persist_candle_cache(by_symbol, seq=mql.get("seq"), source="mql5_readonly_snapshot")
                meta = {
                    "source": "mql5_readonly_snapshot",
                    "ageSec": mql.get("ageSec"),
                    "seq": mql.get("seq"),
                    "path": mql.get("path"),
                }
                return by_symbol, meta

        for path in (CANDLES_COMMON, CANDLES_LOCAL):
            dumped = _read_json_file(path, max_age_sec=600.0)
            if dumped and not dumped.get("error"):
                by_symbol = _candle_map_from_payload(dumped)
                if by_symbol:
                    _persist_candle_cache(
                        by_symbol,
                        seq=dumped.get("seq"),
                        source="mql5_readonly_candles",
                    )
                    meta = {
                        "source": "mql5_readonly_candles",
                        "ageSec": dumped.get("ageSec"),
                        "seq": dumped.get("seq"),
                        "path": dumped.get("path"),
                    }
                    return by_symbol, meta

        cached = _read_json_file(CANDLES_CACHE, max_age_sec=900.0)
        if cached and not cached.get("error"):
            by_symbol = _candle_map_from_payload(cached)
            if by_symbol:
                meta = {
                    "source": "agent_candles_cache",
                    "ageSec": cached.get("ageSec"),
                    "seq": cached.get("seq"),
                    "path": cached.get("path"),
                    "cachedAt": cached.get("cachedAt"),
                }
                return by_symbol, meta

        if time.time() >= deadline:
            break
        time.sleep(2.0)
    return {}, meta


def _common_file_dirs() -> list[Path]:
    return [CATALOG_COMMON_DIR, CATALOG_LOCAL_DIR]


def _write_request_file(name: str, body: str) -> Path | None:
    for base in _common_file_dirs():
        try:
            base.mkdir(parents=True, exist_ok=True)
            path = base / name
            path.write_text(body, encoding="utf-8")
            return path
        except OSError:
            continue
    return None


def _read_response_file(name: str, *, max_age_sec: float = 30.0) -> dict[str, Any] | None:
    for base in _common_file_dirs():
        path = base / name
        data = _read_json_file(path, max_age_sec=max_age_sec)
        if data and not data.get("error"):
            return data
    return None


def _history_cache_key(symbol: str, timeframe: str) -> str:
    return f"{symbol.upper()}__{timeframe.upper()}"


def _persist_history_bars(symbol: str, timeframe: str, bars: list[dict[str, Any]]) -> None:
    if not bars:
        return
    try:
        HISTORY_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        key = _history_cache_key(symbol, timeframe)
        path = HISTORY_CACHE_DIR / f"{key}.json"
        existing: list[dict[str, Any]] = []
        if path.is_file():
            try:
                prev = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(prev, dict) and isinstance(prev.get("candles"), list):
                    existing = [b for b in prev["candles"] if isinstance(b, dict)]
            except (OSError, json.JSONDecodeError):
                existing = []
        by_time: dict[int, dict[str, Any]] = {}
        for b in existing + bars:
            t = b.get("time")
            if not isinstance(t, (int, float)) or not math.isfinite(float(t)):
                continue
            ti = int(t)
            by_time[ti] = b
        merged = [by_time[k] for k in sorted(by_time.keys())]
        if len(merged) > HISTORY_CACHE_MAX_BARS:
            merged = merged[-HISTORY_CACHE_MAX_BARS:]
        payload = {
            "provider": "HFM_MT5",
            "environment": "demo",
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "cachedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "candles": merged,
            "count": len(merged),
        }
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        tmp.replace(path)
        # Bound key count.
        keys = sorted(HISTORY_CACHE_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        for stale in keys[HISTORY_CACHE_MAX_KEYS:]:
            try:
                stale.unlink()
            except OSError:
                pass
    except OSError:
        return


def _load_history_cache(symbol: str, timeframe: str, limit: int) -> dict[str, Any] | None:
    path = HISTORY_CACHE_DIR / f"{_history_cache_key(symbol, timeframe)}.json"
    data = _read_json_file(path, max_age_sec=3600.0)
    if not data or data.get("error"):
        return None
    bars = data.get("candles") if isinstance(data.get("candles"), list) else []
    cleaned = _normalize_mql_candle_bars(bars, limit)
    if not cleaned:
        return None
    age = data.get("ageSec")
    return {
        "symbol": symbol.upper(),
        "timeframe": timeframe,
        "candles": cleaned,
        "count": len(cleaned),
        "available": True,
        "source": "agent_history_cache",
        "provider": "HFM_MT5",
        "environment": "demo",
        "ageSec": age,
        "freshness": _freshness_from_age(float(age) if isinstance(age, (int, float)) else None),
        "hasMore": len(bars) > len(cleaned),
        "requestedCount": limit,
        "oldestTimestamp": cleaned[0].get("time") if cleaned else None,
        "newestTimestamp": cleaned[-1].get("time") if cleaned else None,
        "completeness": "cached",
        "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "placesOrders": False,
        "mutatesBroker": False,
        "acceptsForExecution": False,
    }


def _ondemand_copyrates(
    symbol: str,
    timeframe: str,
    limit: int,
    *,
    start_pos: int = 0,
    request_id: str | None = None,
    wait_sec: float = 18.0,
) -> dict[str, Any]:
    """Ask Expert v1.40+ to CopyRates for any valid catalog symbol (bounded)."""
    rid = request_id or f"hist-{int(time.time() * 1000)}-{os.getpid()}"
    line = f"{rid}|{symbol.upper()}|{timeframe}|{int(limit)}|{int(max(0, start_pos))}\n"
    # Clear stale response so we do not pick up a previous request.
    for base in _common_file_dirs():
        try:
            resp = base / HISTORY_RESPONSE_NAME
            if resp.is_file():
                resp.unlink()
        except OSError:
            pass
    if _write_request_file(HISTORY_REQUEST_NAME, line) is None:
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "candles": [],
            "count": 0,
            "available": False,
            "source": "mql5_ondemand_copyrates",
            "provider": "HFM_MT5",
            "environment": "demo",
            "unavailableReason": "HISTORY_REQUEST_WRITE_FAILED",
            "requestedCount": limit,
            "hasMore": False,
            "placesOrders": False,
            "mutatesBroker": False,
            "acceptsForExecution": False,
        }
    deadline = time.time() + max(2.0, wait_sec)
    while time.time() < deadline:
        data = _read_response_file(HISTORY_RESPONSE_NAME, max_age_sec=60.0)
        if data and str(data.get("requestId") or "") == rid:
            bars = data.get("candles") if isinstance(data.get("candles"), list) else []
            cleaned = _normalize_mql_candle_bars(bars, limit)
            if cleaned:
                _persist_history_bars(symbol, timeframe, cleaned)
            err = data.get("error")
            available = bool(data.get("available")) and bool(cleaned)
            return {
                "symbol": symbol.upper(),
                "timeframe": timeframe,
                "candles": cleaned,
                "count": len(cleaned),
                "available": available,
                "source": "mql5_ondemand_copyrates",
                "provider": "HFM_MT5",
                "environment": "demo",
                "expertVersion": data.get("expertVersion"),
                "requestId": rid,
                "requestedCount": limit,
                "startPos": start_pos,
                "hasMore": bool(data.get("hasMore")),
                "oldestTimestamp": cleaned[0].get("time") if cleaned else None,
                "newestTimestamp": cleaned[-1].get("time") if cleaned else None,
                "completeness": "broker" if available else "unavailable",
                "unavailableReason": None if available else (err or "COPYRATES_EMPTY"),
                "ageSec": 0,
                "freshness": "LIVE" if available else "DATA_UNAVAILABLE",
                "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                # E3-005: Expert snapshot clocks for Node candle UTC provenance.
                "brokerTime": data.get("brokerTime"),
                "gmtTime": data.get("gmtTime"),
                "placesOrders": False,
                "mutatesBroker": False,
                "acceptsForExecution": False,
            }
        time.sleep(0.5)
    return {
        "symbol": symbol.upper(),
        "timeframe": timeframe,
        "candles": [],
        "count": 0,
        "available": False,
        "source": "mql5_ondemand_copyrates",
        "provider": "HFM_MT5",
        "environment": "demo",
        "unavailableReason": "HISTORY_REQUEST_TIMEOUT",
        "requestId": rid,
        "requestedCount": limit,
        "hasMore": False,
        "note": "Expert did not answer history request in time (binary may predate v1.40).",
        "placesOrders": False,
        "mutatesBroker": False,
        "acceptsForExecution": False,
    }


def ticks(
    symbol: str,
    *,
    limit: int = 100,
    from_ms: int = 0,
    to_ms: int = 0,
    wait_sec: float = 18.0,
) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9._-]{2,32}", symbol):
        raise ValueError("INVALID_SYMBOL")
    if limit < 1 or limit > 500:
        raise ValueError("INVALID_LIMIT")
    rid = f"ticks-{int(time.time() * 1000)}-{os.getpid()}"
    line = f"{rid}|{symbol.upper()}|{int(limit)}|{int(from_ms)}|{int(to_ms)}\n"
    for base in _common_file_dirs():
        try:
            resp = base / TICKS_RESPONSE_NAME
            if resp.is_file():
                resp.unlink()
        except OSError:
            pass
    if _write_request_file(TICKS_REQUEST_NAME, line) is None:
        return {
            "symbol": symbol.upper(),
            "ticks": [],
            "count": 0,
            "available": False,
            "source": "mql5_ondemand_copyticks",
            "provider": "HFM_MT5",
            "environment": "demo",
            "unavailableReason": "TICKS_REQUEST_WRITE_FAILED",
            "placesOrders": False,
            "mutatesBroker": False,
            "acceptsForExecution": False,
        }
    deadline = time.time() + max(2.0, wait_sec)
    while time.time() < deadline:
        data = _read_response_file(TICKS_RESPONSE_NAME, max_age_sec=60.0)
        if data and str(data.get("requestId") or "") == rid:
            raw_ticks = data.get("ticks") if isinstance(data.get("ticks"), list) else []
            cleaned: list[dict[str, Any]] = []
            last_key: tuple[Any, ...] | None = None
            for t in raw_ticks:
                if not isinstance(t, dict):
                    continue
                bid, ask = t.get("bid"), t.get("ask")
                if not isinstance(bid, (int, float)) or not isinstance(ask, (int, float)):
                    continue
                if not math.isfinite(bid) or not math.isfinite(ask) or bid <= 0 or ask <= 0 or ask < bid:
                    continue
                key = (t.get("timeMsc") or t.get("time"), bid, ask)
                if key == last_key:
                    continue
                last_key = key
                cleaned.append(
                    {
                        "provider": "HFM_MT5",
                        "symbol": symbol.upper(),
                        "bid": float(bid),
                        "ask": float(ask),
                        "last": t.get("last") if isinstance(t.get("last"), (int, float)) else None,
                        "volume": t.get("volume") if isinstance(t.get("volume"), (int, float)) else None,
                        "volumeReal": t.get("volumeReal") if isinstance(t.get("volumeReal"), (int, float)) else None,
                        "flags": t.get("flags"),
                        "time": t.get("time"),
                        "timeMsc": t.get("timeMsc"),
                        "acquisition": "CopyTicks",
                    }
                )
            available = bool(data.get("available")) and bool(cleaned)
            return {
                "symbol": symbol.upper(),
                "ticks": cleaned,
                "count": len(cleaned),
                "available": available,
                "source": "mql5_ondemand_copyticks",
                "provider": "HFM_MT5",
                "environment": "demo",
                "expertVersion": data.get("expertVersion"),
                "requestId": rid,
                "requestedCount": limit,
                "unavailableReason": None if available else (data.get("error") or "COPYTICKS_EMPTY"),
                "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "placesOrders": False,
                "mutatesBroker": False,
                "acceptsForExecution": False,
            }
        time.sleep(0.5)
    return {
        "symbol": symbol.upper(),
        "ticks": [],
        "count": 0,
        "available": False,
        "source": "mql5_ondemand_copyticks",
        "provider": "HFM_MT5",
        "environment": "demo",
        "unavailableReason": "TICKS_REQUEST_TIMEOUT",
        "requestId": rid,
        "placesOrders": False,
        "mutatesBroker": False,
        "acceptsForExecution": False,
    }


def quote_watch(symbols: list[str]) -> dict[str, Any]:
    """Bounded extra SymbolSelect list for chart context (max 8)."""
    cleaned: list[str] = []
    for s in symbols:
        sym = str(s or "").strip().upper()
        if re.fullmatch(r"[A-Za-z0-9._-]{2,32}", sym) and sym not in cleaned:
            cleaned.append(sym)
        if len(cleaned) >= 8:
            break
    body = "\n".join(cleaned) + ("\n" if cleaned else "")
    written = _write_request_file(QUOTE_WATCH_REQUEST_NAME, body)
    return {
        "requested": written is not None,
        "symbols": cleaned,
        "provider": "HFM_MT5",
        "environment": "demo",
        "note": "Expert will SymbolSelect only these extras on next timer (not full catalog).",
        "placesOrders": False,
        "mutatesBroker": False,
        "acceptsForExecution": False,
    }


def chart_tick() -> dict[str, Any]:
    """Latest OnTick chart-symbol tick written by Expert (may be empty)."""
    for base in _common_file_dirs():
        data = _read_json_file(base / CHART_TICK_NAME, max_age_sec=30.0)
        if data and not data.get("error"):
            data["available"] = True
            data.setdefault("provider", "HFM_MT5")
            data.setdefault("environment", "demo")
            data["placesOrders"] = False
            data["mutatesBroker"] = False
            data["acceptsForExecution"] = False
            return data
    return {
        "available": False,
        "provider": "HFM_MT5",
        "environment": "demo",
        "unavailableReason": "CHART_TICK_UNAVAILABLE",
        "placesOrders": False,
        "mutatesBroker": False,
        "acceptsForExecution": False,
    }


def candles(
    symbol: str,
    timeframe: str,
    limit: int = 100,
    *,
    start_pos: int = 0,
    force_ondemand: bool = False,
) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9._-]{2,32}", symbol):
        raise ValueError("INVALID_SYMBOL")
    if limit < 1 or limit > 300:
        raise ValueError("INVALID_LIMIT")
    if start_pos < 0 or start_pos > 50000:
        raise ValueError("INVALID_START_POS")
    # Canonicalize first (`15m` → `M15`). Never use `.upper()` alone — that yields `15M`.
    try:
        tf_key = mt5_mcp.map_timeframe(str(timeframe or "").strip())
    except ValueError:
        raise ValueError("UNSUPPORTED_TIMEFRAME") from None

    sym_u = symbol.upper()

    # Pagination / forced refresh always uses on-demand CopyRates (catalog-capable).
    if force_ondemand or start_pos > 0:
        return _ondemand_copyrates(sym_u, tf_key, limit, start_pos=start_pos)

    # Prefer periodic MQL dump for the core 9-symbol universe.
    by_symbol, meta = _load_candle_sources(wait_for_cycle_sec=8.0)
    sym_map = by_symbol.get(sym_u) if isinstance(by_symbol, dict) else None
    if isinstance(sym_map, dict) and isinstance(sym_map.get(tf_key), list):
        cleaned = _normalize_mql_candle_bars(sym_map[tf_key], limit)
        if cleaned:
            age = meta.get("ageSec")
            _persist_history_bars(sym_u, tf_key, cleaned)
            mql = _read_mql_snapshot(max_age_sec=600.0) or {}
            return {
                "symbol": sym_u,
                "timeframe": tf_key,
                "candles": cleaned,
                "count": len(cleaned),
                "available": True,
                "source": meta.get("source") or "mql5_readonly_snapshot",
                "provider": "HFM_MT5",
                "environment": "demo",
                "ageSec": age,
                "freshness": _freshness_from_age(float(age) if isinstance(age, (int, float)) else None),
                "requestedCount": limit,
                "hasMore": len(sym_map[tf_key]) >= limit,
                "oldestTimestamp": cleaned[0].get("time"),
                "newestTimestamp": cleaned[-1].get("time"),
                "completeness": "broker_dump",
                "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                # E3-005: attach live Expert clocks when snapshot is readable.
                "brokerTime": mql.get("brokerTime") if not mql.get("error") else None,
                "gmtTime": mql.get("gmtTime") if not mql.get("error") else None,
                "placesOrders": False,
                "mutatesBroker": False,
                "acceptsForExecution": False,
            }

    # On-demand CopyRates for any catalog symbol (Expert v1.40+).
    ondemand = _ondemand_copyrates(sym_u, tf_key, limit, start_pos=0)
    if ondemand.get("available"):
        return ondemand

    cached = _load_history_cache(sym_u, tf_key, limit)
    if cached:
        cached["note"] = "Serving bounded history cache after on-demand miss/timeout."
        return cached

    # Explicit failure — never fabricate; MCP is not a dependency.
    return {
        "symbol": sym_u,
        "timeframe": tf_key,
        "candles": [],
        "count": 0,
        "available": False,
        "source": ondemand.get("source") or "mql5_ondemand_copyrates",
        "provider": "HFM_MT5",
        "environment": "demo",
        "unavailableReason": ondemand.get("unavailableReason") or "NO_HISTORY",
        "requestedCount": limit,
        "hasMore": False,
        "note": "HFM history unavailable for this symbol/timeframe (no synthetic bars).",
        "placesOrders": False,
        "mutatesBroker": False,
        "acceptsForExecution": False,
    }


def open_positions_snapshot() -> dict[str, Any]:
    try:
        client = mt5_mcp.Mt5McpClient()
        raw = client.call_tool("get_trading_open_positions", {})
        data = mt5_mcp._extract_text_payload(raw)
        return {
            "available": data is not None,
            "data": data,
            "source": "mt5_mcp",
            "readOnly": True,
            "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    except ValueError as exc:
        return {"available": False, "data": None, "unavailableReason": str(exc), "source": "mt5_mcp"}


def trade_history_snapshot() -> dict[str, Any]:
    try:
        client = mt5_mcp.Mt5McpClient()
        orders = None
        positions = None
        try:
            orders = mt5_mcp._extract_text_payload(client.call_tool("get_trading_history_orders", {}))
        except ValueError:
            orders = None
        try:
            positions = mt5_mcp._extract_text_payload(
                client.call_tool("get_trading_history_positions", {})
            )
        except ValueError:
            positions = None
        return {
            "available": orders is not None or positions is not None,
            "orders": orders,
            "positions": positions,
            "source": "mt5_mcp",
            "readOnly": True,
            "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    except ValueError as exc:
        return {"available": False, "unavailableReason": str(exc), "source": "mt5_mcp"}


def demo_logout() -> dict[str, Any]:
    _stop_terminal()
    _last_demo_meta.clear()
    return {"loggedOut": True, "terminalRunning": terminal_running()}


def _catalog_file(name: str) -> Path | None:
    for base in (CATALOG_COMMON_DIR, CATALOG_LOCAL_DIR):
        p = base / name
        if p.is_file():
            return p
    return None


def _read_catalog_meta() -> dict[str, Any] | None:
    path = _catalog_file(CATALOG_META_NAME)
    if path is None:
        return None
    try:
        raw = path.read_text(encoding="utf-8", errors="replace").strip()
        if not raw:
            return None
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _ndjson_path() -> Path | None:
    return _catalog_file(CATALOG_NDJSON_NAME)


def _sha256_file(path: Path) -> str | None:
    try:
        h = hashlib.sha256()
        with path.open("rb") as fh:
            while True:
                chunk = fh.read(65536)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def catalog_status() -> dict[str, Any]:
    """Read-only catalog discovery status from MQL artifact (not MCP)."""
    meta = _read_catalog_meta()
    ndjson = _ndjson_path()
    ready = _catalog_file(CATALOG_READY_NAME) is not None
    checksum = _sha256_file(ndjson) if ndjson is not None else None
    line_count = None
    if ndjson is not None:
        try:
            with ndjson.open("r", encoding="utf-8", errors="replace") as fh:
                line_count = sum(1 for line in fh if line.strip())
        except OSError:
            line_count = None
    if meta is None:
        return {
            "available": False,
            "artifactReady": False,
            "discoveryStatus": "UNAVAILABLE",
            "unavailableReason": "CATALOG_ARTIFACT_MISSING",
            "provider": "HFM_MT5",
            "environment": "demo",
            "source": "mql5_catalog",
            "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mutatesBroker": False,
            "placesOrders": False,
        }
    status = str(meta.get("discoveryStatus") or "UNKNOWN")
    artifact_ready = bool(meta.get("artifactReady")) and ready and ndjson is not None and status == "COMPLETE"
    return {
        "available": artifact_ready or status in ("IN_PROGRESS", "COMPLETE"),
        "artifactReady": artifact_ready,
        "discoveryStatus": status,
        "provider": "HFM_MT5",
        "environment": "demo",
        "brokerServer": meta.get("brokerServer"),
        "catalogVersion": meta.get("catalogVersion"),
        "enumerationStartedAt": meta.get("enumerationStartedAt") or None,
        "enumerationCompletedAt": meta.get("enumerationCompletedAt") or None,
        "writtenAt": meta.get("writtenAt"),
        "generalSymbolCount": meta.get("generalSymbolCount"),
        "selectedSymbolCount": meta.get("selectedSymbolCount"),
        "enumeratedCount": meta.get("enumeratedCount"),
        "validCount": meta.get("validCount"),
        "duplicateCount": meta.get("duplicateCount"),
        "customCount": meta.get("customCount"),
        "batchIndex": meta.get("batchIndex"),
        "ndjsonLineCount": line_count,
        "checksumSha256": checksum,
        "source": "mql5_catalog",
        "schemaVersion": meta.get("schemaVersion"),
        "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mutatesBroker": False,
        "placesOrders": False,
        "acceptsForExecution": False,
    }


def catalog_chunk(*, offset: int = 0, limit: int = 50) -> dict[str, Any]:
    """Return a bounded slice of catalog NDJSON symbols (safe AF_UNIX payload)."""
    if offset < 0:
        raise ValueError("INVALID_OFFSET")
    if limit < 1:
        limit = 1
    if limit > 80:
        limit = 80
    status = catalog_status()
    if not status.get("artifactReady"):
        return {
            "available": False,
            "artifactReady": False,
            "discoveryStatus": status.get("discoveryStatus"),
            "unavailableReason": status.get("unavailableReason") or "CATALOG_NOT_READY",
            "symbols": [],
            "offset": offset,
            "limit": limit,
            "returned": 0,
            "total": status.get("ndjsonLineCount"),
            "provider": "HFM_MT5",
            "environment": "demo",
            "catalogVersion": status.get("catalogVersion"),
            "checksumSha256": status.get("checksumSha256"),
            "source": "mql5_catalog",
            "mutatesBroker": False,
            "placesOrders": False,
        }
    ndjson = _ndjson_path()
    if ndjson is None:
        return {
            "available": False,
            "artifactReady": False,
            "unavailableReason": "CATALOG_NDJSON_MISSING",
            "symbols": [],
            "offset": offset,
            "limit": limit,
            "returned": 0,
            "provider": "HFM_MT5",
            "environment": "demo",
            "source": "mql5_catalog",
            "mutatesBroker": False,
            "placesOrders": False,
        }
    symbols: list[dict[str, Any]] = []
    total = 0
    try:
        with ndjson.open("r", encoding="utf-8", errors="replace") as fh:
            for i, line in enumerate(fh):
                raw = line.strip()
                if not raw:
                    continue
                if total >= offset and len(symbols) < limit:
                    try:
                        obj = json.loads(raw)
                        if isinstance(obj, dict) and obj.get("symbol"):
                            symbols.append(obj)
                    except json.JSONDecodeError:
                        symbols.append(
                            {
                                "symbol": f"__parse_error_{total}",
                                "symbolExists": False,
                                "fieldErrors": {"_line": "JSON_DECODE_ERROR"},
                            }
                        )
                total += 1
                if total > offset + limit and False:
                    pass
        # Recount total accurately
        with ndjson.open("r", encoding="utf-8", errors="replace") as fh:
            total = sum(1 for line in fh if line.strip())
    except OSError as exc:
        return {
            "available": False,
            "artifactReady": False,
            "unavailableReason": f"CATALOG_READ_ERROR:{type(exc).__name__}",
            "symbols": [],
            "offset": offset,
            "limit": limit,
            "returned": 0,
            "provider": "HFM_MT5",
            "environment": "demo",
            "source": "mql5_catalog",
            "mutatesBroker": False,
            "placesOrders": False,
        }
    return {
        "available": True,
        "artifactReady": True,
        "discoveryStatus": status.get("discoveryStatus"),
        "symbols": symbols,
        "offset": offset,
        "limit": limit,
        "returned": len(symbols),
        "total": total,
        "hasMore": (offset + len(symbols)) < total,
        "provider": "HFM_MT5",
        "environment": "demo",
        "brokerServer": status.get("brokerServer"),
        "catalogVersion": status.get("catalogVersion"),
        "checksumSha256": status.get("checksumSha256"),
        "generalSymbolCount": status.get("generalSymbolCount"),
        "selectedSymbolCount": status.get("selectedSymbolCount"),
        "enumeratedCount": status.get("enumeratedCount"),
        "validCount": status.get("validCount"),
        "source": "mql5_catalog",
        "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mutatesBroker": False,
        "placesOrders": False,
        "acceptsForExecution": False,
    }


def catalog_refresh_request() -> dict[str, Any]:
    """Ask the Expert to restart catalog discovery (does not mutate Market Watch)."""
    for base in (CATALOG_COMMON_DIR, CATALOG_LOCAL_DIR):
        try:
            base.mkdir(parents=True, exist_ok=True)
            path = base / CATALOG_REFRESH_NAME
            path.write_text(
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                encoding="utf-8",
            )
            return {
                "requested": True,
                "provider": "HFM_MT5",
                "environment": "demo",
                "note": "Refresh request written; Expert will restart batched discovery on next timer.",
                "mutatesBroker": False,
                "placesOrders": False,
            }
        except OSError:
            continue
    return {
        "requested": False,
        "unavailableReason": "CATALOG_REFRESH_WRITE_FAILED",
        "provider": "HFM_MT5",
        "environment": "demo",
        "mutatesBroker": False,
        "placesOrders": False,
    }
