# Phase 59.0.11 — Proposed one-order DEMO acceptance plan (NOT EXECUTED)

**Status:** Written plan only. Phase 59.0.11 does **not** submit, cancel, amend, or close any broker order.

## Preconditions (all required)

1. Remote Phase 59 validation workflow green on the exact candidate SHA.
2. Production deploy SHA matches that candidate; `/api/health` healthy.
3. Authenticated AT status: `masterEnable=false`, Emergency Entry Lock ON, automatic entry DISABLED, `placesOrders=false`, `acceptsForExecution=false`, `brokerExecution=DISABLED`.
4. Ordinary AT path still uses `DisabledBrokerMutationAdapter` (no replacement).
5. LIVE remains unconfigured/locked.
6. Live Offers: `orderPathMarketReady=true` (LIVE_FRESH genuine price change within 15s **and** TradingStatus open). Catalog overlay must not be the sole evidence.
7. Account / OfferID / `baseUnitSize` / min quantity confirmed from live RO tables (masked account).
8. Separately authorized, auditable DEMO-only mutation path (grant + env + secret) — **not** ordinary AT.
9. Explicit owner approval of: instrument, direction, lots (minimum), order type `TRUE_MARKET_OPEN`, TIF (default IOC), and whether protectives are required.

## Single-order procedure (future phase only)

1. RO reconcile: empty Orders/Trades for the selected account/instrument (or document existing).
2. Build offline contract via existing builder (`brokerAccepted=false`, `fillConfirmed=false`).
3. Submit **one** DEMO mutation through the grant-scoped path only.
4. Capture broker `order_id` acknowledgement without treating it as a fill.
5. Poll RO Orders + Trades; require TradeID / open-trade evidence for fill confirmation.
6. Trade Monitor must show distinct OrderID vs TradeID, raw + normalized status, TIF only if broker-supplied.
7. If acknowledgement is ambiguous: **stop**; RO reconcile before any retry. Never blind-resend.

## Safe abort

- Ambiguous submit → RO broker tables first.
- Rejected → record broker error (sanitized); do not retry automatically.
- Partial / unexpected fill → leave position handling to a separately authorized close plan; do not improvise.

## Out of scope for 59.0.11

Any mutation grant creation, env enablement, order send, cancel, close, or LIVE unlock.
