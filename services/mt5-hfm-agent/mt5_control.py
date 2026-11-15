"""
Demo-only MT5 control under Wine.

Login mechanism (MetaQuotes-supported):
  wine terminal64.exe /portable /config:<ephemeral.ini>

Password is written only into a 0600 tmpfs INI, never argv as a discrete secret.
No Linux-native MetaTrader5 Python package. No shell interpolation of secrets.
No Live servers. No orders / EA trading.
"""
from __future__ import annotations

import os
import re
import signal
import subprocess
import time
from pathlib import Path
from typing import Any

WINE_BIN = os.environ.get("KWIZERA_MT5_WINE_BIN", "/opt/wine-staging/bin/wine")
WINEPREFIX = os.environ.get("WINEPREFIX", "/home/mt5/.wine-hfm")
TERM_EXE = Path(WINEPREFIX) / "drive_c/Program Files/HFM Metatrader 5/terminal64.exe"
DISPLAY = os.environ.get("DISPLAY", ":97")
XAUTHORITY = os.environ.get("XAUTHORITY", "/home/mt5/.mt5-xauth/Xauthority")
RUN_DIR = Path(os.environ.get("KWIZERA_MT5_HFM_RUN_DIR", "/run/kwizera/mt5-hfm"))
LOG_DIR = Path(WINEPREFIX) / "drive_c/Program Files/HFM Metatrader 5/logs"

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
_AUTH_OK_RE = re.compile(r"(authorized|connected|login\s+succeeded)", re.I)
_AUTH_FAIL_RE = re.compile(r"(invalid account|authorization failed|login failed|password)", re.I)
_ACCOUNT_RE = re.compile(r"(?:account|login)\s*[#: ]\s*(\d{4,})", re.I)


def terminal_running() -> bool:
    try:
        out = subprocess.check_output(["pgrep", "-u", "mt5", "-f", "terminal64.exe"], text=True)
        return bool(out.strip())
    except subprocess.CalledProcessError:
        return False
    except FileNotFoundError:
        return False


def connection_status() -> dict[str, Any]:
    running = terminal_running()
    return {
        "terminalRunning": running,
        "terminalConnected": running,  # process presence only — not auth
        "authenticated": False,
        "display": DISPLAY,
        "winePrefix": WINEPREFIX,
        "note": "terminalConnected reflects process presence under Xvfb, not Demo login.",
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
    # ASCII INI; password never logged.
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
    # Wine path to INI without spaces: map /run → Z:\run when dosdevices has z:
    win_ini = "Z:\\run\\kwizera\\mt5-hfm\\" + ini_path.name
    env = os.environ.copy()
    env["WINEPREFIX"] = WINEPREFIX
    env["WINEARCH"] = "win64"
    env["WINEDEBUG"] = "-all"
    env["DISPLAY"] = DISPLAY
    env["XAUTHORITY"] = XAUTHORITY
    env["HOME"] = "/home/mt5"
    # Absolute wine + exe + portable + config — password not in argv.
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
    logs = sorted(LOG_DIR.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
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
    # Prefer recent failure over older success.
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
        "loginHint": (found_login[-4:].rjust(len(found_login), "•") if found_login else login_hint),
        "journalAvailable": bool(text),
        "currency": None,
        "balance": None,
        "equity": None,
        "freeMargin": None,
        "usedMargin": None,
        "marginLevel": None,
        "leverage": None,
        "company": None,
        "tradePermissions": None,
        "symbols": None,
        "quotesAvailable": None,
        "note": (
            "Journal-based auth inference only. Balance/equity/quotes require a future "
            "approved Wine MetaTrader5 API enhancer; values are not fabricated."
        ),
    }


def demo_login(login: str, server: str, password: str) -> dict[str, Any]:
    _validate_demo(login, server)
    if not password or len(password) < 4 or len(password) > 128:
        raise ValueError("INVALID_PASSWORD")
    if "\n" in password or "\r" in password or "\0" in password:
        raise ValueError("INVALID_PASSWORD")

    ini = _write_login_ini(login, server, password)
    # Clear caller-visible password variable ASAP (best-effort).
    password = ""
    try:
        _stop_terminal()
        _start_terminal_with_config(ini)
        # Allow terminal startup; keep INI until wine reads it.
        time.sleep(8)
        snap = parse_journal_snapshot(login_hint="••••" + login[-4:])
        status = connection_status()
        return {
            "environment": "demo",
            "loginAccepted": True,
            "server": server,
            "loginHint": "••••" + login[-4:],
            "terminalRunning": status["terminalRunning"],
            "terminalConnected": status["terminalConnected"],
            "authenticated": snap["authenticated"],
            "authError": snap["authError"],
            "account": {
                "loginHint": snap["loginHint"],
                "server": server,
                "currency": snap["currency"],
                "balance": snap["balance"],
                "equity": snap["equity"],
                "freeMargin": snap["freeMargin"],
                "usedMargin": snap["usedMargin"],
                "marginLevel": snap["marginLevel"],
                "leverage": snap["leverage"],
                "company": snap["company"],
                "tradePermissions": snap["tradePermissions"],
                "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "note": snap["note"],
            },
            "marketData": {
                "symbols": None,
                "quotesAvailable": False,
                "stale": None,
                "note": "Market quotes not available without MetaTrader5 API enhancer.",
            },
        }
    finally:
        _shred(ini)


def account_snapshot() -> dict[str, Any]:
    status = connection_status()
    snap = parse_journal_snapshot()
    return {
        "terminalRunning": status["terminalRunning"],
        "terminalConnected": status["terminalConnected"],
        "authenticated": snap["authenticated"],
        "account": {
            "loginHint": snap["loginHint"],
            "server": None,
            "currency": snap["currency"],
            "balance": snap["balance"],
            "equity": snap["equity"],
            "freeMargin": snap["freeMargin"],
            "usedMargin": snap["usedMargin"],
            "marginLevel": snap["marginLevel"],
            "leverage": snap["leverage"],
            "company": snap["company"],
            "tradePermissions": snap["tradePermissions"],
            "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) if snap["authenticated"] else None,
            "note": snap["note"],
        },
    }


def quotes_snapshot(symbols: list[str] | None = None) -> dict[str, Any]:
    return {
        "quotesAvailable": False,
        "stale": None,
        "quotes": [],
        "requestedSymbols": symbols or [],
        "note": "Quote streaming not implemented without Wine MetaTrader5 API enhancer.",
    }


def candles(symbol: str, timeframe: str, limit: int = 100) -> dict[str, Any]:
    allowed_tf = {"1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"}
    if timeframe not in allowed_tf:
        raise ValueError("UNSUPPORTED_TIMEFRAME")
    if not re.fullmatch(r"[A-Za-z0-9._-]{2,32}", symbol):
        raise ValueError("INVALID_SYMBOL")
    if limit < 1 or limit > 300:
        raise ValueError("INVALID_LIMIT")
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": [],
        "available": False,
        "note": "Historical candles not implemented without Wine MetaTrader5 API enhancer.",
    }


def demo_logout() -> dict[str, Any]:
    _stop_terminal()
    return {"loggedOut": True, "terminalRunning": terminal_running()}
