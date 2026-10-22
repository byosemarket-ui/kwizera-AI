# Phase 56.4.2 — Simulation Draft Revalidation, Scenario 1 Acceptance & Automated Order-Lifecycle Readiness

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading (simulation / verification only)  
**Phase:** 56.4.2  
**This phase does not authorize broker order submission, DEMO execution, or LIVE trading.**

---

## 1. Baseline (verified before edit)

| Item | Observed |
|------|----------|
| Local HEAD (start) | `591edb41` (Phase 56.4.1 docs) |
| Prior production frontend SHA (56.4.1 report) | `dca07592` — lead only |
| Dirty unrelated files | PMV / typography / video — **preserved, not staged** |
| Safety posture | Master OFF, Emergency ON, `placesOrders=false`, `acceptsForExecution=false`, FC trading DISABLED, `EXECUTION_FORBIDDEN` |

---

## 2. Root causes confirmed (Scenario 1 rejection)

| Cause | Evidence | Fix |
|-------|----------|-----|
| Draft validation reused aged `lastVerification` market snapshot | 56.4.1: `QUOTE_AGE_EXCEEDED` between Verify and Validate Draft | Refresh LIVE Offers via `evaluateDraftBoundaryQuote` at draft boundary |
| Missing SL/TP when propose blocked by stale quote | Propose requires `quoteFresh=true` | Fresh boundary quote restores propose (BUY=ask / SELL=bid, TP=3R) |
| Opaque rejection grouping | Mixed engine + safety codes | `enrichDraftRejectionReasons` |
| No sim order lifecycle beyond draft | Architecture gap G1–G7 | Simulation-only lifecycle + store + Admin API |
| TP could pass geometry without matching 3R | Side geometry only | Hard `TP_NOT_3R` after tick-rounded expected 3R |
| Ambiguous quantity unit still accepted requested qty | Fail-open on unit | Null proposed quantity when unit ambiguous |

---

## 3. Files changed

| File | Reason |
|------|--------|
| `simulation-risk/draft-quote-refresh.ts` | Draft-boundary LIVE quote evaluation |
| `simulation-risk/rejection-reasons.ts` | Actionable rejection codes |
| `simulation-risk/simulation-lifecycle.ts` | Sim open/monitor/exit; auto re-entry disabled |
| `simulation-risk/sim-lifecycle-store.ts` | Persist sim positions (never broker IDs) |
| `simulation-risk/engine.ts` | `TP_NOT_3R`; block qty when unit ambiguous |
| `simulation-risk/types.ts` | Phase 56.4.2 fields |
| `simulation-risk/index.ts` | Exports |
| `service.ts` | Boundary refresh; reopen; sim open/monitor |
| `forex-automated-trading-api.ts` | Admin reopen + lifecycle routes |
| `phase56-4-2-*.test.ts` + fixture alignments | Regressions |
| This document | Evidence |

Unrelated PMV/typography/video files were **not** staged.

---

## 4. Unit-test evidence (local, light)

```text
npx vitest run tests/unit/ai/forex-ai/phase56-4-2-simulation-draft-revalidation.test.ts
  + phase56-2-simulation-risk / phase56-2-2 / phase56-4-0 / phase56-4-1
→ 5 files, 89 passed
```

Categories: **synthetic unit only**.

---

## 5. CI / deploy

| Check | Result |
|-------|--------|
| Feature commit | `8951ef01` |
| CI | [Production deploy #39795630263](https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39795630263) — **success** |
| Production `/api/deployment` | `deployedCommit=8951ef01…`, `verifiedLive=true`, `result=success`, `status=live` |
| Production URL | `http://162.35.114.19:5173` |

---

## 6. Production read-only + Admin UI (authorized session)

### Safety (observed)

| Invariant | Evidence |
|-----------|----------|
| Master Trading OFF | AT UI checkbox `Master enable OFF` (readonly) |
| Emergency Entry Lock ON | AT UI checkbox checked `Emergency entry lock ON` |
| ForexConnect trading DISABLED | `GET …/forexconnect/status` → `trading:"DISABLED"`, `environment:"demo"`, `status:"CONNECTED"` |
| `placesOrders=false` / `acceptsForExecution=false` | Draft panel + API responses |
| `EXECUTION_FORBIDDEN` / Admin gate | AT API without token → `403 ADMIN_FORBIDDEN` |
| No broker order submission | Lifecycle is sim-only; subscribe returns `placesOrders:false` |

### Quote / subscribe

| Step | Result |
|------|--------|
| `POST …/subscribe` `{symbol:XAU/USD,timeframe:1m}` | `ok=true`, `streamState=LIVE`, `intendedRegistered=true` |
| FC `subscriptionCount` | `1` after subscribe |

### Scenario 1 — VALIDATION_PASSED (production UI)

Workflow: Admin session → Verify (Market data PASS) → Strategy allocation % = 10 → Save → Validate draft.

| Field | Observed |
|-------|----------|
| Validation status | **`VALIDATION_PASSED`** |
| Direction | SELL |
| Entry | 4054.83 (bid-side executable convention) |
| Stop Loss | 4056.32 (above entry) |
| Take Profit (3R) | 4050.36 |
| Order allocation | 100.00 USD |
| Proposed quantity | 16 contracts |
| Required margin | 76.64 |
| Free margin | 19997.65 |
| Estimated SL loss | 23.84 |
| Max allowed SL loss | 25.00 (25% of order allocation) |
| Remaining strategy budget | 1899.77 |
| Min-stop | CondDistStop=0 pips — no positive minimum attested |
| Currency | USD identity |
| Audit | `14:36:13Z simulation_draft_validated · DEMO` (no REJECTED_LOCAL) |
| Safety on draft | `simulationOnly=true · placesOrders=false · acceptsForExecution=false` |

Note: UI Data Readiness may still show a transient STALE gate while Offers price-change age fluctuates; draft-boundary refresh is authoritative for this pass.

### Draft persist / reopen

- Persist: confirmed via audit + draft panel after validate.
- Reopen API: `POST …/simulation-risk/reopen` shipped (Admin); dedicated reopen UI click **not** separately exercised this run → partially verified via code + prior persist path.

### Simulated lifecycle (production)

- Unit: open → monitor → TP/SL/stale interrupt → re-entry disabled — **passed**.
- Production Admin lifecycle open/monitor: APIs shipped; **not** exercised end-to-end in UI this run (no sim-open control on page yet).

---

## 7. Requirement summary

| Req | Status |
|-----|--------|
| A Quote revalidation at boundary | **PASS** (code + prod VALIDATION_PASSED) |
| B Entry/SL/TP + 3R | **PASS** (prod SELL levels; engine `TP_NOT_3R`) |
| C Capital/risk recalc | **PASS** (prod numbers above) |
| D Actionable rejections | **PASS** (unit + enrichment) |
| E Scenario 1 acceptance | **PASS** (`VALIDATION_PASSED` on prod UI) |
| F Persist/reopen | **PASS_WITH_KNOWN_BLOCKERS** (persist yes; reopen API only) |
| G Sim lifecycle | **PASS_WITH_KNOWN_BLOCKERS** (unit + APIs; no prod UI open) |
| H Signal quality | Unchanged; no invented reversal rules |
| Safety locks | **PASS** (not weakened for Scenario 1) |

---

## 8. Remaining blockers / next phase

| Item | Notes |
|------|-------|
| Sim lifecycle UI surface | APIs ready; UI affordance for open/monitor optional follow-up |
| Auto re-entry | Intentionally disabled — owner decision required |
| Broker execution | **Out of scope** — separate authorized phase |

**Recommended next (owner decision only):** Phase 56.4.3 proposal — sim lifecycle UI + soak of VALIDATION_PASSED under continuous LIVE Offers — **not** broker submission.

---

## 9. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`**

Blockers are limited to incomplete production exercise of reopen UI and sim lifecycle open/monitor UI — not safety regressions and not Scenario 1 validation failure.
