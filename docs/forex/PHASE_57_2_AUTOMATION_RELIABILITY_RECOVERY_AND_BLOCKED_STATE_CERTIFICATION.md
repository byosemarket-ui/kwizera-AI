# Phase 57.2 — Automation Reliability, Recovery & BLOCKED-State Certification

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Phase:** 57.2  

**Final verdict:** `PASS_WITH_KNOWN_BLOCKERS`

> Broker execution remains **DISABLED**. Soft-resume after restart may restore **market monitoring** only when readiness revalidation passes. `EXECUTION_FORBIDDEN` is never cleared by START or recovery.

---

## 1. SHAs

| Item | SHA |
|------|-----|
| Baseline HEAD (Phase 57.1 docs) | `6c4349c8` |
| Phase 57.1 feature | `01cee1e2` |
| Phase 57.2 feature | `1bf862c5` (`1bf862c53101907b6b13e57025a526c6edd789d9`) |
| Documentation | _(this document)_ |
| Deployed production | `1bf862c5…` (`verifiedLive=true`, `result=success`, status `live`) |

---

## 2. Root cause of displayed `BLOCKED`

### Monitoring `automation.lifecycle = BLOCKED` (operator-facing)

| Cause | Evidence | Classification |
|-------|----------|----------------|
| **Process restart always forced `AMBIGUOUS_RECOVERY`** | Phase 57.1 `recoverAutomationControlOnBoot` set `lifecycle: BLOCKED` / `reasonCode: AMBIGUOUS_RECOVERY` whenever prior state was MONITORING/STARTING/desired ON — even when readiness could pass | **Primary defect repaired in 57.2** |
| Split-brain with monitor worker | Monitor `resumeFromPersistence` could leave worker enabled while automation control showed BLOCKED | **Repaired:** boot decision sets `stopMonitorWorker` when blocking; soft-resume starts monitor if needed |
| START readiness failures | `evaluateAutomationStartReadiness` → concrete codes (`QUOTE_NOT_FRESH`, `INSTRUMENT_NOT_CONFIGURED`, safety codes) | Expected fail-closed (unchanged) |
| Monitor start failure | `MONITOR_START_FAILED` | Expected fail-closed (unchanged) |

### Module / execution `BLOCKED` (not monitoring)

| Field | Meaning |
|-------|---------|
| `moduleStatus: BLOCKED` | Execution-readiness / safety posture (Master OFF, emergency lock, no broker submit) |
| `executionReadiness: BLOCKED` | Always blocked in this product phase |
| `executionStatusLabel: EXECUTION_FORBIDDEN` | Explicit broker execution prohibition |
| `brokerExecution: DISABLED` | No order mutation path |

UI previously showed a single lifecycle badge that looked like “Automated Trading is BLOCKED” when monitoring recovery failed, while execution BLOCKED is intentional and permanent for Phase 57.x. Phase 57.2 labels **Monitoring:** vs **EXECUTION_FORBIDDEN** separately and surfaces `reasonCode` + `recoveryStatus`.

---

## 3. Monitoring readiness vs execution readiness

Authoritative separation (existing types + Phase 57.2 fields):

| Concern | Field(s) | Allowed healthy value in 57.2 |
|---------|----------|-------------------------------|
| Operator request | `requestedMode` | ON / OFF |
| Monitoring lifecycle | `lifecycle` / `marketMonitoring` | MONITORING / ACTIVE when readiness ok |
| Recovery | `recoveryStatus` | RECOVERED / IDLE / RECOVERY_BLOCKED / … |
| Broker execution | `brokerExecution`, `executionStatusLabel` | DISABLED / EXECUTION_FORBIDDEN only |
| Execution readiness | `executionReadiness` | BLOCKED only |
| Entry / orders | `entryGenerationEnabled`, `placesOrders`, `acceptsForExecution` | always `false` |

Example of a **valid** post-recovery status (when evidence supports it):

```text
automationRequestedMode = ON
monitoringStatus = MONITORING (marketMonitoring=ACTIVE)
recoveryStatus = RECOVERED
executionStatus = EXECUTION_FORBIDDEN
executionReadiness = BLOCKED
brokerExecution = DISABLED
placesOrders = false
```

---

## 4. State-machine / recovery changes

New pure decision: `decideAutomationBootRecovery` (`automation-control/boot-recovery.ts`).

| Prior persisted | Readiness | Action |
|-----------------|-----------|--------|
| STOPPING | any | FORCE_OFF_FROM_STOPPING → OFF; stop monitor |
| OFF | any | KEEP_OFF |
| MONITORING / STARTING / ON+desired / ON+BLOCKED | `ok: true` | **SOFT_RESUME_MONITORING** → MONITORING + `RECOVERY_SOFT_RESUMED` |
| same | `ok: false` / null | BLOCK_AND_ALIGN_MONITOR_STOP → BLOCKED + concrete reason; **stop monitor** |

`recoverAutomationControlOnBoot` applies the decision: never enables entry generation or broker flags; soft-resume calls `startMonitoring` when worker not enabled.

START/STOP remain CAS/`stateVersion`-based and idempotent; STOP still does not cancel broker orders.

---

## 5. Files changed

| Path | Reason |
|------|--------|
| `automation-control/boot-recovery.ts` | Pure recovery decision |
| `automation-control/types.ts` | `recoveryStatus`, soft-resume reason codes, `executionStatusLabel` |
| `automation-control/store.ts` | Normalize `recoveryStatus`; keep execution flags false |
| `automation-control/index.ts` | Export boot-recovery |
| `service.ts` | Wire soft-resume / align worker; recoveryStatus on START/STOP |
| `ForexAutomatedTradingPage.tsx` | Separate monitoring vs execution badges; show reason code + recovery |
| `phase57-2-*.test.ts` | Reliability / recovery / safety tests |
| This document | Certification evidence |

---

## 6. Tests

```text
node ./node_modules/vitest/vitest.mjs run \
  tests/unit/ai/forex-ai/phase57-2-automation-reliability-recovery.test.ts \
  tests/unit/ai/forex-ai/phase57-1-automation-master-switch.test.ts \
  --no-file-parallelism

→ Test Files  2 passed (2)
→ Tests  22 passed (22)
→ exit_code: 0
```

Coverage includes: soft-resume vs fail-closed, QUOTE_NOT_FRESH block, STOPPING→OFF, public status execution separation, CAS stale reject, placesOrders coercion, UI wiring markers.

---

## 7. Production evidence

**Method:** Authorized Admin session on `http://162.35.114.19:5173` (header `x-kwizera-admin-token` from session). Deploy path restarted the gateway (authorized). No broker orders submitted.

| Check | Result |
|-------|--------|
| Deployed SHA | `1bf862c53101907b6b13e57025a526c6edd789d9` · `verifiedLive=true` · `result=success` |
| Pre-fix automation | `lifecycle=OFF` · `requestedMode=OFF` · `recoveryStatus=IDLE` · `executionStatusLabel=EXECUTION_FORBIDDEN` · `stateVersion≈10` |
| Post-deploy recovery | Persisted state was OFF → remained OFF (KEEP_OFF). Soft-resume path **not exercised live** this cycle (no prior MONITORING + fresh quotes at restart). Soft-resume covered by unit tests. |
| Quote freshness | `fresh=false` · `QUOTE_AGE_EXCEEDED` |
| STOP when OFF | `ALREADY_OFF` (idempotent) |
| START AUTO | `ok=false` · `code=QUOTE_NOT_FRESH` · `lifecycle=BLOCKED` · `marketMonitoring=BLOCKED` · `recoveryStatus=RECOVERY_BLOCKED` · reason message operator-readable · **not** `AMBIGUOUS_RECOVERY` |
| START again | again `QUOTE_NOT_FRESH` / BLOCKED (no false success) |
| STOP after BLOCKED | `OFF` · `recoveryStatus=IDLE` |
| STOP again | `ALREADY_OFF` |
| Safety | `masterEnable=false` · `emergencyEntryLock=true` · `automaticEntry=DISABLED` · `placesOrders=false` · automation `acceptsForExecution=false` · `entryGenerationEnabled=false` · `brokerExecution=DISABLED` · `executionReadiness=BLOCKED` · `executionStatusLabel=EXECUTION_FORBIDDEN` · `moduleStatus=BLOCKED` (execution posture) |

---

## 8. Safety invariants (must remain)

```text
masterTradingEnabled / masterEnable = false (required for monitoring START readiness)
emergencyEntryLock = true
placesOrders = false
acceptsForExecution = false
execution status = EXECUTION_FORBIDDEN
ForexConnect trading = DISABLED
automatic broker entry = DISABLED
automatic broker re-entry = DISABLED
LIVE broker execution = UNAUTHORIZED
```

No broker order was submitted as part of this phase.

---

## 9. Remaining blockers / known limitations

- **Production soft-resume to MONITORING:** `NOT_VERIFIED` this cycle — deploy restart found persisted OFF; live quotes were stale (`QUOTE_AGE_EXCEEDED`), so START correctly stayed monitoring-BLOCKED with `QUOTE_NOT_FRESH`. Soft-resume decision logic is unit-tested.
- Soft-resume still depends on real quote freshness and instrument configuration; stale quotes correctly keep monitoring BLOCKED.
- Browser closure does not stop a correctly deployed server worker — relies on existing `AtMonitorWorker` (not re-proven end-to-end in this phase’s live checks).
- Full concurrent START/STOP race under load is covered by CAS semantics + unit tests, not a long soak.
- Broker execution remains intentionally blocked (not a defect).
- Top-level `/status` exposes `placesOrders=false` and `moduleStatus=BLOCKED`; `acceptsForExecution=false` is authoritative on automation public status (verified).

---

## 10. Not tested

- Live soft-resume path with fresh post-restart quotes and prior MONITORING persistence.
- Actual broker order submit/amend/cancel/close/protect.
- Enabling Master Trading or clearing Emergency Entry Lock.
- Fabricated production quotes.
- Unauthorized (non-Admin) START succeeding.
- Manual SSH restart outside the authorized deploy path (deploy restart was used).

---

## 11. Next recommended step

When market data is fresh: START AUTO → confirm MONITORING, then rely on next authorized deploy restart to prove soft-resume live — or owner-approved Phase 57.3 for further work. Do not begin another phase without explicit owner approval.
