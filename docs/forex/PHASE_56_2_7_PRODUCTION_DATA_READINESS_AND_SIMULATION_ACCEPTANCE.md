# Phase 56.2.7 — Production Data Readiness & End-to-End Simulation Acceptance

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** Production data-readiness audit + simulation acceptance record  
**Starting HEAD:** `436293a385e88f41fb99c9d4c0687c993f3aaa7d`  
**Production baseline at start:** `deployedCommit=436293a3…`, `verifiedLive=true`, health `healthy`  
**Prior references:** 56.2.6 feature `1a7ce3b3…`; finalize `8e68d14e…`  
**Ending HEAD (feature):** `0441241d7ff8c282782e488269f617f5b6e7b05e`  
**Ending HEAD / deployed:** _(docs finalize SHA filled after verifiedLive)_  
**Scope:** Read-only broker + simulation-only. **No execution. LIVE unauthorized. Do not start 56.2.8 / 56.3.**

---

## 1. Repository & production baseline (inspected)

| Item | Value |
|------|-------|
| Branch | `main` |
| Starting SHA | `436293a385e88f41fb99c9d4c0687c993f3aaa7d` |
| Worktree | Unrelated dirty: PMV / typography / video (preserved) |
| Production `/api/deployment` | `deployedCommit=436293a3…`, `verifiedLive=true`, `result=success` |
| Production `/api/health` | `ok=true`, `status=healthy` |
| Public AT URL | `http://162.35.114.19:5173/forex/automated-trading` |
| AT API auth | All `/api/forex/automated-trading/*` require Forex admin (`requireForexAdmin`) |

---

## 2. Implementation (this phase)

| Path | Role |
|------|------|
| `simulation-risk/simulation-data-readiness.ts` | Deterministic gate matrix (`READY` / `PARTIALLY_READY` / `BLOCKED` / `STALE` / `UNVERIFIED` / `UNAVAILABLE`) |
| `service.ts` `buildStatus` | Emits `simulationDataReadiness` public summary |
| `ForexAutomatedTradingPage.tsx` | Shows **Data Readiness** cell on Simulation Draft grid |
| `tests/unit/ai/forex-ai/phase56-2-7-simulation-data-readiness.test.ts` | Synthetic acceptance scenarios |

Gates covered: environment, market quote, account identity, account currency, equity, free margin, quantity constraints, min-stop/CondDist, currency conversion, Orders/Trades exposure, execution locks.

A connected session alone never yields `readyForSimulationDraft=true`. `placesOrders` / `acceptsForExecution` remain **false** on every result.

---

## 3. Data-readiness matrix (architecture)

| Dependency | Source / endpoint | Scope | Authoritative when | Blocks when missing |
|------------|-------------------|-------|--------------------|---------------------|
| XAU/USD quote | ForexConnect Offers + freshness eval | DEMO/LIVE | `quoteFresh` + finite bid/ask + feed LIVE | Entry, qty, monetary SL |
| Account identity | verify-account / accounts RO | DEMO/LIVE | `ACCOUNT_VERIFIED` | Budget, margin, sizing |
| Account currency | Account snapshot | DEMO/LIVE | Non-empty currency (never assume USD) | Monetary risk / FX path |
| Equity | Account snapshot | DEMO/LIVE | Finite positive + fresh | Strategy budget |
| Free margin | `usableMargin` | DEMO/LIVE | Finite ≥ 0 (not invented zero) | Margin eligibility |
| Quantity min/step | TradingSettings + Phase 56.2.5 constraints | DEMO | Contracts + verified min/step | Proposed quantity |
| CondDist / min-stop | TradingSettings CondDist pips × PointSize | DEMO | Unit=pips attested | Min-stop geometry / VALIDATION_PASSED |
| Currency conversion | `ConversionRateSnapshot` (56.2.6) | Non-USD | Fresh rate + direction + source | Monetary risk if ccy ≠ USD |
| Exposure | ORDERS + TRADES RO reconcile | DEMO/LIVE | `authoritative=true` (empty ≠ failed) | Remaining budget / sizing |

---

## 4. Acceptance scenarios

| # | Scenario | Result | Evidence type |
|---|----------|--------|---------------|
| 1 | Valid input + complete verified data | **BLOCKED in production interactive** (no admin session in this run). **PASS (synthetic unit)** when all gates READY | Unit fixture labeled synthetic |
| 2 | Missing/stale quote | **PASS (unit)** — gate `STALE`/`UNAVAILABLE`, draft sizing blocked | Synthetic |
| 3 | Missing account/margin | **PASS (unit)** — equity/margin `UNAVAILABLE` | Synthetic |
| 4 | Unverified quantity constraints | **PASS (unit)** — `UNVERIFIED` | Synthetic |
| 5 | Missing currency conversion | **PASS (unit)** — non-USD `BLOCKED` | Synthetic |
| 6 | Incomplete Orders/Trades | **PASS (unit)** — not treated as zero | Synthetic |
| 7 | Invalid allocation | **PASS (unit)** — reject empty/neg/NaN/0 | Synthetic |
| 8 | 25% ceiling + 3R | **PASS (unit)** with verified contract fixture | Synthetic |
| 9 | Persistence / refresh | Covered by prior 56.2 store tests; no new broker mutation | Prior + code review |
| 10 | Execution safety | **PASS (unit + source)** — locks closed; API `EXECUTION_FORBIDDEN` | Synthetic + source |

**Production interactive E2E:** **BLOCKED** — `GET /api/forex/automated-trading/status` returns admin auth required without a session token. Token was **not** supplied or stored in this phase (safety). Shell UI shows execution banner + admin gate.

---

## 5. Tests

| Suite | Result | Notes |
|-------|--------|-------|
| `tests/unit/ai/forex-ai/phase56-2-7-simulation-data-readiness.test.ts` | **12/12 passed** | Local vitest; synthetic fixtures only |
| CI job `Validate before deploy` (run #393) | **success** | Includes deployment/studio tests + production build |

---

## 6. Safety locks

| Lock | Required | Observed (code + unit + public probe) |
|------|----------|----------------------------------------|
| `masterTradingEnabled` / masterEnable | `false` | Enforced in readiness + controls |
| `emergencyEntryLock` | `true` | Enforced |
| `placesOrders` | `false` | Always on status / readiness / draft |
| `acceptsForExecution` | `false` | Always |
| ForexConnect trading | DISABLED | Unchanged |
| LIVE | unauthorized | Status forces module BLOCKED for LIVE |
| Broker mutations this phase | none | Only health/deployment/unauth AT status |

Public unauthenticated probe: `GET /api/forex/automated-trading/status` → **403** `ADMIN_FORBIDDEN` (expected; no token used).

---

## 7. Remaining blockers

1. **Authorized admin session** required for live status probe + interactive draft validation on production.  
2. Non-USD production FX rate feed still not wired (56.2.6).  
3. LIVE CondDist / Enhanced Execution attestation still UNVERIFIED.  
4. Interactive responsive 390/768/1024/1440 draft exercise deferred without admin token (source CSS grid preserved from 56.2.4).  
5. First CI deploy attempt for `0441241d` failed on VPS **deploy lock contention** (see §8); redeploy triggered via this docs finalize commit.

---

## 8. CI/CD / production verification

| Item | Evidence |
|------|----------|
| Feature commit | `0441241d7ff8c282782e488269f617f5b6e7b05e` pushed to `main` |
| Production deploy run #393 | https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39584663186 — Validate **success**; Deploy exact commit **failure** |
| Deploy failure cause | Commit comment excerpt: SSH OK; checkout reached `0441241d`; re-exec hit `another deployment holds /var/lock/kwizera-ai-deploy.lock` (holders: two `update-from-github.sh` for same SHA) |
| Post-failure `/api/deployment` (poll ~8 min) | `requestedCommit=0441241d…`, `deployedCommit=0441241d…`, `status=deploying`, `result=in-progress`, `verifiedLive=false`, timestamp stuck at `2026-10-21T10:27:53.579Z` |
| `/api/health` during stuck window | `ok=true`, `status=healthy` (prior session still serving) |
| Public AT URL | `http://162.35.114.19:5173/forex/automated-trading` |
| Docs finalize / redeploy | This commit re-triggers Production deploy after lock contention |

**Verdict (pre-finalize):** feature on `main`; unit gates **PASS**; production interactive E2E **BLOCKED** (no admin token); deploy **not yet verifiedLive** for `0441241d` after lock contention — awaiting redeploy success.

*End of Phase 56.2.7 record (updated after verifiedLive if redeploy succeeds).*
