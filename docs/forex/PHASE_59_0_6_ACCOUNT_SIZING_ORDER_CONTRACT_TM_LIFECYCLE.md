# Phase 59.0.6 — DEMO Account, Sizing Validation, Order Request Contract & Trade Monitor Lifecycle

**Date:** 2026-10-26  
**Deployed commit (unchanged):** `1e4e59032ec8d86b0126c488e7cccac197c89632`  
**Verdict:** `PARTIALLY VERIFIED`  
**Safety:** No broker mutation · no grant · no commit/push/deploy · `DisabledBrokerMutationAdapter` unchanged

---

## 1. Baseline recheck (read-only)

| Item | Evidence |
|------|----------|
| Deployed SHA | `1e4e5903` (`verifiedLive`) |
| Session / env | CONNECTED · DEMO |
| Stream | LIVE · lastQuoteAgeMs ~45ms |
| Instrument | XAU/USD · offerId `4001` · tradingStatus `O` |
| Ordinary AT | `placesOrders=false` · automation OFF · `brokerExecution=DISABLED` · `EXECUTION_FORBIDDEN` |
| Expected locks | `masterEnableExpected=false` · `emergencyEntryLockExpected=true` · `entryGenerationEnabled=false` |

---

## 2. Account + TradingSettings (masked)

### Accounts (admin RO `/broker-ro-tables`)
| Field | Value |
|-------|-------|
| Row present | **Yes** (count 1, code `OK`) |
| accountIdMasked | `***9634` |
| accountCurrency | `USD` |
| Balance/equity | Present (values not reported) |
| Working orders / open positions | 0 / 0 |

### XAU/USD Offers + TradingSettings (public instruments)
| Field | Value | Notes |
|-------|-------|-------|
| baseUnitSize | **1** | From TradingSettingsProvider |
| minQuantity | **1** | Min order amount |
| lotStep | **1** | Alias of minQuantity in sidecar (not a fractional step invention) |
| mmrPerLot | **4.79** | Absolute margin for 1 lot (not a rate) |
| contractMultiplier | **1** | |
| pointSize / digits | 0.01 / 2 | |
| pipCost | 0.01 | |
| condDistStop / Limit | 0 | Exposed; unit documented as pips when method hits |

**Unknown / not claimed:** full broker order-type permission matrix; TIF enum beyond SDK default; account maintenance flags (null in payload).

---

## 3. Quantity units and conversion

**Verified contract:** `amount = baseUnitSize * lots` (Gehtsoft `OpenPosition.py` + `mutation_demo.py`).

With live `baseUnitSize=1`, **1 lot → amount 1** (no double conversion when lots come from `floor(proposedQuantity)` then multiply once).

Fail-closed offline helper: `lots-to-broker-amount.ts` rejects null/invalid baseUnitSize, non-integer lots, DEMO lots > 50, amount < minQuantity. Does **not** invent baseUnitSize=1 when missing.

---

## 4. Offline request contract

`build-demo-open-request-contract.ts` validates:
- Account row present (masked id only in contract)
- Instrument, BUY/SELL, lots→amount
- Optional rateStop/rateLimit finiteness
- `orderType: TRUE_MARKET_OPEN`
- `timeInForce: SDK_DEFAULT_UNVERIFIED` (not invented as GTC/IOC)
- `brokerAccepted=false`, `fillConfirmed=false`, `mutatesBroker=false`

Explicitly **does not** call `sendRequest` / `createOrderRequest` even if hooks are passed (test-enforced).

---

## 5. Order lifecycle mapping + Trade Monitor

New: `normalize-broker-order-status.ts` maps known broker status strings →  
`PENDING | ACCEPTED | REJECTED | PARTIALLY_FILLED | FILLED | CANCELLED | EXPIRED | UNKNOWN`  
while preserving raw status. Missing → UNKNOWN/unavailable. Unmapped → UNKNOWN + raw retained.

`mergeBrokerOrderStatusUpdate` rejects duplicate no-ops and terminal→pending regressions.

Trade Monitor:
- `parse-broker-tables.ts` attaches `normalizedStatus` + `statusLabel`
- Working-orders table shows raw Status + Mapped column
- OrderID vs TradeID separation unchanged; no mock production rows

Live working-order statuses: none present (count 0) — mapping verified via unit fixtures only.

---

## 6. Tests / CI

| Artifact | Status |
|----------|--------|
| `tests/unit/ai/forex-ai/phase59-0-6-account-sizing-order-contract.test.ts` | Authored |
| Remote CI | **Not executed** — phase forbids commit/push/deploy; no separate workflow_dispatch-only runner was invoked |

---

## 7. Files changed (uncommitted)

- `ai/forex-ai/automated-trading/order-execution/lots-to-broker-amount.ts` *(new)*
- `ai/forex-ai/automated-trading/order-execution/normalize-broker-order-status.ts` *(new)*
- `ai/forex-ai/automated-trading/order-execution/build-demo-open-request-contract.ts` *(new)*
- `ai/forex-ai/automated-trading/order-execution/index.ts`
- `desktop/forex/trade-monitor/types.ts`
- `desktop/forex/trade-monitor/parse-broker-tables.ts`
- `desktop/forex/ForexTradeMonitorPage.tsx`
- `tests/unit/ai/forex-ai/phase59-0-6-account-sizing-order-contract.test.ts` *(new)*
- `docs/forex/PHASE_59_0_6_ACCOUNT_SIZING_ORDER_CONTRACT_TM_LIFECYCLE.md` *(new)*

Unrelated commercial/typography/video/PMV dirty files **not** staged.

---

## 8. Safety confirmation

- No order sent; no modify/cancel/close  
- No mutation grant; LIVE locked; ordinary AT disabled adapter  
- `placesOrders=false` / `acceptsForExecution=false` observed on RO APIs  
- Production secrets/VPS/services untouched  

---

## 9. Ready for controlled DEMO order-lifecycle?

**Not yet.** Prerequisites still unmet:

1. Owner authorization for a time-bounded DEMO grant  
2. Ops enablement of DEMO mutation env + secret (sidecar + Node) — out of this phase  
3. Remote CI green for new unit tests (requires approved commit path or non-deploy runner)  
4. Live Orders-table status samples (none currently open) to validate mapping against real FXCM strings  
5. Explicit certification plan: open → OrderID ack ≠ fill → TradeID → protect → close  

Market-live + account/sizing evidence is **necessary but not sufficient** for submission.
