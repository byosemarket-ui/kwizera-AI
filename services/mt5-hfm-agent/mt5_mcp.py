"""
Read-only client for the MetaTrader 5 built-in MCP server (127.0.0.1).

Security:
- Reads ApiKey only from the terminal Config/assistant.ini (never logs the value).
- Allowlists read-only tools; rejects all trade / shell / EA-attach / file-write tools.
- Demo analysis only — never calls trade_* methods.
"""
from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

LOG = logging.getLogger("mt5-hfm-mcp")

ASSISTANT_INI = Path(
    os.environ.get(
        "KWIZERA_MT5_ASSISTANT_INI",
        "/home/mt5/.wine-hfm/drive_c/Program Files/HFM Metatrader 5/Config/assistant.ini",
    )
)

# Hard allowlist — anything else is rejected before the HTTP call.
ALLOWED_MCP_TOOLS = frozenset(
    {
        "get_trading_account_info",
        "get_trading_open_positions",
        "get_trading_history_orders",
        "get_trading_history_positions",
        "get_marketwatch_symbols",
        "get_chart_history",
        "get_chart_ticks_history",
        "get_terminal_journal",
        "get_workspace_info",
        "get_time_information",
        "marketdata_symbol_search",
        "marketdata_symbol_get",
        "marketdata_symbol_history",
        "list_open_charts",
        "economic_calendar_list_countries",
        "economic_calendar_list_events_by_country",
        "economic_calendar_list_values",
        "economic_calendar_list_values_last",
        "economic_calendar_get_value_by_id",
    }
)

FORBIDDEN_MCP_TOOLS = frozenset(
    {
        "trade_send_market_order",
        "trade_send_pending_order",
        "trade_modify_sl_tp",
        "trade_close_single_position",
        "trade_close_by_position",
        "trade_delete_order",
        "shell",
        "chart_add_expert",
        "chart_remove_expert",
        "chart_add_script",
        "add_marketwatch_symbol",
        "remove_marketwatch_symbol",
        "write",
        "edit",
        "delete_file",
        "write_file",
        "write_binary_file",
        "send_web_request",
        "tester_run_backtest",
        "tester_run_optimization",
    }
)

_API_KEY_RE = re.compile(r"(?im)^\s*ApiKey\s*=\s*(.+?)\s*$")
_SECTION_RE = re.compile(r"(?im)^\s*\[MCP\.MetaTrader\]\s*$")
_ENDPOINT_RE = re.compile(r"(?im)^\s*Endpoint\s*=\s*(.+?)\s*$")


def _decode_ini(raw: bytes) -> str:
    for enc in ("utf-16-le", "utf-16", "utf-8", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return ""


def resolve_mcp_url(path: Path | None = None) -> str:
    """Prefer KWIZERA_MT5_MCP_URL, else [MCP.MetaTrader] Endpoint from assistant.ini."""
    env_url = (os.environ.get("KWIZERA_MT5_MCP_URL") or "").strip()
    if env_url:
        return env_url.rstrip("/")
    p = path or ASSISTANT_INI
    if p.is_file():
        text = _decode_ini(p.read_bytes())
        in_section = False
        for line in text.splitlines():
            if _SECTION_RE.match(line):
                in_section = True
                continue
            if line.strip().startswith("[") and line.strip().endswith("]"):
                in_section = False
                continue
            if not in_section:
                continue
            m = _ENDPOINT_RE.match(line)
            if m:
                url = m.group(1).strip().strip('"').strip("'")
                if url.startswith("http://127.0.0.1:") or url.startswith("http://localhost:"):
                    return url.rstrip("/")
    return "http://127.0.0.1:22346/mcp"


DEFAULT_MCP_URL = resolve_mcp_url()


def load_mcp_api_key(path: Path | None = None) -> str | None:
    """Load MetaTrader MCP ApiKey. Never log the returned value."""
    p = path or ASSISTANT_INI
    if not p.is_file():
        return None
    text = _decode_ini(p.read_bytes())
    # Prefer [MCP.MetaTrader] section key.
    in_section = False
    section_key: str | None = None
    first_key: str | None = None
    for line in text.splitlines():
        if _SECTION_RE.match(line):
            in_section = True
            continue
        if line.strip().startswith("[") and line.strip().endswith("]"):
            in_section = False
            continue
        m = _API_KEY_RE.match(line)
        if not m:
            continue
        val = m.group(1).strip().strip('"').strip("'")
        if not val:
            continue
        if first_key is None:
            first_key = val
        if in_section:
            section_key = val
    key = section_key or first_key
    if not key or len(key) < 16:
        return None
    return key


def mcp_reachable(url: str | None = None, timeout: float = 2.0) -> bool:
    endpoint = url or resolve_mcp_url()
    try:
        # Expect 401 without auth — proves listener is the MCP server.
        req = urllib.request.Request(endpoint, method="GET")
        urllib.request.urlopen(req, timeout=timeout)
        return True
    except urllib.error.HTTPError as exc:
        return exc.code in (401, 405, 406)
    except Exception:
        return False


class Mt5McpClient:
    """Minimal streamable-HTTP MCP client for read-only terminal tools."""

    def __init__(self, url: str | None = None, api_key: str | None = None) -> None:
        self.url = (url or resolve_mcp_url()).rstrip("/")
        self._api_key = api_key
        self._session_id: str | None = None
        self._initialized = False
        self._rpc_id = 0

    def _key(self) -> str:
        if self._api_key:
            return self._api_key
        key = load_mcp_api_key()
        if not key:
            raise ValueError("MCP_API_KEY_MISSING")
        self._api_key = key
        return key

    def _next_id(self) -> int:
        self._rpc_id += 1
        return self._rpc_id

    def _headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {self._key()}",
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        return headers

    def _post(self, payload: dict[str, Any], timeout: float = 30.0) -> dict[str, Any]:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        req = urllib.request.Request(
            self.url,
            data=data,
            headers=self._headers(),
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                sid = resp.headers.get("Mcp-Session-Id") or resp.headers.get("mcp-session-id")
                if sid:
                    self._session_id = sid
                raw = resp.read()
                ctype = (resp.headers.get("Content-Type") or "").lower()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:500]
            if exc.code == 401:
                raise ValueError("MCP_UNAUTHORIZED") from exc
            raise ValueError(f"MCP_HTTP_{exc.code}") from exc
        except Exception as exc:
            raise ValueError("MCP_UNREACHABLE") from exc

        text = raw.decode("utf-8", errors="replace")
        if "text/event-stream" in ctype:
            # Parse last JSON data line from SSE.
            obj: dict[str, Any] | None = None
            for line in text.splitlines():
                if line.startswith("data:"):
                    chunk = line[5:].strip()
                    if not chunk or chunk == "[DONE]":
                        continue
                    try:
                        parsed = json.loads(chunk)
                        if isinstance(parsed, dict):
                            obj = parsed
                    except json.JSONDecodeError:
                        continue
            if obj is None:
                raise ValueError("MCP_EMPTY_SSE")
            return obj
        if not text.strip():
            return {}
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("MCP_BAD_JSON") from exc
        if not isinstance(parsed, dict):
            raise ValueError("MCP_BAD_JSON")
        return parsed

    def ensure_initialized(self) -> None:
        if self._initialized:
            return
        init = self._post(
            {
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "kwizera-mt5-hfm-agent", "version": "1.0"},
                },
            }
        )
        if "error" in init:
            # Retry older protocol version.
            init = self._post(
                {
                    "jsonrpc": "2.0",
                    "id": self._next_id(),
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {"name": "kwizera-mt5-hfm-agent", "version": "1.0"},
                    },
                }
            )
        if "error" in init:
            raise ValueError("MCP_INIT_FAILED")
        # notifications/initialized (no id)
        try:
            self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        except ValueError:
            # Some servers accept init without notification.
            pass
        self._initialized = True
        LOG.info("mcp_initialized url=%s session=%s", self.url, "yes" if self._session_id else "no")

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        if name in FORBIDDEN_MCP_TOOLS or name not in ALLOWED_MCP_TOOLS:
            raise ValueError("MCP_TOOL_FORBIDDEN")
        if re.search(r"(?i)trade_|order|shell|expert|write|delete|send_web", name):
            # Defense in depth for any future tool name variants.
            if name not in ALLOWED_MCP_TOOLS:
                raise ValueError("MCP_TOOL_FORBIDDEN")
            if name.startswith("trade_"):
                raise ValueError("MCP_TOOL_FORBIDDEN")
        self.ensure_initialized()
        resp = self._post(
            {
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments or {}},
            },
            timeout=60.0,
        )
        if "error" in resp:
            code = resp["error"].get("code") if isinstance(resp["error"], dict) else None
            raise ValueError(f"MCP_TOOL_ERROR_{code or 'UNKNOWN'}")
        result = resp.get("result")
        return result

    def list_tools(self) -> list[str]:
        self.ensure_initialized()
        resp = self._post(
            {
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": "tools/list",
                "params": {},
            }
        )
        tools = (resp.get("result") or {}).get("tools") if isinstance(resp.get("result"), dict) else None
        if not isinstance(tools, list):
            return []
        names: list[str] = []
        for t in tools:
            if isinstance(t, dict) and t.get("name"):
                names.append(str(t["name"]))
        return names


def _extract_text_payload(result: Any) -> Any:
    """Normalize MCP tool result content blocks into JSON/dict when possible."""
    if result is None:
        return None
    if isinstance(result, (dict, list)):
        # Prefer structuredContent when present.
        if isinstance(result, dict):
            if "structuredContent" in result and result["structuredContent"] is not None:
                return result["structuredContent"]
            content = result.get("content")
            if isinstance(content, list):
                texts: list[str] = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        texts.append(str(block.get("text") or ""))
                joined = "\n".join(texts).strip()
                if joined:
                    try:
                        return json.loads(joined)
                    except json.JSONDecodeError:
                        return {"text": joined}
        return result
    return result


def _num(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def normalize_account_info(raw: Any, server_hint: str | None = None) -> dict[str, Any]:
    data = _extract_text_payload(raw)
    if not isinstance(data, dict):
        data = {"rawType": type(data).__name__}
    # Field names vary slightly across builds — accept common aliases.
    login = data.get("login") or data.get("Login") or data.get("account") or data.get("account_login")
    login_s = _str(login)
    login_hint = None
    if login_s and login_s.isdigit():
        login_hint = "••••" + login_s[-4:]
    elif login_s:
        login_hint = "••••" + login_s[-4:] if len(login_s) >= 4 else "••••"

    leverage = data.get("leverage") or data.get("Leverage")
    if isinstance(leverage, (int, float)) and leverage > 0:
        leverage_s = f"1:{int(leverage)}"
    else:
        leverage_s = _str(leverage)

    trade_mode = _str(data.get("trade_mode") or data.get("tradeMode") or data.get("account_type") or data.get("type"))
    currency = _str(data.get("currency") or data.get("Currency") or data.get("account_currency"))
    company = _str(data.get("company") or data.get("Company") or data.get("broker"))
    server = _str(data.get("server") or data.get("Server") or data.get("trade_server")) or server_hint

    mcp_trade = data.get("mcp_trade_allowed")
    experts_trade = data.get("experts_trade_allowed")
    trade_allowed = data.get("trade_allowed") or data.get("tradeAllowed")

    return {
        "loginHint": login_hint,
        "loginVerified": login_s.isdigit() if login_s else False,
        "loginExact": login_s if (login_s and login_s.isdigit()) else None,
        "server": server,
        "currency": currency,
        "balance": _num(data.get("balance") if "balance" in data else data.get("Balance")),
        "equity": _num(data.get("equity") if "equity" in data else data.get("Equity")),
        "credit": _num(data.get("credit") if "credit" in data else data.get("Credit")),
        "profit": _num(data.get("profit") if "profit" in data else data.get("Profit")),
        "freeMargin": _num(
            data.get("margin_free")
            or data.get("free_margin")
            or data.get("freeMargin")
            or data.get("MarginFree")
        ),
        "usedMargin": _num(data.get("margin") or data.get("used_margin") or data.get("usedMargin") or data.get("Margin")),
        "marginLevel": _num(
            data.get("margin_level") or data.get("marginLevel") or data.get("MarginLevel")
        ),
        "leverage": leverage_s,
        "company": company,
        "accountType": trade_mode,
        "tradePermissions": _str(trade_allowed) if trade_allowed is not None else None,
        "mcpTradeAllowed": bool(mcp_trade) if mcp_trade is not None else None,
        "expertsTradeAllowed": bool(experts_trade) if experts_trade is not None else None,
        "readOnly": bool(data.get("trade_expert") is False) if "trade_expert" in data else None,
        "source": "mt5_mcp",
        "note": None,
    }


def normalize_symbols(raw: Any) -> list[dict[str, Any]]:
    data = _extract_text_payload(raw)
    items: list[Any]
    if isinstance(data, dict):
        items = data.get("symbols") or data.get("items") or data.get("marketwatch") or []
        if not items and data.get("symbol"):
            items = [data]
    elif isinstance(data, list):
        items = data
    else:
        items = []
    out: list[dict[str, Any]] = []
    for item in items:
        if isinstance(item, str):
            out.append({"brokerSymbol": item, "displayName": item})
            continue
        if not isinstance(item, dict):
            continue
        sym = _str(item.get("symbol") or item.get("name") or item.get("Symbol"))
        if not sym:
            continue
        out.append(
            {
                "brokerSymbol": sym,
                "displayName": _str(item.get("description") or item.get("display") or sym),
                "baseCurrency": _str(item.get("currency_base") or item.get("base")),
                "quoteCurrency": _str(item.get("currency_profit") or item.get("quote")),
                "digits": item.get("digits"),
                "point": _num(item.get("point")),
                "tickSize": _num(item.get("trade_tick_size") or item.get("tick_size")),
                "contractSize": _num(item.get("trade_contract_size") or item.get("contract_size")),
                "volumeMin": _num(item.get("volume_min") or item.get("min_volume")),
                "volumeMax": _num(item.get("volume_max") or item.get("max_volume")),
                "volumeStep": _num(item.get("volume_step")),
                "bid": _num(item.get("bid") or item.get("Bid")),
                "ask": _num(item.get("ask") or item.get("Ask")),
                "spread": _num(item.get("spread") or item.get("Spread")),
                "time": item.get("time") or item.get("time_msc") or item.get("tick_time"),
            }
        )
    return out


def normalize_candles(raw: Any, symbol: str, timeframe: str) -> dict[str, Any]:
    data = _extract_text_payload(raw)
    bars: list[Any] = []
    if isinstance(data, dict):
        bars = data.get("bars") or data.get("candles") or data.get("rates") or data.get("history") or []
    elif isinstance(data, list):
        bars = data
    candles: list[dict[str, Any]] = []
    for b in bars:
        if not isinstance(b, dict):
            continue
        ts = b.get("time") or b.get("timestamp") or b.get("t")
        o = _num(b.get("open") or b.get("Open") or b.get("o"))
        h = _num(b.get("high") or b.get("High") or b.get("h"))
        l = _num(b.get("low") or b.get("Low") or b.get("l"))
        c = _num(b.get("close") or b.get("Close") or b.get("c"))
        if ts is None or None in (o, h, l, c):
            continue
        candles.append(
            {
                "time": ts,
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "tickVolume": _num(b.get("tick_volume") or b.get("volume") or b.get("TickVolume")),
                "realVolume": _num(b.get("real_volume") or b.get("RealVolume")),
                "spread": _num(b.get("spread")),
            }
        )
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": candles,
        "available": bool(candles),
        "source": "mt5_mcp",
        "count": len(candles),
    }


# Native MT5 periods only. Unsupported aliases must fail explicitly (no silent synthesis).
_TF_MAP = {
    "1m": "M1",
    "M1": "M1",
    "2m": "M2",
    "M2": "M2",
    "3m": "M3",
    "M3": "M3",
    "5m": "M5",
    "M5": "M5",
    "10m": "M10",
    "M10": "M10",
    "15m": "M15",
    "M15": "M15",
    "20m": "M20",
    "M20": "M20",
    "30m": "M30",
    "M30": "M30",
    "1h": "H1",
    "H1": "H1",
    "2h": "H2",
    "H2": "H2",
    "3h": "H3",
    "H3": "H3",
    "4h": "H4",
    "H4": "H4",
    "6h": "H6",
    "H6": "H6",
    "8h": "H8",
    "H8": "H8",
    "12h": "H12",
    "H12": "H12",
    "1d": "D1",
    "D1": "D1",
    "1w": "W1",
    "W1": "W1",
    "1M": "MN1",
    "MN1": "MN1",
}


def map_timeframe(tf: str) -> str:
    raw = str(tf or "").strip()
    mapped = _TF_MAP.get(raw) or _TF_MAP.get(raw.upper()) or _TF_MAP.get(raw.lower())
    if not mapped:
        raise ValueError("UNSUPPORTED_TIMEFRAME")
    return mapped
