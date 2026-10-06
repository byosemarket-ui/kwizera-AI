# Binance market-data integration foundation (Phase 6)

This module is the **Binance integration foundation** for KWIZERA AI STUDIO Forex.
It does **not** stream live prices, place orders, or replace the existing chart workspace.

## Architecture

```
Binance public REST (api.binance.com)
        ↓
Studio server  GET /api/forex/binance/status
        ↓
Binance adapter (ai/market-data/binance)
        ↓
Normalized MarketConnectionSnapshot
        ↓
Existing Forex shell (header + dashboard status)
```

UI components must consume **normalized** snapshots only. Do not pass raw Binance JSON into React.

Charts in Phase 4–5 still use **development candles**. That stays until a later phase loads real klines through this adapter.

## Official interfaces prepared

Public Spot REST (no API key):

| Purpose | Endpoint | Phase 6 |
| --- | --- | --- |
| Connectivity | `GET /api/v3/ping` | Used |
| Server time | `GET /api/v3/time` | Used (best-effort after ping) |
| Exchange info | `GET /api/v3/exchangeInfo` | Documented, not called |
| Candles | `GET /api/v3/klines` | Adapter only |
| Ticker | `GET /api/v3/ticker/24hr` | Adapter only |

Public WebSocket (not connected in Phase 6):

- Base: `wss://stream.binance.com:9443`
- Streams prepared: `{symbol}@trade`, `{symbol}@miniTicker`, `{symbol}@kline_{interval}`

Private trading APIs are out of scope.

## Configuration

Set in `.env` on the VPS (never commit secrets). Template: `.env.example`.

| Variable | Meaning | Default |
| --- | --- | --- |
| `KWIZERA_BINANCE_ENABLED` | `1` / `0` | `1` |
| `KWIZERA_BINANCE_REST_BASE` | Public REST origin | `https://api.binance.com` |
| `KWIZERA_BINANCE_WS_BASE` | Public WS origin (unused) | `wss://stream.binance.com:9443` |
| `KWIZERA_BINANCE_TIMEOUT_MS` | Probe timeout | `8000` |

Localhost / private REST bases are rejected and replaced with the official HTTPS origin.
`BINANCE_API_KEY` and `BINANCE_API_SECRET` are **not** read by this foundation.

The browser talks only to same-origin `/api/forex/binance/status`. It must not call Binance or `localhost` directly.

## How later phases should consume this

1. Server: `createBinanceMarketDataService()` then `probePublicRest()`, `normalizeKlines()`, `normalizeTicker()`.
2. UI: `fetchBinanceConnectionStatus()` / `useBinanceConnectionStatus()`.
3. Set `liveMarketData: true` **only** after a real Binance session returns valid market data (not after ping alone).
4. Never mark dashboard quotes LIVE from this ping probe.

## Intentionally deferred (Phases 7–10)

- Full REST market discovery / symbol browser
- Historical and live klines in the chart
- WebSocket ticker / trade / kline streaming
- Reconnection loops
- Private account API, orders, portfolio
- AI signals, automated trading, backtesting
