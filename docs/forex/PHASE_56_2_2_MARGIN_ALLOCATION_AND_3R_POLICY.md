# Phase 56.2.2 — Margin Allocation Policy, 3R Target & Simulation Acceptance

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading — Simulation Risk  
**Document type:** Owner-approved policy + simulation contract  
**Baseline HEAD at start:** `045d67fc41afaa5d64aa793cd5619e9d10b8945b`  
**Production baseline at start:** `deployedCommit=045d67fc…`, `verifiedLive=true`  
**Scope:** Policy formalization and simulation-only calculations. **No broker execution.**

---

## 1. Purpose

Formalize the owner's margin-allocation policy, separate Stop Loss monetary-risk estimation from allocation sizing, define a **3R** Take Profit objective, and specify evidence-based profit-protection rules for **simulation only**.

This document does **not** authorize LIVE trading, broker orders, or execution-lock changes.

---

## 2. Explicit distinctions (do not conflate)

| Concept | Meaning | Status |
|---------|---------|--------|
| **Account equity** | Verified equity from Accounts snapshot (prefer equity over balance; never silently substitute usable margin) | Use verified fields only |
| **Allocation % (12–25%)** | Share of **equity** used as a **position/margin sizing budget input** | **Owner-approved** |
| **Allocation budget** | `verifiedAccountEquity × allocationPercentage / 100` | Sizing input — **not** permitted loss |
| **Estimated SL risk (R)** | Estimated monetary loss if price reaches Stop Loss for a **verified** quantity | Independent of allocation % |
| **3R target** | Take-profit objective where monetary reward ≈ `3 × R` | Objective, not a promise |
| **Hard max-loss % per trade** | Separate ceiling on acceptable monetary loss vs equity | **Not owner-approved yet** — unresolved |
| **Required margin** | Broker margin for a quantity under verified leverage/rules | Separate check; not equal to allocation budget |

**Do not reinterpret 12%–25% as maximum acceptable loss on a trade.**

---

## 3. Account equity and related balances

From the existing verification / simulation account contract:

| Field | Use |
|-------|-----|
| `equity` | Primary base for `allocationBudget` when finite and verified |
| `balance` | Fallback only when equity is missing **and** a documented rule allows it; otherwise block allocation budget |
| `usableMargin` / free margin | Affordability / margin eligibility — **not** the allocation base |
| `usedMargin` | Exposure context only when authoritative |

Rule: never substitute usable margin for equity when computing allocation budget.

---

## 4. Margin / position allocation (owner-approved)

### 4.1 Approved range

```text
12 <= allocationPercentage <= 25
```

```text
allocationBudget = verifiedAccountEquity * (allocationPercentage / 100)
```

### 4.2 Selection rules (deterministic eligibility — not confidence-only)

An allocation inside 12–25% may be **considered** only when **all** of the following hold:

1. Environment context is consistent for simulation (DEMO/LIVE context may appear; execution remains forbidden).
2. Instrument is on the XAU/USD allowlist.
3. Account equity is verified and finite.
4. Quote freshness is not FAIL (stale quotes do not force allocation).
5. Market evidence strength is not `WEAK`, `CONTRADICTORY`, or `INSUFFICIENT` (see §7).
6. Direction is BUY or SELL with valid structural intent for a draft.

If evidence is weak, contradictory, stale, or insufficient, the system must return **`WATCH`**, **`BLOCKED`**, or **no proposed draft** — it must **not** force a 12–25% allocation or invent a trade to consume the budget.

Allocation percentage must **not** be chosen solely from an uncalibrated AI confidence score.

### 4.3 What allocation does **not** do

- Does not equal required broker margin.
- Does not approve quantity when quantity units / contract metadata are unverified.
- Does not set Stop Loss risk (R).
- Does not authorize execution (`placesOrders` / `acceptsForExecution` remain false).

---

## 5. Stop Loss monetary risk (independent of allocation)

### 5.1 Definition

```text
R = estimated monetary loss at the proposed Stop Loss
    for a verified quantity and verified instrument value-per-move inputs
```

### 5.2 Required verified inputs (non-exhaustive)

- Entry price, Stop Loss price, direction  
- Proposed / requested position quantity (finite, step-aligned when step verified)  
- Quantity unit (non-ambiguous; **never invent XAU ounces**)  
- Contract multiplier and/or verified pip/point cost in account currency  
- Price precision / point size  
- Account currency conversion when quote currency ≠ account currency (**if unverified → block**)

Commission, spread, and execution costs: include in **net** estimates only when verified assumptions exist; otherwise label **`NOT_VERIFIED`**.

### 5.3 Estimation formula (simulation)

When `pointSize > 0` and `pipCostAccount` (account-currency value per point per quantity unit) are verified:

```text
priceMove = abs(entryPrice - stopLoss)
estimatedStopLossRisk = (priceMove / pointSize) * pipCostAccount * quantity
```

When instead a verified `contractMultiplier` maps price×quantity → account currency:

```text
estimatedStopLossRisk = priceMove * contractMultiplier * quantity
```

If neither path is fully verified, **do not fabricate R**. Report `estimatedStopLossRisk = null` and block dependent 3R / RR outputs.

Label: **estimated** risk — not guaranteed maximum loss (slippage, gaps, costs).

### 5.4 Independent hard max-loss guard (unresolved)

The owner has **not** specified a separate hard maximum-loss percentage per trade.

- Do **not** treat 12–25% allocation as that limit.  
- Do **not** invent an owner-approved loss ceiling.  
- Until approved **and** inputs are reliable, drafts must **not** be declared fully eligible for execution.  
- Simulation may still report allocation budgets and (when possible) estimated R / 3R with explicit blockers.

Code signal: keep a dedicated blocked reason (e.g. `HARD_MAX_LOSS_POLICY_UNDECIDED`) distinct from allocation-range validation.

---

## 6. Take Profit objective: 3R

```text
R = estimatedStopLossRisk   # monetary, when available
targetReward = 3 * R
```

Price-distance form (when R scales linearly with stop distance for the same quantity/contract):

```text
stopDistance = abs(entryPrice - stopLoss)
targetPriceDistance = 3 * stopDistance
BUY:  theoreticalTakeProfit = entryPrice + targetPriceDistance
SELL: theoreticalTakeProfit = entryPrice - targetPriceDistance
```

Requirements:

- BUY: TP above entry; SELL: TP below entry (geometry).  
- Representable under verified price precision.  
- Report theoretical **gross** target; **net** target only when costs are supported, else `NOT_VERIFIED`.  
- 3R is an **objective**, not a promise the market will reach it.  
- Never invent a numeric R or 3R when calculation inputs are missing.

### 6.1 Risk/reward validation

Compute `riskRewardRatio = estimatedReward / estimatedStopLossRisk` only when both are finite and `estimatedStopLossRisk > 0`.

Block (or keep blocked) when:

- SL or TP missing / invalid geometry  
- Quantity or contract units unverified  
- Risk calculation unavailable  
- Account / instrument metadata missing  
- Min-stop unverified where required  
- Target cannot be represented at verified precision  

---

## 7. Evidence-based profit protection (simulation only)

### 7.1 Intent

1. Draft starts with valid SL and a 3R TP objective (when calculable).  
2. Monitor validated market-state / multi-timeframe evidence.  
3. Favorable move alone ≠ continued trend.  
4. Reversal requires **defined market evidence**, not uncalibrated confidence alone.  
5. Insufficient / contradictory evidence → continue monitoring or `WATCH`.  
6. Confirmed reversal (simulation) may recommend a **protective** action.  
7. **Never widen** original Stop Loss.  
8. Any proposed SL adjustment must be directionally protective and policy-consistent.  
9. Early-exit proposals must cite evidence, trigger, and reason.  
10. Do not hold solely to force 3R.  
11. Trailing stops require a **documented deterministic rule**; any numeric threshold not yet owner-approved must be labeled **proposed / pending owner approval**.  
12. Simulated suggestions ≠ broker position management (`isBrokerExecution=false`, `placesOrders=false`).

### 7.2 Simulation states

| State | Meaning |
|-------|---------|
| `NOT_APPLICABLE` | No open sim context / insufficient setup |
| `MONITORING` | Favorable or neutral; no protective action |
| `WATCH` | Evidence weak/contradictory — do not claim reversal |
| `REVERSAL_CONFIRMED_SIM` | Documented reversal conditions met (simulation) |
| `PROTECTIVE_ACTION_PROPOSED_SIM` | Propose tighten-SL or early-exit **in simulation only** |

### 7.3 Proposed parameters (pending owner approval)

These are **not** live-trading rules until explicitly approved:

| Parameter | Proposed default (simulation discussion only) | Status |
|-----------|-----------------------------------------------|--------|
| Minimum favorable move before protection logic | ≥ 1R price distance | **Pending owner approval** |
| Trailing / tighten offset | Keep SL at break-even or lock ≥ 0.5R — exact value TBD | **Pending owner approval** |
| Hard max-loss % | Unspecified | **Unresolved** |

---

## 8. Outstanding capability blockers (explicit)

Unchanged / still open without verified evidence:

1. **XAU/USD quantity-unit / ounce semantics** — do not invent.  
2. **Broker minimum-stop-distance** — unverified in production assemble path.  
3. **Orders/Trades read-only** — exposure not authoritative (`exposureDataAuthoritative=false` in assemble).  
4. **Independent hard max-loss %** — not owner-approved.  
5. Unverified FX conversion, margin formulas, or execution-cost assumptions.

---

## 9. Safety invariants (unchanged)

- `masterEnable=false` / master trading off  
- `emergencyEntryLock=true`  
- `placesOrders=false`  
- `acceptsForExecution=false`  
- Execution equivalent: forbidden / module blocked  
- ForexConnect trading disabled  
- LIVE unauthorized  

Simulation drafts are never broker orders.

---

## 10. Implementation mapping

| Policy item | Simulation artifact |
|-------------|---------------------|
| Allocation range | `allocationPercentage`, checks `ALLOCATION_*` |
| Allocation budget | `allocationBudget` from verified equity |
| SL risk R | `estimatedStopLossRisk` (null if unverified) |
| 3R | `targetReward3R`, `theoreticalTakeProfit3R` |
| Net target | `estimatedNetTarget` or `NOT_VERIFIED` |
| RR | `riskRewardRatio` when valid |
| Profit protection | `profitProtection` block (`simulationOnly`) |
| Hard max-loss | `HARD_MAX_LOSS_POLICY_UNDECIDED` blocker |
| Eligibility | Never sets `acceptsForExecution=true` |

---

## 11. Non-start

- Phase 56.3 / broker execution: **not started**  
- No order/position mutations  
- No lock or credential changes  

*End of Phase 56.2.2 policy.*
