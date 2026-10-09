# Phase 35 — ForexConnect live prices + forming candles

## SDK mechanism

Official Python sample `GetOffers.py`:

```python
from forexconnect import ForexConnect, Common
offers = fx.get_table(ForexConnect.OFFERS)
listener = Common.subscribe_table_updates(offers, on_change_callback=…)
# later: listener.unsubscribe()
```

Offer fields used: `instrument`, `bid`, `ask`, `offer_id`.

## Price basis

| Layer | Basis |
|-------|--------|
| Historical (`get_history`) | **bid** OHLC |
| Live forming candles | **bid** (same) |
| Quote payload | bid + ask + optional derived mid (display only) |

Never mix bid/mid/ask inside a candle series.

## Transport

```
SDK Offers updates → sidecar in-memory quotes (127.0.0.1:5179)
    → Node ForexConnectLiveCandleService polls /quotes (~500ms)
    → MarketDataService.subscribeLiveCandles(FOREXCONNECT)
    → Charts/TA poll unified /candles?mode=live (~1s)
```

Sidecar remains localhost-only. Max 8 concurrent instrument subscriptions.

## Stream states

`DISABLED` · `NOT_CONFIGURED` · `AUTHENTICATED_IDLE` · `SUBSCRIBED_WAITING` · `LIVE` · `STALE` (>15s) · `ERROR`

`LIVE` requires actual Offers updates (`updateCount > 0`).

## Out of scope (Phase 36+)

Production credential/SDK hardening, multi-account, trading.
