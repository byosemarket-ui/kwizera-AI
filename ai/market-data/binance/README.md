# Binance market-data integration (Phases 6–10)

This module is the **Binance integration** for KWIZERA AI STUDIO Forex.

- Phase 6: public REST connectivity (ping/time)
- Phase 7: Spot market discovery and selected-symbol state
- Phase 8: public Spot **miniTicker** WebSocket (live price)
- Phase 9: historical Spot **klines** plus live `{symbol}@kline_{interval}` candles
- Phase 10: full live-market integration across Dashboard, Markets, Watchlist session, Charts, and Technical Analysis

It does **not** place orders, access private account APIs, or generate trading signals.

## Architecture

```
Selected Binance symbol + timeframe (shell source of truth)
        ↓
Studio REST  /api/forex/binance/{status,markets,klines}
        ↓
Official public WebSocket streams (miniTicker + kline)
        ↓
Normalization / validation / stale-data protection
        ↓
Dashboard · Markets · Session watchlist · Charts · Technical Analysis
```

`LIVE` requires an active matching subscription and a recent valid Binance event for the selected symbol (and timeframe for candles).

## Official interfaces

| Purpose | Endpoint | Phase |
| --- | --- | --- |
| Connectivity | `GET /api/v3/ping` | 6 |
| Server time | `GET /api/v3/time` | 6 |
| Exchange info | `GET /api/v3/exchangeInfo` | 7 |
| Live price | `{symbol}@miniTicker` | 8 |
| Historical candles | `GET /api/v3/klines` | 9 |
| Live candles | `{symbol}@kline_*` | 9 |

Supported chart intervals: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`.

## Intentionally deferred

- Trading execution, BUY/SELL orders, balances
- AI signals and automated trading
- Futures markets
- Persistent watchlist storage (session-local list only)
