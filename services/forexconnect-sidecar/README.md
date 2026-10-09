# KWIZERA ForexConnect Sidecar (Phase 33)

Private localhost service that wraps the official FXCM ForexConnect Python SDK
and exposes a safe HTTP control plane for the Node.js gateway.

## Bindings

- Listen: `127.0.0.1` only (default port `5179`)
- Never expose this port publicly

## Environment

| Variable | Purpose |
|----------|---------|
| `KWIZERA_FOREXCONNECT_ENABLED` | `1` / `true` to enable |
| `KWIZERA_FOREXCONNECT_ENVIRONMENT` | `demo` or `real` |
| `KWIZERA_FOREXCONNECT_USERNAME` | Trading Station username |
| `KWIZERA_FOREXCONNECT_PASSWORD` | Trading Station password |
| `KWIZERA_FOREXCONNECT_URL` | Optional host descriptor (default `https://www.fxcorporate.com/Hosts.jsp`) |
| `KWIZERA_FOREXCONNECT_SIDECAR_HOST` | Default `127.0.0.1` |
| `KWIZERA_FOREXCONNECT_SIDECAR_PORT` | Default `5179` |
| `KWIZERA_FOREXCONNECT_SESSION_ID` | Optional multi-database session id |
| `KWIZERA_FOREXCONNECT_PIN` | Optional PIN |

## Prerequisites (VPS)

1. Sign FXCM Software EULA.
2. Python 3.8+ recommended (official PyPI package historically listed 3.5–3.7; verify wheel availability for your OS).
3. `pip install forexconnect` (or install the Gehtsoft wheel matching your OS/arch).
4. Native libraries required by the ForexConnect package must load on the host.
5. Enable via systemd unit `kwizera-forexconnect.service` (localhost only).

## Endpoints (private)

- `GET /health`
- `GET /status`
- `POST /connect`
- `POST /disconnect`
- `GET /instruments`
- `GET /candles?symbol=&timeframe=&limit=` — historical via `ForexConnect.get_history` (bid OHLC)

Passwords are never returned in responses or logs.

## Historical candles

Requires an authenticated session. Project timeframes map 1:1 to SDK periods:

| Project | SDK |
|---------|-----|
| 1m | m1 |
| 5m | m5 |
| 15m | m15 |
| 30m | m30 |
| 1h | H1 |
| 4h | H4 |
| 1d | D1 |
| 1w | W1 |

Price basis: **bid**. Max `limit`: 300. Unsupported timeframes are rejected (no silent substitution).
