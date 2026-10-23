# Phase 57.3 — Fresh-Quote Recovery & Monitoring Continuity Certification

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Phase:** 57.3  

**Final verdict:** `PASS_WITH_KNOWN_BLOCKERS`

> Market-data / monitoring phase only. Broker execution remains **DISABLED**.

---

## 1. SHAs

| Item | SHA |
|------|-----|
| Baseline (Phase 57.2 docs) | `07855a00` |
| Phase 57.2 feature | `1bf862c5` |
| Phase 57.3 feature | `dcd3c14f` (`dcd3c14fa0742a57e1c935f3a56d71462f6861d3`) |
| Documentation | _(this document)_ |
| Deployed production (feature) | `dcd3c14f…` (`verifiedLive=true`, `result=success`) |

---

## 2. Root-cause table

| Observed symptom | Evidence | Root cause | Targeted fix | Safety implications |
|------------------|----------|------------|--------------|---------------------|
| START AUTO → `QUOTE_NOT_FRESH` while monitoring OFF | Prod 57.2: `quoteFreshness.fresh=false`, `QUOTE_AGE_EXCEEDED`, monitor `workerState=STOPPED` | **Chicken-and-egg:** readiness aged `lastVerification` without refreshing live Offers; STOP leaves verification to expire so START can never clear `QUOTE_NOT_FRESH` without an external verify | Call existing `runVerification` (ensures live subscription + genuine quote ages) **before** START/boot readiness | Does not enable orders; still fails closed if Offers stay stale |
| Monitor health showed `LIVE_FRESH` / `quoteFresh=true` while status API said stale | Prod: monitor health `LIVE_FRESH` with `lastQuoteChangeAtUtc` hours old; AT status `QUOTE_AGE_EXCEEDED` | Frozen health fields on disk when worker STOPPED; `getPublicStatus` did not re-age | Re-evaluate freshness on every `getPublicStatus` from current verification | Correcter operator signal; no execution change |
| Soft-resume `NOT_VERIFIED` in 57.2 | Boot readiness used aged snapshot; quotes often stale after restart | Same chicken-and-egg on boot path | Boot calls `runVerification` before `decideAutomationBootRecovery` | Soft-resume still requires true fresh quotes + other prereqs |
| Threshold / unit defect? | `MARKET_QUOTE_STALE_MS=15000` unchanged; age-forward logic correct in unit tests | **Not** a threshold bug — real absence of post-STOP live evidence in readiness path | Threshold preserved | — |

---

## 3. Freshness semantics (unchanged thresholds)

| Constant | Value |
|----------|-------|
| `MARKET_QUOTE_STALE_MS` | 15_000 |
| `AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS` | 5_000 |

Rules preserved: heartbeat alone ≠ fresh; receive time alone cannot freshen old price-change age; pre-restart snapshots age forward via `verifiedAtUtc`; future timestamps beyond skew rejected.

New automation reason mapping (failed evaluations only):

| Freshness diagnostic | Automation `reasonCode` |
|----------------------|-------------------------|
| `QUOTE_AGE_EXCEEDED` / heartbeat-only / etc. | `QUOTE_NOT_FRESH` |
| Missing bid/ask / verification / no updates | `QUOTE_MISSING` |
| Invalid / unknown price-change age | `QUOTE_TIMESTAMP_INVALID` |
| Future verified/source timestamps | `QUOTE_FUTURE_TIMESTAMP` |
| `FEED_NOT_LIVE` | `FEED_DISCONNECTED` |

---

## 4. Subscription / reconnect

Reuses existing `getForexConnectLiveCandleService().ensure()` inside `runVerification` (bounded settle polls). No new subscription stack. Duplicate listener prevention remains in the live-service session/`refCount` design (not re-architected this phase).

---

## 5. Recovery / state machine

- START: refresh verification → CAS STARTING → readiness (incl. mapped quote codes) → `startMonitoring` → MONITORING or BLOCKED.
- Boot: refresh verification → `decideAutomationBootRecovery` soft-resume only if readiness.ok.
- Execution flags always forced false / `DISABLED` / `EXECUTION_FORBIDDEN`.

---

## 6. Files changed

| Path | Reason |
|------|--------|
| `automation-control/readiness.ts` | Map freshness diagnostics; keep fail-closed |
| `automation-control/types.ts` | Additional quote/feed reason codes |
| `service.ts` | `runVerification` before START + boot readiness |
| `monitoring/worker.ts` | Re-age health on status read |
| `ForexAutomatedTradingPage.tsx` | Market-data status line |
| `phase57-3-*.test.ts` | Synthetic freshness / mapping / health tests |
| This document | Certification |

---

## 7. Tests (synthetic)

```text
node ./node_modules/vitest/vitest.mjs run tests/unit/ai/forex-ai/phase57-3-fresh-quote-recovery.test.ts --no-file-parallelism
→ 11 passed (11), exit 0
```

Also regression: phase57-2 suite 14 passed in prior combined run.

---

## 8. Production evidence

**Method:** Admin session on production (`x-kwizera-admin-token`). Authorized deploy restarted gateway for feature `dcd3c14f`. No broker orders submitted.

| Check | Result |
|-------|--------|
| Deployed SHA | `dcd3c14f…` · `verifiedLive=true` · `result=success` |
| Pre-fix monitor health freeze | Before fix path: aged `QUOTE_AGE_EXCEEDED` on status; after deploy, stopped worker health re-ages (no frozen `LIVE_FRESH` claim when snapshot stale) |
| `masterEnable` drift | Found `true` in prod; restored `false` via controls API (`environment=DEMO`) — required for START readiness / safety invariant |
| Quote refresh on START | `runVerification` path yielded `quoteFreshness.fresh=true` / `LIVE_FRESH` for XAU/USD |
| START without supported TF | `MONITOR_START_FAILED` (unsupported TF from prior config) — fail closed, execution still DISABLED |
| START with `timeframe=15m` | `ok=true` · `code=MONITORING` · `lifecycle=MONITORING` · `marketMonitoring=ACTIVE` · `recoveryStatus=RECOVERED` · `brokerExecution=DISABLED` · `executionStatusLabel=EXECUTION_FORBIDDEN` · `placesOrders=false` · `acceptsForExecution=false` · `entryGenerationEnabled=false` |
| START again | `ALREADY_MONITORING` (idempotent) |
| Worker during MONITORING | `workerActive=true`, instrument `XAU/USD`, TF `15m`, monitor `LIVE_FRESH` |
| STOP / STOP again | `OFF` / `ALREADY_OFF` |
| Soft-resume after restart | Attempted via docs deploy with MONITORING left ON — see post-docs section / remaining |

### Synthetic vs production

| Class | Result |
|-------|--------|
| Unit tests (synthetic quotes) | 11 passed |
| Production Offers / START | Real provider quotes; MONITORING certified |

---

## 9. Safety invariants (production read)

```text
masterEnable = false (restored)
emergencyEntryLock = true
automaticEntry = DISABLED
placesOrders = false
acceptsForExecution = false
executionStatusLabel = EXECUTION_FORBIDDEN
brokerExecution = DISABLED
moduleStatus = BLOCKED (execution posture)
entryGenerationEnabled = false
```

No broker order was submitted.

---

## 10. Remaining / unverified

- Soft-resume after authorized restart: see follow-up evidence after docs deploy; if quotes unavailable at boot, remains `NOT_VERIFIED` / BLOCKED with concrete reason.
- Default START without explicit timeframe can fail if persisted monitor TF is unsupported — operator should pass `15m` (or fix stored config). Optional hardening deferred.
- Unrelated dirty PMV/typography files preserved, not committed.
