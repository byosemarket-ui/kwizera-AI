# Phase 56.2.5 — Verified Quantity Constraints, Order Sizing & Automatic Allocation UI

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** Quantity constraint evidence + simulation sizing record  
**Starting HEAD:** `12cfa7b69734d24e91cef851a69a0d0103d6763e`  
**Production baseline at start:** `deployedCommit=12cfa7b6…`, `verifiedLive=true` (Phase 56.2.4 UI)  
**Ending HEAD / deployed:** `6c855d7dcd1d638113023ac8aa582ae241a9ab61` (`verifiedLive=true`)  
**CI run:** https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39531020413 (`success`)  
**Scope:** Simulation-only. **No broker mutations. LIVE unauthorized. Do not start Phase 56.3.**

---

## 1. Inspected paths

| Path | Role |
|------|------|
| `ai/forex-ai/automated-trading/simulation-risk/quantity-constraints.ts` | Min/step resolver (this phase) |
| `ai/forex-ai/automated-trading/simulation-risk/size-order-quantity.ts` | Allocation-aware quantity sizer |
| `ai/forex-ai/automated-trading/simulation-risk/propose-levels.ts` | Uses constraints for floor sizing |
| `ai/forex-ai/automated-trading/simulation-risk/assemble.ts` | Applies constraints to draft contract meta |
| `ai/forex-ai/position-sizing/contract-spec.ts` | Stop inventing XAU step=0.01 |
| `services/forexconnect-sidecar/server.py` | Distinct `minQuantity` from TradingSettings |
| `docs/forex/PHASE_56_2_4_XAU_QUANTITY_AND_MIN_STOP_VERIFICATION.md` | Prior discrepancy note |

---

## 2. quantityMin vs quantityStep — evidence conclusion

### 2.1 Official ForexConnect (O2GTradingSettingsProvider)

| API | Meaning | Unit (CFD / XAU) |
|-----|---------|------------------|
| `getMinQuantity(instrument, account)` | Minimum allowed order amount | **contracts** |
| `getBaseUnitSize(instrument, account)` | Size of one lot; **order amounts must be multiples of this value** | **contracts** |
| Separate fractional `lotStep` | **Not present** on the official provider | — |

Sources: ForexConnect API reference for `getMinQuantity` / `getBaseUnitSize` (fxcodebase / FXCM help archives).

### 2.2 Public FXCM product docs

| Claim | Status |
|-------|--------|
| 1 XAU/USD contract = 1 troy ounce | **VERIFIED** (FXCM Markets contract-size guide) |
| Max 10,000 contracts per click; $0.01 / point | **VERIFIED** (XAU help) |
| UK marketing “from 0.01 lots upwards” | **NOT** used as DEMO ForexConnect Offers proof (entity/platform marketing) |

### 2.3 DEMO runtime (prior Phase 56.1 production instruments GET)

| Field | Observed | Notes |
|-------|----------|-------|
| `baseUnitSize` | `1` | `VERIFIED_INSTALLED_RUNTIME` |
| `lotStep` | `1` | Was filled from `getMinQuantity` in sidecar (misnamed) |
| `pointSize` / `pipCost` / `contractMultiplier` | `0.01` / `0.01` / `1` | Aligns with published contract |

### 2.4 Root cause of `quantityMin=0.01` vs `quantityStep=1`

| Value | Origin | Authoritative? |
|-------|--------|----------------|
| `0.01` | Local `contract-spec.ts` fallback when `quantityUnit === "lots"` | **NO** — invention for FX lots path |
| `1` (as `lotStep` / reported step) | Sidecar mapped `getMinQuantity` → `lotStep` | **YES as minimum**, **NO as fractional step** |
| Increment | `getBaseUnitSize` (=1 on DEMO XAU) | **YES** — SDK rule |

**Conclusion (DEMO XAU/USD, aligned metadata):**

- `quantityMin` = **1 contract** (SDK `getMinQuantity`, historically aliased as `lotStep`)
- `quantityStep` = **1 contract** (= `BaseUnitSize`)
- Unit = **contracts** (1 contract = 1 troy ounce per published FXCM guide + DEMO alignment)
- Do **not** treat `0.01` as a valid XAU contract minimum for this DEMO path
- Do **not** invent replacing `1` with `0.01` or inventing ounces↔lots conversions

If SDK min is missing after discarding `0.01`, sizing remains **BLOCKED** (fail closed).

---

## 3. Formulas (simulation)

```
strategyAllocationBudget = verifiedEquity × strategyAllocationPercent / 100
maxPermittedOrderLoss = individualOrderAllocation × 25 / 100
riskPerUnit = (abs(entry − SL) / pointSize) × pipCostAccount   // when verified
rawQuantity = maxPermittedOrderLoss / riskPerUnit
proposedQuantity = floor(rawQuantity / quantityStep) × quantityStep
  (reject if < quantityMin; never round up past loss/margin/budget)
requiredMargin = marginPerUnit × proposedQuantity   // distinct from order allocation
```

3R Take Profit and mandatory SL/TP policies unchanged from Phase 56.2.x.

---

## 4. Implementation summary

1. Sidecar exposes `minQuantity` separately; keeps CondDist never mapped to lotStep.  
2. `resolveXauQuantityConstraints` discards invented `0.01` lots min for contracts.  
3. `sizeOrderQuantityFromAllocation` requires equity, currency (USD), strategy %, remaining budget, allocation, exposure authority, verified geometry/contract.  
4. Engine uses the full sizer; fail closed on missing gates.  
5. Simulation Draft UI (56.2.4) unchanged in intent: Order Allocation only; derived grid.

---

## 5. Tests (lightweight local)

`tests/unit/ai/forex-ai/phase56-2-5-quantity-sizing.test.ts` (+ prior 56.2.4 / 56.2 regression):

- 0.01 vs 1 discrepancy handling  
- Unknown/contradictory metadata blocks sizing  
- Floor rounding never breaches 25% loss ceiling  
- Allocation ≠ required margin  
- Exposure / currency / ambiguous unit fail closed  
- UI Order Allocation-only + execution flags closed  
- Sidecar CondDist safety comments preserved  

---

## 6. Safety locks

| Lock | State |
|------|-------|
| `masterTradingEnabled` | `false` |
| `emergencyEntryLock` | `true` |
| `placesOrders` | `false` |
| `acceptsForExecution` | `false` |
| ForexConnect trading | DISABLED |
| LIVE | unauthorized |

---

## 7. Remaining blockers

1. Account Enhanced Execution / CondDist numeric min-stop still **UNVERIFIED** unless SDK returns positive CondDist.  
2. Non-USD account currency conversion path **NOT_AVAILABLE**.  
3. LIVE identity / metadata parity **UNVERIFIED**.  
4. Stale quotes / incomplete Orders–Trades RO still fail closed (by design).  

---

## 8. Changed files (this phase)

- `ai/forex-ai/automated-trading/simulation-risk/quantity-constraints.ts` (new)  
- `ai/forex-ai/automated-trading/simulation-risk/size-order-quantity.ts` (new)  
- `ai/forex-ai/automated-trading/simulation-risk/{propose-levels,assemble,engine,index}.ts`  
- `ai/forex-ai/position-sizing/contract-spec.ts`  
- `ai/forex-ai/automated-trading/verification-engine.ts`  
- `ai/market-data/forexconnect/{types,provider}.ts`  
- `services/forexconnect-sidecar/server.py`  
- `tests/unit/ai/forex-ai/phase56-2-5-quantity-sizing.test.ts` (new)  
- `docs/forex/PHASE_56_2_5_QUANTITY_SIZING_AND_ALLOCATION_VERIFICATION.md`  

---

## 9. CI/CD / production verification

| Item | Evidence |
|------|----------|
| Commit | `6c855d7dcd1d638113023ac8aa582ae241a9ab61` |
| CI | Run `39531020413` — **success** (Validate + Deploy to VPS) |
| `/api/deployment` | `deployedCommit=6c855d7d…`, `verifiedLive=true`, `result=success` |
| `/api/health` | `healthy` |
| Production URL | `http://162.35.114.19:5173/forex/automated-trading` |
| UI | Order Allocation only; derived grid; `placesOrders=false`; `acceptsForExecution=false`; master OFF; emergency lock ON |
| Responsive | No horizontal overflow at 390 / 768 / 1024 / 1440 |

**Verdict:** `PASS_WITH_KNOWN_BLOCKERS`

*End of Phase 56.2.5 record.*
