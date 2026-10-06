# Binance market-data integration (Phases 6–9)

This module is the **Binance integration** for KWIZERA AI STUDIO Forex.

- Phase 6: public REST connectivity (ping/time)
- Phase 7: Spot market discovery and selected-symbol state
- Phase 8: public Spot **miniTicker** WebSocket (live price)
- Phase 9: historical Spot **klines** plus live `{symbol}@kline_{interval}` candles on the existing chart

It does **not** place orders, access private account APIs, or generate trading signals.

## Architecture

```
Selected Binance symbol + timeframe (Phases 4 and 7)
        ↓
Studio REST  GET /api/forex/binance/klines  →  official GET /api/v3/klines
        ↓
Existing lightweight-charts workspace
        ↓
Official public WebSocket  wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}
        ↓
applyLiveKline (replace forming candle / append on close)
```

REST discovery and historical candles flow through the Studio server. Live miniTicker and kline streams connect from the Studio UI to **official public WSS only** (no API keys). Raw Binance frames never enter React.

Forex pairs still use **development candles**. Binance Spot symbols use genuine OHLCV.

## Official interfaces

| Purpose | Endpoint | Phase |
| --- | --- | --- |
| Connectivity | `GET /api/v3/ping` | 6 |
| Server time | `GET /api/v3/time` | 6 |
| Exchange info | `GET /api/v3/exchangeInfo` | 7 |
| Live price | `{symbol}@miniTicker` | 8 |
| Historical candles | `GET /api/v3/klines` | 9 |
| Live candles | `{symbol}@kline_*` | 9 |
| Trades | `{symbol}@trade` | prepared, unused |

Supported chart intervals: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`. Unsupported intervals return an error rather than invented data.

Public WebSocket bases (fallbacks):

- `wss://stream.binance.com:9443`
- `wss://stream.binance.com:443`
- `wss://data-stream.binance.vision`

Chart `LIVE` is set only when historical candles loaded, the kline socket is open, the subscribed symbol and timeframe match, and a validated kline update has arrived.

## Intentionally deferred (Phase 10+)

- Full live-market hardening across remaining Forex surfaces
- Trade stream UI
- Trading execution, BUY/SELL orders
- AI signals and automated trading
- Futures markets
- Watchlist persistence
