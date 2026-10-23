# Phase 57.1 — Automated Trading Master Switch (START/STOP), Server-Side Persistence & Safe Lifecycle Control

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Phase:** 57.1  

**Final verdict:** `PASS_WITH_KNOWN_BLOCKERS`

> Broker execution remains **DISABLED**. START AUTO enables **market monitoring / analysis scheduling** only.

---

## 1. SHAs

| Item | SHA |
|------|-----|
| Baseline HEAD | `3259dc71` (Phase 57.0 docs) |
| Feature commit | `01cee1e258a36a84a59fa014298507222c777da4` |
| Documentation | _(this document)_ |
| Deployed | `01cee1e2…` (`verifiedLive=true`, `result=success`, `2026-10-23T08:26:11.917Z`) |

---

## 2. Design decision

**Do not reuse `masterEnable` for START/STOP.** Flipping `masterEnable=true` breaks Phase 57.0 preflight / sim readiness locks and is semantically “broker Master Trading.”

Instead: dedicated durable control at  
`{storage}/forex-automated-trading/automation-control.json`.

| Field | Role |
|-------|------|
| `requestedMode` | ON / OFF (operator request) |
| `lifecycle` | OFF → STARTING → MONITORING \| BLOCKED; STOPPING → OFF; ERROR |
| `stateVersion` | Compare-and-set / stale UI detection |
| `entryGenerationEnabled` | Always `false` |
| `brokerExecution` | Always `DISABLED` |
| `placesOrders` / `acceptsForExecution` | Always `false` |

UI separates:

- Automation requested: ON/OFF  
- Market monitoring: ACTIVE / …  
- Broker execution: **DISABLED**  
- Execution readiness: **BLOCKED**

---

## 3. START / STOP semantics

### START AUTO
1. Admin-authorized POST `/api/forex/automated-trading/automation/start`
2. CAS → `STARTING`, persist request
3. Readiness: masterEnable must be **false**, emergency lock **ON**, instrument configured, quotes not explicitly stale, FC trading / auto entry off
4. Calls existing `startMonitoring` (server worker)
5. Success → `MONITORING` (not broker LIVE)
6. Failure → `BLOCKED` with reason
7. Idempotent if already MONITORING+ON

### STOP AUTO
1. Admin POST `…/automation/stop`
2. CAS → `STOPPING` then `stopMonitoring` then `OFF`
3. Idempotent if already OFF
4. Never cancels/closes broker orders (none authorized)
5. Stale version still fail-closes toward OFF

### Process restart
`recoverAutomationControlOnBoot`: if was MONITORING/STARTING/desired ON → **BLOCKED** with `AMBIGUOUS_RECOVERY` (must re-START). Never silently resumes entry generation. Monitor worker still uses its own `resumeFromPersistence` for enabled monitor config — automation control remains the operator-facing mode of record and will show BLOCKED until START is confirmed again after restart.

---

## 4. Files changed

| Path | Purpose |
|------|---------|
| `automation-control/*` | Types, store, readiness |
| `service.ts` | start/stop/recover + status |
| `forex-automated-trading-api.ts` | Admin routes |
| `ForexAutomatedTradingPage.tsx` | START AUTO / STOP AUTO + status |
| `phase57-1-*.test.ts` | Focused tests |
| This document | Evidence |

---

## 5. Tests

```text
node ./node_modules/vitest/vitest.mjs run tests/unit/ai/forex-ai/phase57-1-automation-master-switch.test.ts --no-file-parallelism
→ 8 passed (8), exit 0
```

---

## 6. Safety invariants (unchanged)

```text
masterEnable = false (required for START readiness)
emergencyEntryLock = true
placesOrders = false
acceptsForExecution = false
EXECUTION_FORBIDDEN
ForexConnect trading = DISABLED
automatic broker entry/re-entry = DISABLED
LIVE broker execution = UNAUTHORIZED
```

### Production Admin verification (post-deploy)

| Check | Result |
|-------|--------|
| Safety | Master OFF, Emergency ON, auto entry DISABLED, placesOrders=false, module BLOCKED, EXECUTION_FORBIDDEN 403 |
| STOP when OFF | `ALREADY_OFF` (idempotent) |
| START AUTO | `MONITORING` · marketMonitoring=ACTIVE · brokerExecution=DISABLED · executionReadiness=BLOCKED · placesOrders=false |
| START again | `ALREADY_MONITORING` (idempotent) |
| STOP AUTO | `OFF` |
| STOP again | `ALREADY_OFF` (idempotent) |

---

## 7. Known blockers

- Broker DEMO/LIVE execution still out of scope (Phase 57.0+).
- Browser-independent monitoring depends on the existing server `AtMonitorWorker` (verified when deploy process keeps Node gateway up). Automation control itself is server-persisted.
- After process restart, automation control fails closed to BLOCKED until operator re-STARTs (intentional).

---

## 8. STOP

Phase 57.1 complete. Broker execution remains disabled.
