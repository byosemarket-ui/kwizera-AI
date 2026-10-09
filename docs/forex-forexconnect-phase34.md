# Phase 34 — ForexConnect historical candles

## SDK API

Official Python ForexConnect:

```python
history = fx.get_history(instrument, timeframe, date_from, date_to, quotes_count)
```

- Instrument: Offers-table symbol (e.g. `EUR/USD`)
- Timeframe: `m1`, `m5`, `m15`, `m30`, `H1`, `H4`, `D1`, `W1`
- Bars expose **BidOpen / BidHigh / BidLow / BidClose** and optional **Volume** (tick volume)
- Price basis in KWIZERA: **bid** (never silently converted to mid)

## Architecture

```
Charts/TA → /api/forex/market-data/candles?provider=FOREXCONNECT
                ↓
         MarketDataService (explicit provider routing)
                ↓
         ForexConnectBridge → 127.0.0.1:5179/candles
                ↓
         ForexConnect.get_history (authenticated session)
```

`FOREXCONNECT` is a distinct `MarketProviderId` from `FXCM` (Socket REST). No cross-provider fallback.

## Env (unchanged from Phase 33)

- `KWIZERA_FOREXCONNECT_ENABLED`
- `KWIZERA_FOREXCONNECT_ENVIRONMENT` (`demo` | `real`)
- `KWIZERA_FOREXCONNECT_USERNAME` / `PASSWORD`
- Optional: `KWIZERA_FOREXCONNECT_URL`, sidecar host/port

## Endpoints

- `GET /api/forex/providers/forexconnect/candles?symbol=&timeframe=&limit=`
- Unified: `GET /api/forex/market-data/candles?provider=FOREXCONNECT&symbol=&timeframe=&limit=`

## Out of scope (Phase 35)

Live ForexConnect price streaming into Charts.
