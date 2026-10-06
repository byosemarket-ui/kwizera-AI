# Binance market-data integration (Phases 6–7)

This module is the **Binance integration foundation** for KWIZERA AI STUDIO Forex.
Phase 6 prepared public REST connectivity. Phase 7 adds **Spot market discovery and symbol management**.
It does **not** stream live prices, place orders, or execute trades.

## Architecture

```
Binance public REST (exchangeInfo)
        ↓
Binance adapter (NormalizedMarket)
        ↓
Studio server  GET /api/forex/binance/markets
        ↓
Market store / selected-market URL state
        ↓
Existing Forex UI (Markets, Dashboard, Charts, Watchlist identity)
```

UI components must consume **normalized** markets only. Do not pass raw Binance JSON into React.

Charts still use **development candles** for Forex pairs. A selected Binance symbol shows an empty chart state until a later phase connects live data.

## Official interfaces

Public Spot REST (no API key):

| Purpose | Endpoint | Phase |
| --- | --- | --- |
| Connectivity | `GET /api/v3/ping` | 6 used |
| Server time | `GET /api/v3/time` | 6 used |
| Exchange info | `GET /api/v3/exchangeInfo` | 7 used (Spot discovery) |
| Candles | `GET /api/v3/klines` | Adapter only |
| Ticker | `GET /api/v3/ticker/24hr` | Adapter only |

**Market type in Phase 7: Spot only.** Futures discovery and futures trading are out of scope.

Public WebSocket (not connected):

- Base: `wss://stream.binance.com:9443`
- Streams prepared: `{symbol}@trade`, `{symbol}@miniTicker`, `{symbol}@kline_{interval}`

Private trading APIs are out of scope.

## Studio HTTP

| Route | Meaning |
| --- | --- |
| `GET /api/forex/binance/status` | Public REST reachability (not live prices) |
| `GET /api/forex/binance/markets` | Normalized Spot catalog (`?refresh=1` bypasses cache) |

Catalog cache: 10 minutes in the server service. The browser filters locally after load.

## Selected market URL

Compatible Forex routes keep `?symbol=` and `?timeframe=`.

Example: `/forex/charts?symbol=BTCUSDT`

Unknown compact symbols are treated as Binance Spot identities. Known 6-letter Forex pairs remain development-forex.

## Configuration

Set in `.env` on the VPS (never commit secrets). Template: `.env.example`.

| Variable | Meaning | Default |
| --- | --- | --- |
| `KWIZERA_BINANCE_ENABLED` | `1` / `0` | `1` |
| `KWIZERA_BINANCE_REST_BASE` | Public REST origin | `https://api.binance.com` |
| `KWIZERA_BINANCE_WS_BASE` | Public WS origin (unused) | `wss://stream.binance.com:9443` |
| `KWIZERA_BINANCE_TIMEOUT_MS` | Probe timeout | `8000` |

Localhost / private REST bases are rejected and replaced with the official HTTPS origin.
`BINANCE_API_KEY` and `BINANCE_API_SECRET` are **not** read.

The browser talks only to same-origin `/api/forex/binance/*`. It must not call Binance or `localhost` directly.

If ping/discovery fails on one official host, the client tries `api1`/`api2`/`api3.binance.com` and `data-api.binance.vision`.

## How later phases should consume this

1. Server: `createBinanceMarketDataService()` then `listSpotMarkets()`, `findSpotMarket()`.
2. UI selected market: `parseSelectedMarket` / `writeMarketQuery`.
3. Set `liveMarketData: true` **only** after a real Binance session returns valid market data.
4. Never mark dashboard quotes LIVE from ping or exchangeInfo.

## Intentionally deferred (Phase 8+)

- Real-time WebSocket streaming
- Live prices and live candle updates in the UI
- Historical klines for Binance symbols
- Trading execution, BUY/SELL orders
- AI signals and automated trading
- Futures markets
- Watchlist persistence
