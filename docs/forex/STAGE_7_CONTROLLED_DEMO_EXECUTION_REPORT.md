# Stage 7 — First Controlled FXCM DEMO Execution

**Status:** Implemented (readiness + one-time grant + blocked attempts; **broker mutation DISABLED**)  
**Module:** `ai/forex-ai/automated-trading/controlled-demo-execution/`  
**Stage id:** `STAGE_7_CONTROLLED_DEMO_EXECUTION`  
**Schema:** `at-controlled-demo-execution-v1`  
**Phase:** `7.0`

---

## 1. Implementation summary

Stage 7 adds a controlled execution **readiness coordinator**, **owner one-time grant** (bound to exact proposal snapshot), **idempotent attempt store**, **TIF verification**, and **post-fill protection verification** (fixture / authoritative evidence only).

Broker mutation remains **DISABLED**:

- `submissionEnabled=false`
- `activatesMutation=false` on all grants
- `STAGE_7_MUTATION_DISABLED` always present
- No wiring to `create_order_request` / `send_request`
- Admin UI has **no submit-order** control

Execution Master must remain **OFF** and Emergency Lock **ON** for this stage’s development posture. Actual DEMO order submission requires a separate explicit owner authorization stage.

---

## 2. Files created / modified

### Created

- `ai/forex-ai/automated-trading/controlled-demo-execution/types.ts`
- `ai/forex-ai/automated-trading/controlled-demo-execution/tif.ts`
- `ai/forex-ai/automated-trading/controlled-demo-execution/protection.ts`
- `ai/forex-ai/automated-trading/controlled-demo-execution/readiness.ts`
- `ai/forex-ai/automated-trading/controlled-demo-execution/grant.ts`
- `ai/forex-ai/automated-trading/controlled-demo-execution/store.ts`
- `ai/forex-ai/automated-trading/controlled-demo-execution/coordinator.ts`
- `ai/forex-ai/automated-trading/controlled-demo-execution/index.ts`
- `desktop/forex-admin/ForexAdminControlledDemoPanel.tsx`
- `tests/unit/ai/forex-ai/stage7-controlled-demo-execution.test.ts`
- `docs/forex/STAGE_7_CONTROLLED_DEMO_EXECUTION_REPORT.md`

### Modified

- `ai/forex-ai/automated-trading/service.ts` — Stage 7 service methods
- `dev/server/forex-automated-trading-api.ts` — `/demo-control/*` routes
- `desktop/forex-admin/api.ts` — `atControlledDemoApi`
- `desktop/forex-admin/ForexAdminPages.tsx` — panel mount

---

## 3. Modules reused

| Module | Use |
|--------|-----|
| Stage 6 `verifyDemoEnvironment` | Multi-signal DEMO enforcement |
| Stage 6 `evaluateStage5ProposalIntegrity` | Proposal / risk / allocation gates |
| Stage 6 `buildFxcmTrueMarketOpenPayload` | Contract size / quantity / owner max |
| Stage 6 `AssertNeverCalledMutationPort` | Test mutation ban |
| Stage 5 order-proposal + per-order-risk | Canonical proposal input |
| Stage 4 risk-policy spread/slippage resolve | Policy VERIFIED status |
| Broker execution foundation | Execution Master / controls observation |
| `requireForexAdmin` | Owner authorization boundary for API |

---

## 4. Readiness gates (25+)

Machine-readable blockers include (non-exhaustive):  
`BROKER_CONNECTION_UNHEALTHY`, `LIVE_ENVIRONMENT_FORBIDDEN`, `DEMO_ENVIRONMENT_NOT_VERIFIED`, proposal integrity codes, `OPERATING_RISK_ABOVE_20PCT`, `ORDER_RISK_BUDGET_EXCEEDED`, `TAKE_PROFIT_BELOW_3R`, `OWNER_MAX_LOT_EXCEEDED`, `CONTRACT_SIZE_UNVERIFIED`, `SPREAD_LIMIT_NOT_CONFIGURED`, `SLIPPAGE_LIMIT_NOT_CONFIGURED`, `MARKET_DATA_STALE`, `PROPOSED_ORDER_MARGIN_UNVERIFIED`, `PROTECTION_NOT_ATTACHABLE`, `UNSUPPORTED_TIF_GTD`, `UNRESOLVED_SUBMISSION_EXISTS`, `CONFLICTING_ACTIVE_EXECUTION`, `EXECUTION_MASTER_OFF`, `EMERGENCY_LOCK`, `TRADING_DISABLED`, `PER_SUBMISSION_AUTHORIZATION_MISSING`, grant binding/expiry codes, **`STAGE_7_MUTATION_DISABLED`**.

Display states: `NOT_READY` → `READY_FOR_OWNER_REVIEW` → `OWNER_AUTHORIZED` (still non-submitting) plus submission/protection states for future wiring.

---

## 5. Authorization model

- API gated by existing **`requireForexAdmin`** (owner-level Forex Admin boundary).
- Grant issuance requires `confirm=true` + exact echo of proposal id/version, instrument, side, qty, entry/SL/TP, TIF, account.
- Grant is short-lived, one-time, DEMO-bound, `activatesMutation=false`.
- Grant does **not** authorize ForexConnect mutation in Stage 7.

---

## 6. Idempotency and reconciliation

- Attempts persisted with unique idempotency key before any possible mutation (mutation never reached).
- Duplicate keys return existing attempt.
- `UNKNOWN` / `SUBMISSION_PENDING` / `RECONCILIATION_REQUIRED` / `PROTECTION_PENDING` block new readiness for the proposal.
- Dry-run / HTTP 200 never interpreted as broker acceptance (`verifiedBrokerAcceptance` stays false without authoritative broker evidence).

---

## 7. Post-fill protection

`verifyPostFillProtection` validates trade identity, fill qty/price, broker SL/TP, ≤25% monetary risk, ≥3R. Missing SL/TP → `PROTECTION_FAILED`. No auto-close / compensating orders in Stage 7. Live broker attach path remains unexercised (mutation disabled).

---

## 8. Time In Force

**Supported:** `IOC`, `GTC`, `FOK`, `DAY` (verified OM set from Stage 6).  
**Rejected:** `GTD` via `UNSUPPORTED_TIF_GTD` — never silently converted.

---

## 9. API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/forex/automated-trading/demo-control/status` | Public Stage 7 status |
| POST/GET | `/api/forex/automated-trading/demo-control/readiness` | Evaluate readiness |
| POST | `/api/forex/automated-trading/demo-control/grant` | Issue one-time grant (`confirm=true`) |
| POST | `/api/forex/automated-trading/demo-control/grant/revoke` | Revoke grant |
| GET | `/api/forex/automated-trading/demo-control/audit` | Audit trail |

Path namespace avoids `/order|submit|execute/` EXECUTION_FORBIDDEN gate.

---

## 10. Safety end-state (required)

| Control | Required |
|---------|----------|
| Execution Master | OFF |
| Emergency Lock | ON |
| Active execution grant (mutation-activating) | None |
| Broker order submitted | None |
| Broker mutation calls | 0 |
| Stage 8 | Not started |

---

## 11. Production release

Filled after commit / Actions / deploy / runtime verification.
