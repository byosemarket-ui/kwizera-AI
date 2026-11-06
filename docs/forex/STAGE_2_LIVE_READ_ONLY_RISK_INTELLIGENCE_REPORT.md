# Stage 2 — Live Read-Only Risk Intelligence

**Status:** Implemented (read-only; fail-closed; no broker mutation)  
**Module:** `ai/forex-ai/automated-trading/risk-intelligence/`  
**Stage id:** `STAGE_2_LIVE_READ_ONLY`  
**Schema:** `kwizera.risk-intelligence.v1`

---

## 1. Mission

Connect verified ForexConnect **read-only** account and market telemetry to the existing Phase 2 pre-execution validator (`4.18G.4-P2`).

This stage does **not** implement broker order submission, modification, cancellation, or position closing.

Safety stamps (unchanged):

- `placesOrders = false`
- `acceptsForExecution = false`
- `mutatesBroker = false`
- Execution Master remains OFF
- Emergency Lock remains an independent hard block when ON
- Owner max lots remains `0.01`

---

## 2. Data sources (actual ForexConnect fields)

| Concern | Sidecar / bridge | Fields used |
|---------|------------------|-------------|
| Account | `GET /accounts` via `listAccounts()` | `accountId`, `accountIdMasked`, `environment`, `accountCurrency`, `balance`, `equity`, `usedMargin`, `usableMargin`, `dayPl?`, `grossPl?`, `missingFields`, `fetchedAt` |
| Open trades | `GET /trades` via `listTrades()` | `trades[]`: `tradeId`, `instrument`/`symbol`, `buySell`/`side`, `amount`/`lots`, `openRate`, mark/`close`, `grossPL`/`pl` |
| Closed trades (day) | `GET /closed-trades` via `listClosedTrades()` | `closedTrades[]`: `tradeId`, `closeTime`, `grossPL`/`pl`; `historyScope=CURRENT_TRADING_DAY` |
| Connection | `getStatus()` | `status === CONNECTED` |
| Quotes (spread) | Existing AT verification / live offer freshness | `bid`, `ask`, quote age ms |
| Contract size | Last verification instrument | `baseUnitSize`, `contractVerified` |

Reused helpers (no second risk engine):

- `sumOpenExposureLotsFromTradesPayload` / `countOpenPositionsFromTradesPayload`
- `computeDailyRiskSnapshot` + `DailyRiskStore` (UTC trading day)
- Phase 2 `runPreExecutionValidation`

---

## 3. Units and contracts

- **Lots:** `amount / baseUnitSize` when `lots` is absent; requires integer positive `baseUnitSize` and `amount % baseUnitSize === 0`.
- **XAU/USD:** uses the instrument’s verified FXCM `baseUnitSize` from verification (ounces/contract rules preserved; never invented).
- Missing / unverified contract → exposure `UNAVAILABLE`, `exposureAuthoritative=false` → precheck `EXPOSURE_UNVERIFIED`.

---

## 4. Freshness rules

| Snapshot | Max age (default) | Fail status |
|----------|-------------------|-------------|
| Accounts | `15_000` ms | `STALE` / `INVALID` if missing/future `fetchedAt` |
| Quotes | `5_000` ms | `STALE` |
| Empty accounts / failed trades | n/a | `UNAVAILABLE` — **not** treated as zero exposure/equity |

Never silently convert missing numerics to zero.

---

## 5. Exposure calculation

- Instrument-scoped lots/count when a proposed instrument is known; account-wide also reported for observability.
- Complete empty `/trades` with `ok=true` → verified **zero** open exposure.
- Incomplete / `ok=false` / missing quantity → unverified (blocked).
- Duplicate/conflict: any open trade on the proposed instrument → `duplicateTradeSuspected=true`.

---

## 6. Daily PnL and drawdown

- **Timezone / trading day:** UTC (`YYYY-MM-DD` via `tradingDayKeyUtc`). Project convention from `auto-engine/daily-risk` — **not** Rwanda time.
- **Realized day PnL priority:**
  1. `Accounts.dayPl` when finite → source `accounts.dayPl`
  2. Else sum of closed-trades grossPL for the UTC trading day → source `closed_trades_sum`
  3. Else `UNAVAILABLE` (precheck `DAILY_LOSS_UNAVAILABLE`)
- **Unrealized:** sum of open-trade `grossPL` when every row is finite; empty open book with `ok=true` → `0`.
- **Day-start equity:** established/persisted by `computeDailyRiskSnapshot` + `DailyRiskStore` on first fresh accounts snapshot of the UTC day. Mid-day first observation uses current equity as day-start (documented limitation until a prior same-day authoritative snapshot exists).
- **Drawdown:** equity vs day-start equity; unavailable when day-start missing/stale/invalid.
- Duplicate closed-trade ids → refuse fabricated daily PnL (`INVALID`).

---

## 7. Spread configuration

Phase 2 keeps `SPREAD_LIMIT_NOT_CONFIGURED` unless an **approved** limit is supplied:

1. Request body / query `maxSpreadAbsolute` (finite positive), or
2. Env `KWIZERA_AT_MAX_SPREAD_ABSOLUTE` (finite positive absolute price units for the instrument)

No automatic market-based limit selection.

---

## 8. Precheck integration

`AutomatedTradingService.runBrokerPrecheck` now:

1. Fetches Stage 2 risk intelligence (RO only).
2. Feeds `precheckAccount` + `precheckExposure` + spread limit into existing `runPreExecutionValidation` / `applyPreExecutionValidation`.
3. Attaches `riskIntelligence` on the response for observability.
4. Does **not** change authorization semantics; `allowed` remains false while Execution Master is OFF.

API:

- `GET /api/forex/automated-trading/risk-intelligence` (admin auth, read-only)
- Existing `POST /api/forex/automated-trading/broker-engine/precheck` (now includes live RO telemetry)

---

## 9. Remaining blockers (expected)

Even with verified telemetry, production remains blocked by design until a later owner-approved stage:

- `EXECUTION_MASTER_OFF`
- Emergency Lock when ON
- `masterEnable` / `automaticEntry` must stay false for Phase 2 safe-state checks
- `SPREAD_LIMIT_NOT_CONFIGURED` until env/request limit is set
- Day-start / drawdown may be unavailable until a fresh accounts snapshot establishes UTC day-start
- Contract-unverified instruments keep exposure blocked

---

## 10. Safety verification

- No call path to order submit / modify / cancel / close from Stage 2 modules.
- Bridge methods used: `getStatus`, `listAccounts`, `listTrades`, `listClosedTrades` only.
- Response stamps: `placesOrders=false`, `acceptsForExecution=false`, `mutatesBroker=false`.

---

## 11. Tests

Focused suite: `tests/unit/ai/forex-ai/stage2-live-read-only-risk-intelligence.test.ts`  
Regression: Phase 2 precheck + proposal/handoff/broker-execution foundation.

Commands run locally (Windows, vitest pool=forks, maxWorkers=1):

```text
node ./node_modules/vitest/vitest.mjs run --pool=forks --maxWorkers=1 \
  tests/unit/ai/forex-ai/stage2-live-read-only-risk-intelligence.test.ts \
  tests/unit/ai/forex-ai/phase418g4-p2-precheck.test.ts
→ Test Files 2 passed | Tests 67 passed (67)

node ./node_modules/vitest/vitest.mjs run --pool=forks --maxWorkers=1 \
  tests/unit/ai/forex-ai/phase418g4-broker-execution-foundation.test.ts \
  tests/unit/ai/forex-ai/phase418g3-broker-handoff.test.ts \
  tests/unit/ai/forex-ai/phase418g2-order-proposal.test.ts
→ Test Files 3 passed | Tests 77 passed (77)
```

Combined Stage 2 release gate: **144 passed / 0 failed**.
