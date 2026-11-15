"""
Demo-only MT5 control under Wine.

Login mechanism (MetaQuotes-supported):
  wine terminal64.exe /portable /config:<ephemeral.ini>

Account + market data: MetaTrader 5 built-in MCP (127.0.0.1) via mt5_mcp.py
read-only tool allowlist. No trade_* / shell / EA tools.

No Live servers. No orders / EA trading.
"""
from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any

import mt5_mcp

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
_AUTH_OK_RE = re.compile(r"(authorized|connected|login\s+succeeded|'.*?account)", re.I)
_AUTH_FAIL_RE = re.compile(r"(invalid account|authorization failed|login failed|password)", re.I)
_ACCOUNT_RE = re.compile(r"(?:account|login)\s*[#: ]\s*(\d{4,})", re.I)

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
        "mcpUrl": mt5_mcp.DEFAULT_MCP_URL,
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
            "authenticated requires MCP account info from the logged-in terminal."
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


def _write_login_ini(login: str, server: str, password: str) -> Path:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    path = RUN_DIR / f"login-{os.getpid()}-{int(time.time())}.ini"
    content = (
        "[Common]\n"
        f"Login={login}\n"
        f"Server={server}\n"
        f"Password={password}\n"
        "KeepPrivate=1\n"
        "ProxyEnable=0\n"
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


def parse_journal_snapshot(login_hint: str | None = None) -> dict[str, Any]:
    text = _latest_journal_text()
    authenticated = bool(_AUTH_OK_RE.search(text)) and not bool(_AUTH_FAIL_RE.search(text[-4000:]))
    if _AUTH_FAIL_RE.search(text[-2000:]):
        authenticated = False
        auth_error = "AUTH_FAILED"
    else:
        auth_error = None
    found_login = None
    m = _ACCOUNT_RE.search(text[-8000:])
    if m:
        found_login = m.group(1)
    return {
        "authenticated": authenticated,
        "authError": auth_error,
        "loginHint": (f"••••{found_login[-4:]}" if found_login else login_hint),
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
        time.sleep(2.0)
    # Fallback: journal inference
    journal = parse_journal_snapshot(login_hint="••••" + expected_login[-4:])
    return {
        "loginHint": journal.get("loginHint"),
        "loginExact": None,
        "server": server,
        "currency": None,
        "balance": None,
        "equity": None,
        "credit": None,
        "profit": None,
        "freeMargin": None,
        "usedMargin": None,
        "marginLevel": None,
        "leverage": None,
        "company": None,
        "authenticated": bool(journal.get("authenticated")),
        "authError": journal.get("authError") or last.get("error") or "MCP_ACCOUNT_TIMEOUT",
        "source": "journal_fallback",
        "note": "MCP account info not available yet; journal-only inference.",
        **{k: v for k, v in last.items() if k not in {"error"}},
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

    ini = _write_login_ini(login, server, password)
    password = ""
    try:
        _stop_terminal()
        _start_terminal_with_config(ini)
        # Allow Wine + terminal + MCP to come up before shredding INI.
        time.sleep(10)
        snap = _wait_for_mcp_account(expected_login=login, server=server, timeout_sec=50)
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
    snap = _mcp_account(server_hint=server)
    if not snap or snap.get("error"):
        journal = parse_journal_snapshot()
        return {
            "terminalRunning": status["terminalRunning"],
            "terminalConnected": status["terminalConnected"],
            "authenticated": False,
            "mcp": status.get("mcp"),
            "account": {
                "loginHint": journal.get("loginHint"),
                "server": server,
                "currency": None,
                "balance": None,
                "equity": None,
                "freeMargin": None,
                "usedMargin": None,
                "marginLevel": None,
                "leverage": None,
                "company": None,
                "syncedAt": None,
                "source": "unavailable",
                "note": snap.get("error") if snap else "MCP_UNAVAILABLE",
                "unavailableReason": snap.get("error") if snap else "MCP_UNAVAILABLE",
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


def candles(symbol: str, timeframe: str, limit: int = 100) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9._-]{2,32}", symbol):
        raise ValueError("INVALID_SYMBOL")
    if limit < 1 or limit > 300:
        raise ValueError("INVALID_LIMIT")
    mt5_tf = mt5_mcp.map_timeframe(timeframe)
    try:
        client = mt5_mcp.Mt5McpClient()
        # Prefer terminal chart history; fall back to marketdata history.
        raw = None
        last_err = None
        for args in (
            {"symbol": symbol, "period": mt5_tf, "count": limit},
            {"symbol": symbol, "timeframe": mt5_tf, "count": limit},
            {"symbol": symbol, "period": mt5_tf, "bars": limit},
        ):
            try:
                raw = client.call_tool("get_chart_history", args)
                break
            except ValueError as exc:
                last_err = str(exc)
                continue
        if raw is None:
            try:
                raw = client.call_tool(
                    "marketdata_symbol_history",
                    {"symbol": symbol, "period": mt5_tf, "count": limit},
                )
            except ValueError as exc:
                last_err = str(exc)
        if raw is None:
            return {
                "symbol": symbol,
                "timeframe": timeframe,
                "candles": [],
                "available": False,
                "source": "mt5_mcp",
                "unavailableReason": last_err or "MCP_CANDLES_FAILED",
            }
        result = mt5_mcp.normalize_candles(raw, symbol=symbol, timeframe=timeframe)
        # Trim to limit; validate OHLC.
        cleaned = []
        for c in result["candles"][-limit:]:
            o, h, l, cl = c["open"], c["high"], c["low"], c["close"]
            if None in (o, h, l, cl):
                continue
            if h < max(o, cl) or l > min(o, cl) or h < l:
                continue
            cleaned.append(c)
        result["candles"] = cleaned
        result["count"] = len(cleaned)
        result["available"] = bool(cleaned)
        result["provider"] = "HFM_MT5"
        result["environment"] = "demo"
        result["retrievedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return result
    except ValueError as exc:
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "candles": [],
            "available": False,
            "source": "mt5_mcp",
            "unavailableReason": str(exc),
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
