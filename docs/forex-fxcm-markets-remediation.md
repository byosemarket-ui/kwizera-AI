# FXCM Markets remediation (Phase 32)

## Root cause (production evidence)

Selecting FXCM on `/forex/markets` showed a generic empty list because:

1. Production had `KWIZERA_FXCM_ENABLED` off (`FXCM_DISABLED`) and no access token (`configured: false`).
2. `GET /api/forex/market-data/instruments?provider=FXCM` swallowed that failure and returned `{ ok: true, count: 0, instruments: [] }` after Binance had already filled the shared registry — so FXCM was never re-fetched and errors were not surfaced.

The dedicated discovery route already told the truth:

`GET /api/forex/providers/fxcm/instruments` → `discoveryStatus: DISABLED`, `errorCode: FXCM_DISABLED`.

## Server environment (never expose to the browser)

| Variable | Purpose |
|----------|---------|
| `KWIZERA_FXCM_ENABLED` | `1` / `true` to enable FXCM |
| `KWIZERA_FXCM_ACCESS_TOKEN` | Trading Station Web access token (server-only) |
| `KWIZERA_FXCM_ENVIRONMENT` | `demo` (default) or `real` |
| `KWIZERA_FXCM_TIMEOUT_MS` | Optional HTTP timeout |
| `KWIZERA_FXCM_QUOTE_STALE_MS` | Optional quote stale window |

After setting env on the VPS, restart the service and use **Admin → Forex → Test FXCM Authentication**.

## Unified candles

Charts and Technical Analysis load OHLC from `/api/forex/market-data/candles` (`data-candle-source="unified-market-data"`). Binance forming candles may still overlay via the existing browser kline WebSocket on top of the unified historical baseline. FXCM live candles use unified `mode=live` (no silent Binance fallback).
