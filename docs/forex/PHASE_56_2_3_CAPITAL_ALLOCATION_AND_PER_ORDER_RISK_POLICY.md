# Phase 56.2.3 — Capital Allocation & Per-Order Risk Policy

**Project:** KWIZERA AI STUDIO  
**Module:** Automated Trading — simulation + configuration  
**Baseline HEAD at start:** `7b64900be23aa96db6e238e4531dd62fade8bdb6`  
**Scope:** Policy formulas + simulation/config only. **No broker execution.**

---

## 1. Distinctions (non-interchangeable)

| Quantity | Meaning |
|----------|---------|
| **Verified equity** | Accounts `equity` when verified & finite — **not** balance/usableMargin |
| **Strategy capital allocation %** | Owner setting **1–100%** of equity for AT strategy budget |
| **Strategy capital allocation budget** | `equity × strategy% / 100` — ceiling for the strategy, not broker free margin |
| **Per-order allocation** | Slice of **remaining** strategy budget for one draft/order |
| **Broker-required margin** | Margin the broker would require for a quantity — separate check |
| **Estimated Stop Loss risk (R)** | Estimated monetary loss if SL is hit (modeled) |
| **Per-order loss limit** | **25% of that order’s allocation** (owner-approved) |
| **3R target** | `3 × R` reward objective when R is valid |
| **Usable / used margin** | Broker account margin fields — not strategy budget |

---

## 2. Strategy capital allocation (owner setting)

### 2.1 Range and persistence

- Valid range: **1 ≤ capitalAllocationPercent ≤ 100** (finite number).  
- Invalid: missing when required for drafts, ≤0, >100, NaN, Inf, non-numeric.  
- **Do not auto-set to 100%.**  
- Persist via existing AT `settings.json` controls (admin-authenticated `POST …/controls`).  
- Saving must **not** change execution locks or grant `acceptsForExecution`.

### 2.2 Budget formula

```text
capitalAllocationBudget = verifiedAccountEquity * capitalAllocationPercent / 100
```

If equity unavailable, stale, or unverified → budget `UNAVAILABLE` / `BLOCKED`.  
**Never** silently substitute `balance` or `usableMargin` for equity.

Label in UI: **overall capital allocation budget** — not “amount spent on every order”.

---

## 3. Per-order allocation (shared strategy budget)

```text
reservedActive = sum(ACTIVE reservations for this environment)
remainingBudget = capitalAllocationBudget - reservedActive
perOrderAllocation = min(requestedPerOrderAllocation, remainingBudget)
```

Rules:

1. Multiple orders **share** one strategy budget; sum of ACTIVE allocations ≤ budget.  
2. Do **not** grant each order the full strategy budget independently.  
3. If open exposure / margin usage cannot be determined when required → **fail closed**.  
4. Rejected / cancelled / closed drafts **release** their reservation (status → `RELEASED`).  
5. Concurrent reserves must not over-allocate (store update is serialized on AT/sim store).

`perOrderAllocation` ≠ required broker margin ≠ R.

---

## 4. Per-order maximum estimated loss (owner-approved)

```text
perOrderLossLimit = perOrderAllocation * 0.25
riskLimitPass = estimatedStopLossRisk <= perOrderLossLimit
```

Example: allocation $100 → limit $25. Estimate $25.01 → **block**. Estimate $20 → this check **passes** (other gates still apply).

### 4.1 What the 25% is **not**

- Not 25% of entire account equity  
- Not 25% of strategy budget unless the whole budget is allocated to that one order  
- Not margin %  
- Not a guarantee of realized max loss (slippage, gaps, costs)

### 4.2 When the check may run

Only when:

- `perOrderAllocation` finite and > 0  
- Quantity units unambiguous & verified  
- Contract value-per-move verified  
- Entry/SL valid; geometry OK  
- Required FX conversion verified if needed  

Otherwise: **do not fabricate R**; return `BLOCKED` / `UNVERIFIED`.

---

## 5. Estimated Stop Loss risk and 3R

Reuse Phase 56.2.2 estimation path when inputs verified:

```text
R = instrumentSpecificLossAtSL(...)   # null if unverified
targetReward3R = 3 * R                # only if R valid and > 0
```

BUY theoretical TP above entry; SELL below entry; respect verified digits.

Net target after costs: `NOT_VERIFIED` unless cost assumptions verified.

---

## 6. Rounding, freshness, concurrency

| Topic | Rule |
|-------|------|
| Money display | Round to account currency decimals when known; otherwise 2 dp label with `approx` note |
| Stale equity/quotes | Block dependent eligibility |
| Draft reservation | Created on successful persist of a draft that claims allocation; released on reject/cancel/close per store semantics |
| Race | Single-writer store update; second reserve that would exceed budget → `BLOCKED` |
| Realized vs estimated | UI/docs must say estimated |

---

## 7. Relationship to Phase 56.2.2 allocation band

56.2.2’s **12–25%** band was an optional **sizing input** relative to equity and is **not** the strategy capital setting.

56.2.3 strategy capital is **1–100%** owner setting.  
Per-order loss limit is **25% of per-order allocation** (new owner approval) — this **resolves** the prior “hard max-loss undecided” **for the per-order allocation base only**, not as 25% of account.

If strategy capital % is unset, drafts that need budget accounting stay blocked.

---

## 8. Safety

`placesOrders=false`, `acceptsForExecution=false`, emergency lock preserved, LIVE unauthorized, no broker mutations.

*End of Phase 56.2.3 capital / per-order risk policy.*
