# Phase 56.4.3 — Simulation Lifecycle UI Acceptance & Persistence Soak

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading (simulation / verification only)  
**Phase:** 56.4.3  
**This phase does not authorize broker order submission, DEMO execution, or LIVE trading.**

---

## 1. Baseline (verified before edit)

| Item | Observed |
|------|----------|
| Local HEAD (start) | `081edbe4` (Phase 56.4.2 docs) |
| Production `/api/deployment` | `081edbe4…`, `verifiedLive=true`, `result=success`, `status=live` |
| Dirty unrelated files | PMV / typography / video — **preserved, not staged** |
| Gap vs 56.4.2 | Lifecycle **APIs** existed; AT UI lacked reopen / open / monitor / close / draft-history / positions panel |

---

## 2. Confirmed defects / gaps

| Gap | Evidence | Fix |
|-----|----------|-----|
| No draft reopen UI | Only "Validate draft" control | `Reopen & revalidate` + history list Reopen buttons → `POST …/simulation-risk/reopen` |
| No sim open/monitor UI | APIs unused from UI | Buttons + Simulated positions panel |
| No manual sim close | Exit paths incomplete for authorized UI | `closeSimulatedPositionManual` + `POST …/simulation-lifecycle/close` (idempotent) |
| Reopen only latest | Could not reopen by draft id | `draftId` on reopen + `getById` on draft store |

---

## 3. Files changed

| File | Reason |
|------|--------|
| `desktop/forex/ForexAutomatedTradingPage.tsx` | Draft history, reopen, open/monitor/close UI, lifecycle panel |
| `desktop/forex/forex.css` | Responsive lifecycle / history layout |
| `simulation-lifecycle.ts` | Manual sim close (idempotent) |
| `sim-risk store` / engine | `getById` |
| `service.ts` | reopen by id; closeSimulatedPosition |
| `forex-automated-trading-api.ts` | close route; reopen `draftId` |
| `phase56-4-3-*.test.ts` | UI wiring + close + persistence soak |
| This document | Evidence |

---

## 4. Unit / soak (local, light)

```text
npx vitest run phase56-4-3-simulation-lifecycle-ui.test.ts phase56-4-2-…
→ 26 passed (7 new + 19 regression)
```

Persistence soak (isolated tmp storage): **5** monitor/reload cycles, **1** simulated position, no duplicate open IDs; closed position survives reload. Duration ≈ **2.7s** wall for soak test body.

Classes: **unit / synthetic only** until production UI section filled.

---

## 5. CI / deploy

| Check | Status |
|-------|--------|
| Feature SHA | _filled after commit_ |
| CI | _filled after push_ |
| Deployed SHA | _filled after deploy_ |

---

## 6. Production UI routes

| Route | Purpose |
|-------|---------|
| `/forex/automated-trading` | AT dashboard — draft + lifecycle UI |

---

## 7. Production acceptance (authorized Admin)

_Filled after deploy + Admin UI exercise._

Required evidence:

- Safety: Master OFF, Emergency ON, FC trading DISABLED, placesOrders/acceptsForExecution false
- Draft reopen from history + revalidatedOnLoad behavior
- Simulated open → visible position → Refresh monitor → Simulated close
- Reload preserves position id/state
- Auto re-entry remains disabled
- No broker order endpoints called

---

## 8. Safety invariants

Must remain: Master OFF · Emergency ON · FC DISABLED · `placesOrders=false` · `acceptsForExecution=false` · `EXECUTION_FORBIDDEN` · Admin-gated AT API.

---

## 9. Remaining blockers / next

| Item | Notes |
|------|-------|
| Production restart recovery | NOT_VERIFIED (no production restart authorized) |
| Confirmed strategy-invalidation exit UI | Only if evidence exists; otherwise documented limitation |
| Broker execution | Out of scope |

**Recommended next (owner only):** Phase 56.4.4 proposal — optional longer soak / monitoring polish — **not** broker execution or auto re-entry.

---

## 10. Verdict

**Interim:** implementation complete pending CI/deploy/prod UI evidence. Final verdict in STOP report.
