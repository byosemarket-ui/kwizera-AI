# Stage 5 — Automated Per-Order Risk Management Engine

**Status:** Implemented (proposal preparation only; fail-closed; no broker mutation)  
**Module:** `ai/forex-ai/automated-trading/per-order-risk/`  
**Stage id:** `STAGE_5_AUTOMATED_PER_ORDER_RISK_ENGINE`  
**Schema:** `at-per-order-risk-v1`

---

## 1. Existing architecture audit

| Area | Authoritative location | Verdict |
|------|------------------------|---------|
| Capital allocation / 20%–25% risk | `simulation-risk/capital-budget.ts`, `order-proposal/types.ts` | Reuse — verified defaults |
| Quantity sizing | `simulation-risk/size-order-quantity.ts` | Reuse |
| Entry / structure SL / 3R price TP | `simulation-risk/propose-levels.ts` | Reuse + ATR fallback |
| Monetary SL risk / 3R target | `simulation-risk/allocation-3r.ts` | Reuse via Stage 5 monetary validator |
| Order proposal assembly | `order-proposal/engine.ts` | Reuse (not rewritten) |
| Spread / slippage policy | `risk-policy/` (Stages 3–4) | Consume resolve APIs |
| Precheck / handoff | `broker-execution/`, `broker-compatibility/` | Unchanged; consume proposal |
| Safety stamps | All AT modules | Preserved fail-closed |

**Gaps closed by Stage 5:** automatic Entry/SL when omitted; independent allocation identity; auditable per-order risk record; monetary ≥3R after sizing; Admin monitoring UI/API; `generateProposal` auto-levels wiring.

---

## 2. Modules reused

- `order-proposal/engine.ts` — `buildOrderProposal`
- `simulation-risk/capital-budget.ts` — allocation + 20/25 risk breakdown
- `simulation-risk/propose-levels.ts` — quote entry, structure SL, price 3R TP
- `simulation-risk/size-order-quantity.ts` — risk-budget quantity
- `simulation-risk/allocation-3r.ts` — monetary SL / 3R helpers
- `simulation-risk/quantity-constraints.ts` — FXCM min/step (incl. XAU)
- `risk-policy/resolve.ts` — approved spread/slippage status stamps on record

---

## 3. New modules created

| Path | Role |
|------|------|
| `per-order-risk/types.ts` | Risk record contracts, 20/25/3R constants, rejection codes |
| `per-order-risk/auto-levels.ts` | Auto Entry/SL/TP (structure → ATR → wait) |
| `per-order-risk/monetary-3r.ts` | Post-sizing monetary ≥3R validation |
| `per-order-risk/build-record.ts` | Auditable `PerOrderRiskRecord` + display categories |
| `per-order-risk/engine.ts` | Orchestrator `runAutomatedPerOrderRiskEngine` |
| `per-order-risk/index.ts` | Public exports |
| `desktop/forex-admin/ForexAdminPerOrderRiskPanel.tsx` | Read-only Admin UI |
| `tests/unit/ai/forex-ai/stage5-per-order-risk-engine.test.ts` | Stage 5 tests |
| `docs/forex/STAGE_5_AUTOMATED_PER_ORDER_RISK_ENGINE_REPORT.md` | This report |

---

## 4. Modified modules

- `order-proposal/types.ts` — optional `perOrderRisk` on proposal
- `service.ts` — `generateProposal` uses Stage 5 engine; `listPerOrderRiskRecords`
- `dev/server/forex-automated-trading-api.ts` — generate response fields + `GET .../per-order-risk`
- `desktop/forex-admin/api.ts` — `atPerOrderRiskApi`
- `desktop/forex-admin/ForexAdminPages.tsx` — settings panel mount

---

## 5. Capital allocation methodology

Each proposal receives an independent `allocationId` and uses configured `individualOrderAllocation` against remaining strategy budget (`equity × strategyAllocationPercent − reservations`). Allocations are not merged across orders. Duplicate / exhausted / missing allocation → fail-closed.

---

## 6. Operating risk percentage

**Verified existing default:** `DEFAULT_PER_ORDER_RISK_PERCENT = 20`  
(`PER_ORDER_RISK_TARGET_PERCENT` in order-proposal + capital-budget v2 policy `PER_ORDER_ALLOCATION_20TARGET_25MAX`).

---

## 7. 25% maximum loss policy

`MAX_PER_ORDER_LOSS_PERCENT = 25`  
`maximumAllowedMonetaryLoss = allocation × 0.25`  
`allowedRiskAmount = min(allocation × 0.20, allocation × 0.25)`  
Hard ceiling always wins; target is not permission to raise risk to 25%.

---

## 8. Stop Loss methodology

1. Explicit override (validated geometry)  
2. Nearest verified analysis support (BUY) / resistance (SELL)  
3. Verified ATR × multiplier (default 1.0) when structure missing  
4. Else `WAITING_FOR_VALID_STOP_LOSS` — SL **not invented**

---

## 9. Position sizing methodology

`quantity = floor(allowedRisk / riskPerUnit)` using verified pip/point cost or contract multiplier; floor-only rounding; re-check 20% target + 25% hard max; owner max `0.01` lots; broker min/step from FXCM metadata.

---

## 10. FXCM contract conversion

Per-instrument verified `pointSize`, `pipCostAccount`, `contractMultiplier`, `baseUnitSize`, `quantityMin`/`quantityStep`. XAU uses existing `resolveXauQuantityConstraints` — ounces not assumed. Unverified/ambiguous units block sizing.

---

## 11. Take Profit 3R methodology

Price TP from Entry–SL distance × 3, then **monetary** validation: expected TP profit / modeled SL risk ≥ 3 after quantity. Costs subtracted only when verified; otherwise disclosed and validated on gross.

---

## 12. Currency conversion

Existing `ensureAmountInAccountCurrency` path when allocation currency ≠ account currency. Missing/stale FX → block.

---

## 13. Margin validation

Proposal still requires usable margin freshness + estimated margin from sizer. Stage 3 proposed-order margin attestation remains authoritative at precheck. Missing margin → block.

---

## 14. Spread / slippage integration

Stage 5 stamps `spreadPolicyStatus` / `slippagePolicyStatus` from Stage 4 resolve. Precheck continues to fail-closed when limits are not APPROVED/VERIFIED. Stage 5 does not invent thresholds.

---

## 15. Per-order risk records

`PerOrderRiskRecord` attached as `proposal.perOrderRisk` with allocation id, prices, monetary risk/profit, R:R, quantity, contract, margin/spread/slippage status, timestamps, rejection reasons, display category.

---

## 16. Rejection codes

Reuses order-proposal codes where equivalent; Stage 5 adds/maps e.g. `WAITING_FOR_VALID_STOP_LOSS`, `TAKE_PROFIT_BELOW_3R`, `ORDER_ALLOCATION_UNAVAILABLE`, `ORDER_RISK_BUDGET_EXCEEDED`, `OWNER_MAX_LOT_EXCEEDED`, `MARKET_DATA_STALE`, `CONTRACT_SIZE_UNVERIFIED`, `MONETARY_3R_UNVERIFIED`.

---

## 17. Admin UI changes

`/admin/forex/settings` → **Per-order risk engine** panel (list + detail). Categories: VALIDATED / BLOCKED / WAITING_FOR_DATA / INVALID_RISK / EXPIRED. No execution buttons.

---

## 18. API changes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/forex/automated-trading/proposal/generate` | Auto-levels + risk record (optional `autoLevels`) |
| GET | `/api/forex/automated-trading/per-order-risk` | Read-only risk monitoring |

Safety stamps always `placesOrders=false`, `acceptsForExecution=false`, `mutatesBroker=false`, `executionAuthorized=false`.

---

## 19. Test results

```
npx vitest run tests/unit/ai/forex-ai/stage5-per-order-risk-engine.test.ts
→ 25 passed (25)
```

---

## 20. Safety verification

| Control | Stage 5 value |
|---------|---------------|
| placesOrders | false |
| acceptsForExecution | false |
| mutatesBroker | false |
| executionAuthorized | false |
| Execution Master | unchanged (OFF) |
| Emergency Lock | unchanged (ON) |
| Trading / masterEnable | unchanged (DISABLED) |
| Owner max lot | 0.01 |

---

## 21. Remaining limitations

- Modeled SL risk ≠ guaranteed realized loss (gaps/slippage/liquidity).  
- No broker-side SL/TP modification or trailing.  
- No order submission adapter (intentional Stage boundary).  
- ATR fallback requires verified ATR; otherwise waits for structure.  
- Commission netting only when cost data verified.

---

## 22. Production release information

See final Stage 5 implementation report (commit SHA, deploy SHA, health checks) after release steps complete.

---

## Modeled vs realized loss (explicit)

The engine’s Stop Loss monetary risk is a **planning estimate** from Entry–SL distance × quantity × verified contract metadata. Market gaps, execution slippage, liquidity shortages, and broker conditions can cause **realized loss to exceed** the modeled amount. Absolute loss guarantees are out of scope for Stage 5.
