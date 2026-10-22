# Phase 56.4.7 — Simulation Operations Certification & Authorized Restart Recovery

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading (simulation / verification only)  
**Phase:** 56.4.7  
**This phase does not authorize broker order submission, DEMO broker execution, or LIVE trading.**

**Final verdict:** `PASS_WITH_KNOWN_BLOCKERS`

---

## 1. Objective and scope

Certify persistence and **fail-closed** recovery of simulation operations across an **authorized** gateway process restart (deploy-driven `systemctl restart kwizera-ai`), without enabling broker execution, automatic entry, or automatic re-entry.

Out of scope: broker DEMO/LIVE orders, modify/cancel/close, broker-side SL/TP, Master ON, emergency lock OFF, auto re-entry.

---

## 2. SHAs

| Item | SHA |
|------|-----|
| Phase 56.4.6 documentation baseline | `d2682c95` |
| Phase 56.4.6 feature | `af2d1765` |
| Feature commit (this phase) | `0b7276d7132abaa71fc2a26373597a25c48bd650` |
| Documentation commit | _(this document)_ |
| Deployed production (feature verified) | `0b7276d7…` (`verifiedLive=true`, `result=success`, timestamp `2026-10-22T22:50:31.688Z`) |

Production URL: `http://162.35.114.19:5173`  
Route: `/forex/automated-trading`

---

## 3. Architecture and persistence findings

| Resource | Persistence | Restart behavior (before this phase) |
|----------|-------------|--------------------------------------|
| Simulation drafts | `{storage}/forex-automated-trading/simulation-drafts.json` | Hydrated on store construct |
| Sim positions | `…/simulation-positions.json` | Hydrated on construct; **no** resume policy |
| AT audit | `…/settings.json` audit[] | Persists (cap 200) |
| FC subscription intent | `{storage}/forexconnect/intended-subscriptions.json` | Hydrate + restore after connect (56.3.4) |
| AT monitor worker | `monitoring.json` | `resumeFromPersistence` on service boot |

**Gap closed:** open/monitoring sim positions survived disk but were not fail-closed after process death; pre-restart in-memory quotes could not be trusted. This phase adds idempotent `recoverSimLifecycleFromPersistence` on AT service bootstrap.

**Authorized restart mechanism:** `deploy/update-from-github.sh` → `systemctl restart kwizera-ai` (and optional FC sidecar). Blast radius: Node gateway process (+ optional sidecar). Disk stores retained. **Not** used: improvised SSH-only restarts outside deploy; soft “restart-registered-service” health path (does not kill gateway).

---

## 4. Recovery contract (implemented)

| Domain | Contract |
|--------|----------|
| Drafts | Unchanged by recovery (separate store); IDs stable |
| Open/MONITORING/EXIT_TRIGGERED | → `STALE_INTERRUPTED` with `PROCESS_RESTART_RECOVERY…`; no fill invented |
| SIMULATED_CLOSED | Unchanged; cannot reopen |
| EXIT_TRIGGERED ambiguous | Fail closed to `STALE_INTERRUPTED` (do not invent close without durable close audit) |
| Audit | One `simulation_lifecycle_recovered` / `PROCESS_RESTART_RECOVERY` when `changedCount>0`; no duplicate positions |
| Quotes | Pre-restart quotes invalidated for exits; monitor resumes only on fresh LIVE (or Admin controlled sim inject) |
| Broker | Never touched |

---

## 5. Files changed

| File | Reason |
|------|--------|
| `simulation-lifecycle.ts` | `recoverSimPosition(s)AfterProcessRestart`, recovery note constant |
| `service.ts` | `recoverSimLifecycleFromPersistence`; bootstrap call after monitor resume |
| `forex-automated-trading-api.ts` | Admin `POST …/simulation-lifecycle/recover` |
| `phase56-4-7-simulation-restart-recovery.test.ts` | Synthetic restart + freshness + wiring |
| This document | Evidence |

Unrelated PMV/typography/video dirty files were **not** staged.

---

## 6. Tests

```text
node ./node_modules/vitest/vitest.mjs run tests/unit/ai/forex-ai/phase56-4-7-simulation-restart-recovery.test.ts --no-file-parallelism
→ 8 passed (8), exit 0
```

Coverage: MONITORING→STALE without fill; closed unchanged; ambiguous EXIT blocked; batch idempotent; durable store new-instance load; stale quote cannot close post-recovery; fresh mid-quote resumes MONITORING; SL once; closed survives second synthetic restart; no duplicate rows; wiring/safety asserts.

**Synthetic restart ≠ sole production proof** — production evidence in §8.

---

## 7. Safety invariants (before and after deploy restart)

| Check | Pre-restart | Post-restart |
|-------|-------------|--------------|
| `masterEnable` | false | false |
| `emergencyEntryLock` | true | true |
| `automaticEntry` | DISABLED | DISABLED |
| `placesOrders` | false | false |
| `readyForTrading` | false | false |
| Module | BLOCKED | BLOCKED |
| FC trading DISABLED | true | true |
| `EXECUTION_FORBIDDEN` | 403 | 403 |
| Broker open positions | 0 | 0 |

---

## 8. Authorized production restart evidence

**Method:** Push feature `0b7276d7` → established GitHub→VPS deploy → gateway restart (authorized path).

### Pre-restart checkpoint

| Item | Value |
|------|-------|
| Deployed SHA | `d2682c95…` |
| Open sim | `sim_mvk4mc7y_kkvn7i` state=`MONITORING` entry=`4031.87` SL=`4023.93` |
| Closed count | 5 |

### Post-restart

| Check | Result |
|-------|--------|
| Deployed SHA | `0b7276d7…` `verifiedLive=true` |
| Same position ID | **yes** `sim_mvk4mc7y_kkvn7i` |
| State | `STALE_INTERRUPTED` |
| Transition note | `PROCESS_RESTART_RECOVERY: awaiting fresh LIVE quote (pre-restart quote invalidated).` |
| Exit fabricated? | **No** (`exitReason=null`, `exitPrice=null`) |
| Entry/SL preserved | **yes** |
| Closed remain closed | **yes** (5) |
| Recovery audit | `simulation_lifecycle_recovered` / `PROCESS_RESTART_RECOVERY` |
| Recover API twice | `changedCount=0` both (idempotent) |
| Natural monitor after verify | Remained interrupted (`MARKET_INACTIVE` at sample) — fail-closed |
| Controlled `sl_approach` (sim-only) | Resumed `MONITORING` without exit — proves post-recovery resume path |

**Production restart recovery status:** `VERIFIED`

---

## 9. CI / deployment

| Step | Result |
|------|--------|
| Feature push | `d2682c95..0b7276d7` |
| `/api/deployment` | `deployedCommit=0b7276d7…`, `verifiedLive=true`, `result=success` |

---

## 10. Known blockers / limitations

- Broker DEMO/LIVE execution remains **NO-GO / BLOCKED** (by design).
- Natural LIVE quote resume after restart depends on market session; at verification sample feed reported `MARKET_INACTIVE` — monitoring correctly stayed interrupted until a fresh valid quote (or Admin sim inject).
- FC intended-subscription store root can diverge from AT `resolveStorageRoot()` if env unset (pre-existing; not changed this phase).
- Multi-hour soak not required for this phase.

---

## 11. Rollback considerations

Revert feature commit `0b7276d7` (or redeploy prior SHA). Positions already marked `STALE_INTERRUPTED` remain safe; no broker state was mutated. Recovery is additive fail-closed behavior.

---

## 12. Recommended next phase

**Do not** start broker execution from this certification alone. Optional next simulation ops: multi-hour soak / natural SL observation. Broker DEMO requires a **separate owner-authorized** execution-implementation phase.

---

## 13. STOP

Phase 56.4.7 complete. Safety locks retained. No broker-execution phase started.
