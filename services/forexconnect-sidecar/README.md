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
2. Official PyPI `forexconnect` linux wheels target **Python 3.5–3.7** (cp35–cp37).  
   Production provisioning (`deploy/provision-forexconnect.sh`) installs a dedicated **Python 3.7** venv under `.venv/` and verifies `import forexconnect` as user `kwizera`.
3. Native libraries required by the ForexConnect package must load on the host.
4. `KWIZERA_FOREXCONNECT_ENABLED=1` is set by the provisioner **only after** a successful import test.
5. DEMO/LIVE passwords are entered via Forex Admin profiles (encrypted vault) — not required in `.env`.
6. systemd unit `kwizera-forexconnect.service` binds `127.0.0.1:5179` only.

## Endpoints (private)

- `GET /health`
- `GET /status`
- `POST /connect`
- `POST /disconnect`
- `GET /instruments`
- `GET /candles?symbol=&timeframe=&limit=` — historical via `ForexConnect.get_history` (bid OHLC)
- `POST /subscribe` `{ "symbol": "EUR/USD" }` — Offers table updates (`Common.subscribe_table_updates`)
- `POST /unsubscribe` `{ "symbol": "EUR/USD" }`
- `GET /quotes` / `GET /quote?symbol=` — latest bid/ask for subscribed instruments
- `GET /stream/status` — subscription / LIVE / STALE diagnostics

Passwords are never returned in responses or logs. Max 8 concurrent subscriptions.

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
