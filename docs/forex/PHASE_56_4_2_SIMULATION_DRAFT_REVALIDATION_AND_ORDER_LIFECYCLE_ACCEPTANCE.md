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
| Prior production frontend SHA (56.4.1 report) | `dca07592` — treated as lead only; re-verified after deploy |
| Dirty unrelated files | PMV / typography / video — **preserved, not staged** |
| Safety posture (expected / preserved) | Master OFF, Emergency ON, `placesOrders=false`, `acceptsForExecution=false`, FC trading DISABLED, `EXECUTION_FORBIDDEN` |

Historical Phase 56.4.1 claims treated as leads; Scenario 1 had not achieved `VALIDATION_PASSED` because draft validation reused aged verification quotes.

---

## 2. Root causes confirmed (Scenario 1 rejection)

| Cause | Evidence | Fix |
|-------|----------|-----|
| Draft validation used aged `lastVerification` market snapshot | 56.4.1 audit: `QUOTE_AGE_EXCEEDED` between Verify and Validate Draft | Refresh LIVE Offers via `evaluateDraftBoundaryQuote` immediately before draft assemble/validate |
| Missing SL/TP when propose blocked by stale quote | Propose levels require `quoteFresh=true` | Fresh boundary quote restores propose path (BUY=ask, SELL=bid, TP=3R) |
| Rejection reasons opaque / mis-grouped | Engine codes mixed with safety locks | `enrichDraftRejectionReasons` → stable actionable codes |
| No simulated order lifecycle beyond draft | Architecture gap for G1–G7 | Simulation-only lifecycle + store + Admin API (never broker) |
| TP could pass geometry without matching 3R | Engine checked SL/TP sides only | Hard `TP_NOT_3R` gate after tick-rounded expected 3R |

---

## 3. Files changed

| File | Reason |
|------|--------|
| `ai/forex-ai/automated-trading/simulation-risk/draft-quote-refresh.ts` | Authoritative draft-boundary quote evaluation (LIVE + freshness + bid/ask integrity) |
| `ai/forex-ai/automated-trading/simulation-risk/rejection-reasons.ts` | Stable actionable rejection codes + classification |
| `ai/forex-ai/automated-trading/simulation-risk/simulation-lifecycle.ts` | Sim-only open/monitor/exit; auto re-entry disabled |
| `ai/forex-ai/automated-trading/simulation-risk/sim-lifecycle-store.ts` | Persist sim positions (never broker IDs) |
| `ai/forex-ai/automated-trading/simulation-risk/engine.ts` | Enforce price-level `TP_NOT_3R` |
| `ai/forex-ai/automated-trading/simulation-risk/types.ts` | Phase banner 56.4.2; `quoteSnapshot` / `actionableRejections` / `revalidatedOnLoad` |
| `ai/forex-ai/automated-trading/simulation-risk/index.ts` | Export new modules + lifecycle store |
| `ai/forex-ai/automated-trading/service.ts` | Boundary refresh; reopen+revalidate; sim open/monitor |
| `dev/server/forex-automated-trading-api.ts` | Admin routes: reopen, lifecycle status/open/monitor |
| `tests/unit/ai/forex-ai/phase56-4-2-simulation-draft-revalidation.test.ts` | Targeted regressions |
| `tests/unit/ai/forex-ai/phase56-2-simulation-risk.test.ts` | Align fixtures to exact 3R TP |
| `tests/unit/ai/forex-ai/phase56-4-0-simulation-data-gates.test.ts` | Align synthetic TP to 3R |
| `docs/forex/PHASE_56_4_2_…md` | This report |

Unrelated dirty PMV/typography/video files were **not** staged.

---

## 4. Requirement coverage

### A — Quote revalidation at draft boundary

- `validateSimulationDraft` (service) calls `live.ensure` + `getLatestQuoteState` then `evaluateDraftBoundaryQuote`.
- Freshness policy: existing `MARKET_QUOTE_STALE_MS` (15s) on **genuine Bid/Ask price-change age** (not heartbeat-only).
- Rejects: missing/non-positive bid/ask, crossed ask&lt;bid, non-LIVE stream, unknown/over-limit price-change age.
- Draft records `quoteSnapshot` (id, timestamp, source, bid/ask, age, fresh, reason).

### B — Entry / SL / TP / 3R

- Propose: BUY entry=ask, SELL entry=bid; SL from analysis levels; TP = entry ± 3×R.
- Engine: BUY SL&lt;entry&lt;TP; SELL TP&lt;entry&lt;SL; **`TP_NOT_3R`** if TP ≠ tick-rounded 3R (no silent adjust).
- Min-stop: CondDist unit unknown → fail closed (`MIN_STOP_DISTANCE_UNVERIFIED`); CondDist=0 attested → no positive minimum.

### C — Capital / risk recalculation

- Existing assemble/engine path recalculates equity, strategy %, remaining budget, order allocation, quantity, margin, SL loss, 25% per-order loss limit from authoritative inputs (not stale UI numbers).
- Conversion fail-closed when required rate missing/stale (unchanged 56.4.0).

### D — Actionable rejection reasons

- Codes aliased to: `QUOTE_MISSING`, `QUOTE_STALE`, `FEED_NOT_LIVE`, `QUOTE_INVALID`, `STOP_LOSS_MISSING`, `TAKE_PROFIT_MISSING`, `TP_NOT_3R`, `MIN_STOP_DISTANCE_*`, `QUANTITY_*`, `CONVERSION_RATE_*`, `ALLOCATION_BUDGET_EXCEEDED`, `INSUFFICIENT_FREE_MARGIN`, `STOP_LOSS_RISK_LIMIT_EXCEEDED`, `ACCOUNT_EQUITY_UNVERIFIED`, `SIMULATION_ONLY_EXECUTION_LOCKED`, etc.
- Classification distinguishes safety vs market-data vs user-input vs metadata gap.
- No credentials in messages.

### E — Scenario 1 matrix (unit + intended production)

| # | Case | Unit | Production |
|---|------|------|------------|
| 1 | Fresh valid quote + valid draft | PASS (synthetic) | See §7 |
| 2 | Quote stale at validation | PASS (`QUOTE_STALE`) | RO / UI if exercised |
| 3 | Feed not LIVE | PASS (`FEED_NOT_LIVE`) | RO / UI if exercised |
| 4 | Malformed bid/ask | PASS (`QUOTE_INVALID` / `QUOTE_MISSING`) | synthetic |
| 5–7 | Missing SL / missing TP / TP≠3R | PASS | synthetic + engine |
| 8–10 | Min-stop / qty min / qty step | Covered by prior gates + aliases | unchanged fail-closed |
| 11–14 | Conversion / budget / margin / 25% SL | Prior gates + enrichment | fail-closed preserved |
| 15–16 | Master OFF / Emergency ON / EXECUTION_FORBIDDEN | Source + API invariants | Must remain ON/OFF as required |

### F — Draft persist / reopen

- Persist path unchanged (`AtSimRiskStore`).
- New `POST …/simulation-risk/reopen` re-runs full validate with current LIVE quote/budget; sets `revalidatedOnLoad=true`.
- Prior `VALIDATION_PASSED` is not authoritative after reopen without fresh gates.

### G — Simulated lifecycle (never broker)

| State | Behavior |
|-------|----------|
| Open | Only from `VALIDATION_PASSED` + fresh LIVE quote at open boundary |
| Monitor | Bid/ask mark (BUY exit=bid, SELL exit=ask); SL/TP; stale → `STALE_INTERRUPTED` (no invented fill) |
| Exit | `STOP_LOSS_HIT` / `TAKE_PROFIT_HIT` / protective early exit only with confirmed reversal evidence |
| Re-entry | **Disabled** — `SIM_REENTRY_REQUIRES_NEW_DRAFT` |
| IDs | `sim_*` only; `placesOrders=false`; never broker order IDs |

### H — Market direction / signals

- No change to structure/MTF engines this phase; entry still requires validated levels + gates (not raw BUY/SELL prediction alone).

---

## 5. Unit-test evidence (local, light)

Command (targeted; no full build / no local server):

```text
npx vitest run tests/unit/ai/forex-ai/phase56-4-2-simulation-draft-revalidation.test.ts
  (+ adjacent phase56-2 / 56.4.0 / 56.4.1 forex suites)
```

| Suite | Result |
|-------|--------|
| `phase56-4-2-simulation-draft-revalidation.test.ts` | **19 passed** (first run) |
| Adjacent suites after 3R fixture alignment | Re-run recorded in CI / final STOP |

Categories: **synthetic unit only** — not production proof.

---

## 6. CI / deploy / production verification

| Check | Status | Notes |
|-------|--------|-------|
| Commit SHA (final) | _filled after commit_ | Forex-scoped commit only |
| CI | _filled after push_ | Must pass before claiming deploy |
| Deployed `/api/deployment` SHA | _filled after deploy_ | Must match intended commit |
| Production URL version | _filled after deploy_ | |
| Live quote RO | _filled after RO checks_ | Do not induce disconnect |
| Master Trading | Must be **OFF** | UNVERIFIED until read |
| Emergency Entry Lock | Must be **ON** | UNVERIFIED until read |
| ForexConnect trading | Must be **DISABLED** | UNVERIFIED until read |
| `placesOrders` / `acceptsForExecution` | Must be **false** | Source + API |
| `EXECUTION_FORBIDDEN` | Must remain | AT API |

---

## 7. Scenario 1 production outcome

_Filled after authorized Admin UI / API exercise post-deploy. Until then: **UNVERIFIED** for production `VALIDATION_PASSED`._

Required for PASS claim:

- Fresh LIVE Offers for XAU/USD at draft boundary
- Valid entry/SL/TP @ 3R from verified quote convention
- Budget / quantity / margin / conversion / 25% SL gates pass
- Draft audit shows `VALIDATION_PASSED` without unlocking execution

---

## 8. Safety invariant evidence

| Invariant | Source / API |
|-----------|----------------|
| `masterTradingEnabled = false` | AT controls (must re-read prod) |
| `emergencyEntryLock = true` | AT controls (must re-read prod) |
| `placesOrders = false` | Draft + lifecycle + API responses |
| `acceptsForExecution = false` | Draft + lifecycle + API responses |
| `EXECUTION_FORBIDDEN` | AT API handlers |
| FC trading DISABLED | Bridge status (must re-read prod) |
| No broker order APIs added | Lifecycle uses sim store only |

---

## 9. Remaining blockers / next phase

| Blocker | Cause | Evidence needed |
|---------|-------|-----------------|
| Production Scenario 1 `VALIDATION_PASSED` | Depends on LIVE Offers + Admin UI after deploy | Post-deploy Admin draft validate audit |
| Broker execution readiness | Explicitly out of scope | Separate authorized phase with demo acceptance, emergency-stop, duplicate protection, reconciliation, rollback |
| Auto re-entry strategy | Intentionally disabled | Owner decision + confirmed structure rules |

**Recommended next:** Phase 56.4.3 (proposal only) — production Scenario 1 soak + optional sim lifecycle UI — **not** broker submission.

---

## 10. Verdict

**Interim:** `PASS_WITH_KNOWN_BLOCKERS` until production Scenario 1 + safety RO are evidenced post-deploy.

Final verdict updated in STOP report after CI/deploy/prod checks.
