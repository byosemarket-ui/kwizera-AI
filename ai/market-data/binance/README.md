# Binance market-data integration (Phases 6–8)

This module is the **Binance integration** for KWIZERA AI STUDIO Forex.

- Phase 6: public REST connectivity (ping/time)
- Phase 7: Spot market discovery and selected-symbol state
- Phase 8: public Spot **miniTicker** WebSocket (live price only)

It does **not** stream candlesticks, place orders, or access private account APIs.

## Architecture

```
Selected Binance symbol (Phase 7)
        ↓
Official public WebSocket  wss://stream.binance.com:9443/ws/{symbol}@miniTicker
        ↓
Binance WebSocket adapter (NormalizedLiveTicker)
        ↓
Live ticker client (single socket, reconnect, symbol switch)
        ↓
Existing Forex UI (header, selected-market bar, dashboard, chart summary)
```

REST discovery still flows through the Studio server. Live ticker connects from the Studio UI to **official public WSS only** (no API keys). Raw Binance frames never enter React.

Charts still use **development candles** for Forex pairs. Binance symbols show live **price** in Phase 8; live candlesticks are Phase 9.

## Official interfaces

| Purpose | Endpoint | Phase |
| --- | --- | --- |
| Connectivity | `GET /api/v3/ping` | 6 |
| Server time | `GET /api/v3/time` | 6 |
| Exchange info | `GET /api/v3/exchangeInfo` | 7 |
| Live price | `{symbol}@miniTicker` | 8 |
| Candles | `GET /api/v3/klines` / `{symbol}@kline_*` | later |
| Trades | `{symbol}@trade` | prepared, unused |

Public WebSocket bases (fallbacks):

- `wss://stream.binance.com:9443`
- `wss://stream.binance.com:443`
- `wss://data-stream.binance.vision`

`LIVE` is set only when the socket is open, the subscribed symbol matches, and a validated miniTicker tick has arrived.

## Intentionally deferred (Phase 9+)

- Live candlesticks and chart streaming
- Trade stream UI
- Trading execution, BUY/SELL orders
- AI signals and automated trading
- Futures markets
- Watchlist persistence
