# Phase 57.0 — DEMO Broker Execution Architecture, Order Lifecycle & Safety Gates

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Phase:** 57.0  
**Scope:** Architecture, lifecycle, reconciliation, and safety-gate **preparation only**.

**Final verdict:** `PASS_WITH_KNOWN_BLOCKERS`

> **No broker order was submitted, amended, cancelled, or closed. DEMO execution remains disabled. LIVE remains unauthorized.**

---

## 1. SHAs

| Item | SHA |
|------|-----|
| Pre-edit HEAD / deployed baseline | `6c5423a6` (Phase 56.4.7 docs) |
| Feature commit (this phase) | `bf60936aa809bb18b1fadbc9ee7d0cd8865b715c` |
| Documentation commit | _(this document)_ |
| Deployed production | `bf60936a…` (`verifiedLive=true`, `result=success`, timestamp `2026-10-22T23:15:24.425Z`) |

Production URL: `http://162.35.114.19:5173`  
Route: `/forex/automated-trading`

---

## 2. Objective vs execution readiness

| Concept | Status |
|---------|--------|
| **Code readiness** (intent model, preflight, disabled mutation stub, RO reconcile, tests, UI labels) | Implemented |
| **Execution readiness** (permission to submit DEMO broker orders) | **NOT READY** — deliberately blocked |
| **LIVE readiness** | **UNAUTHORIZED / BLOCKED** |

Passing unit tests and a healthy FC session do **not** authorize trading.

---

## 3. Existing broker capabilities (verified from code)

| Capability | Evidence | Status |
|------------|----------|--------|
| RO market data | `ForexConnectBridge` subscribe/poll/candles | VERIFIED path |
| RO account state | `listAccounts` | VERIFIED path |
| RO orders | GET sidecar `/orders` via `listOrders` | VERIFIED path |
| RO positions | GET sidecar `/trades` via `listTrades` | VERIFIED path |
| Order submission | **No** bridge/sidecar method | DISABLED / NOT_IMPLEMENTED |
| Modify / cancel / close | **No** application path | DISABLED / NOT_IMPLEMENTED |
| Protective-order mutation | **No** application path | DISABLED / NOT_IMPLEMENTED |
| FC `trading` stamp | Always `"DISABLED"` on status/RO payloads | VERIFIED |

SDK mutation APIs (if any exist in native ForexConnect) are **not** wired into this application. Presence of an SDK symbol elsewhere is **UNVERIFIED** for app use and must not be treated as support.

---

## 4. Architecture added (`ai/forex-ai/automated-trading/broker-intent/`)

| Module | Role |
|--------|------|
| `types.ts` | Intent record, lifecycle, rejection codes, capability enums |
| `capabilities.ts` | Explicit RO vs DISABLED mutation matrix |
| `mutation-stub.ts` | `DisabledBrokerMutationAdapter` — all ops → `EXECUTION_FORBIDDEN` |
| `protective-geometry.ts` | Local SL/TP / 3R checks; never claims broker protection |
| `preflight.ts` | Pure validation; always appends `EXECUTION_FORBIDDEN`; `maySubmitToBroker: false` |
| `reconciliation.ts` | Intent vs RO observation; ack ≠ fill; no invented IDs |
| `store.ts` | Durable `broker-intents.json`; idempotency-key dedupe |
| `engine.ts` | Validate/persist + public status |

API (Admin-gated; paths avoid `order`/`submit`/`execute` tokens that trip the hard gate):

- `GET /api/forex/automated-trading/broker-intent/status`
- `POST /api/forex/automated-trading/broker-intent/validate`
- `POST /api/forex/automated-trading/broker-intent/reconcile`

Hard gate retained: path regex → `403 EXECUTION_FORBIDDEN`.

---

## 5. Order-intent lifecycle (this phase)

```text
DRAFT → VALIDATING → BLOCKED | READY_FOR_AUTHORIZATION → AUTHORIZATION_REQUIRED → EXECUTION_DISABLED
```

Production Phase 57.0 outcomes: **`BLOCKED`** or **`EXECUTION_DISABLED`** only.

**Never entered:** `SUBMISSION_PENDING`, `BROKER_ACKNOWLEDGED`, `PARTIALLY_FILLED`, `FILLED`, etc.

- No fake broker order/deal/position IDs.
- `authorizationGranted: false` always.
- Local SL/TP → `protectiveStatus: LOCAL_CALCULATED_ONLY` (≠ broker-observed).

---

## 6. Protective SL/TP model

| Layer | Meaning |
|-------|---------|
| Locally calculated | Geometry + ~3R validated in preflight |
| Requested | Not submitted this phase |
| Broker-acknowledged / observed | Requires future authorized phase + RO evidence |
| Unknown | Default when no broker evidence |

Unprotected-fill **future** policy (documented, not actuated): block new entries, critical alert, **no autonomous close** in 57.0.

---

## 7. Reconciliation guarantees

- Intent alone → `INTENT_ONLY_NO_BROKER_EVIDENCE` (`inferredFill: false`).
- Order ack → `BROKER_ACK_NOT_FILL`.
- Unrelated RO open orders/positions → `UNKNOWN_BROKER_OUTCOME` (do not attribute).
- Deduped observed IDs; never invent quantities/prices/fees/P/L.
- Reconciliation **never** calls mutation methods.

---

## 8. Preflight / rejection codes (selected)

`EXECUTION_FORBIDDEN`, `DEMO_ENVIRONMENT_UNVERIFIED`, `ACCOUNT_STATE_UNVERIFIED`, `INSTRUMENT_NOT_ALLOWED`, `CONTRACT_SIZE_UNVERIFIED`, `QUANTITY_UNIT_AMBIGUOUS`, `QUOTE_STALE`, `STOP_LOSS_REQUIRED`, `TAKE_PROFIT_REQUIRED`, `TP_NOT_3R`, `RISK_LIMIT_EXCEEDED` (25% of **order allocation**), `DUPLICATE_INTENT`, `PROTECTION_CAPABILITY_UNVERIFIED`, `BROKER_STATE_RECONCILIATION_REQUIRED`, `AUTHORIZATION_REQUIRED`, `LIVE_EXECUTION_UNAUTHORIZED`, …

Allocation semantics preserved: strategy 1–100% of equity; estimated SL ≤ 25% of per-order allocation; TP target 3R where required.

---

## 9. Authorization / environment gates

- Server-side Admin via `requireForexAdmin`.
- Client flags cannot set `maySubmitToBroker`.
- `ownerExecutionAuthorized` forced `false` in service validate path.
- LIVE always rejected.
- DEMO label alone insufficient without `environmentVerified`.
- No production route submits a broker order.

---

## 10. UI

Compact **Broker intent (Phase 57.0)** panel: banner, `placesOrders`/`acceptsForExecution`/`mutatesBroker`/`executionDisabled`, intent count/latest state, explicit “No one-click execution.” Does not claim Order placed / Filled / Protected / Trading active.

---

## 11. Tests

```text
node ./node_modules/vitest/vitest.mjs run tests/unit/ai/forex-ai/phase57-0-broker-intent-architecture.test.ts --no-file-parallelism
→ 17 passed (17), exit 0
```

Coverage: capabilities, disabled mutation (all ops), SL/TP geometry + 3R, unprotected policy, preflight (DEMO pass→EXECUTION_DISABLED, LIVE block, unverified env, allowlist, stale+client flags, risk 25%), reconcile (intent-only, ack≠fill, unrelated exposure), idempotent store, API path safety, UI copy, FC bridge has no mutation methods.

**No test submitted a broker order.**

---

## 12. Safety invariants (must remain)

```text
masterTradingEnabled = false
emergencyEntryLock = true
placesOrders = false
acceptsForExecution = false
EXECUTION_FORBIDDEN
ForexConnect trading = DISABLED
automatic entry/re-entry = DISABLED
LIVE = UNAUTHORIZED
```

### Production post-deploy evidence (Admin RO + intent APIs)

| Check | Observed |
|-------|----------|
| Master / Emergency / Auto entry | OFF / ON / DISABLED |
| `placesOrders` / `readyForTrading` / module | false / false / BLOCKED |
| FC `capabilities.trading` | false |
| `POST …/order/submit` | 403 `EXECUTION_FORBIDDEN` |
| Broker open positions | 0 |
| `broker-intent/status` | banner Phase 57.0; `executionDisabled=true`; submission DISABLED |
| `broker-intent/validate` (structural DEMO) | `state=EXECUTION_DISABLED`, `maySubmitToBroker=false`, `brokerOrderId=null`, mutationProbe `EXECUTION_FORBIDDEN` |
| `broker-intent/reconcile` | `INTENT_ONLY_NO_BROKER_EVIDENCE`, `inferredFill=false` |

---

## 13. Known gaps / blockers for a future DEMO execution phase

1. No FC mutation adapter implementation (submit/modify/cancel/close/protective).
2. No owner authorization workflow that can grant time-bound DEMO permission.
3. No broker-observed protective-order verification path.
4. No fill/partial-fill ingestion or durable broker-ID binding.
5. Protection capability attestation for the live account/instrument remains incomplete for execution.
6. Production restart not required for this architecture phase beyond normal deploy.

---

## 14. Recommended next phase

**Phase 57.1 (owner-authorized only):** DEMO mutation adapter behind multi-gate authorization, paper-to-DEMO dry-run with RO reconciliation, protective-order attach proof — **only after explicit owner decision**. Do not start automatically from this report.

---

## 15. STOP

Phase 57.0 complete. Architecture prepared. Execution remains forbidden.
