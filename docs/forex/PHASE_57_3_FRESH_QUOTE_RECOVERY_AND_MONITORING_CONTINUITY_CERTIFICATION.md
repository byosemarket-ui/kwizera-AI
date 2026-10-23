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
| Phase 57.3 core feature | `dcd3c14f` (`dcd3c14fa0742a57e1c935f3a56d71462f6861d3`) |
| Phase 57.3 follow-up (default TF + early cert notes) | `faab7f3b` |
| Documentation (this revision) | _(docs commit after this file)_ |
| Deployed at certification | `faab7f3b…` (`verifiedLive=true`, `result=success`) |

---

## 2. Root-cause table

| Observed symptom | Evidence | Root cause | Targeted fix | Safety implications |
|------------------|----------|------------|--------------|---------------------|
| START AUTO → `QUOTE_NOT_FRESH` while monitoring OFF | Prod 57.2: `quoteFreshness.fresh=false`, `QUOTE_AGE_EXCEEDED`, monitor `STOPPED` | **Chicken-and-egg:** readiness aged `lastVerification` without refreshing live Offers | `runVerification` before START/boot readiness | Fail closed if Offers stay stale; no orders |
| Monitor health `LIVE_FRESH` while status stale | Prod frozen health vs aged status | Disk health not re-aged when worker STOPPED | Re-evaluate freshness in `getPublicStatus` | Operator accuracy only |
| Soft-resume `NOT_VERIFIED` in 57.2 | Boot used aged snapshot | Same chicken-and-egg on boot | Boot `runVerification` before soft-resume decision | Still requires true fresh quotes |
| Threshold defect? | Unit tests; `MARKET_QUOTE_STALE_MS=15000` | **Not** a threshold bug | Threshold preserved | — |
| START blocked with unsupported TF | Prod: prior monitor TF invalid | Config TF not defaulted to supported project TF | Default START timeframe to supported TF (`faab7f3b`) | Fail closed previously; still no execution |

---

## 3. Freshness semantics (unchanged thresholds)

| Constant | Value |
|----------|-------|
| `MARKET_QUOTE_STALE_MS` | 15_000 |
| `AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS` | 5_000 |

Rules preserved: heartbeat alone ≠ fresh; receive time alone cannot freshen old price-change age; pre-restart snapshots age forward; future timestamps beyond skew rejected.

Automation mapping for failed evaluations: `QUOTE_NOT_FRESH`, `QUOTE_MISSING`, `QUOTE_TIMESTAMP_INVALID`, `QUOTE_FUTURE_TIMESTAMP`, `FEED_DISCONNECTED` (plus existing safety codes).

---

## 4. Subscription / reconnect

Reuses `getForexConnectLiveCandleService().ensure()` inside `runVerification` (bounded settle polls). No fabricated quotes. Session/`refCount` duplicate-subscription design unchanged.

---

## 5. Recovery / state machine

- START: refresh verification → readiness → `startMonitoring` → `MONITORING` or `BLOCKED` with concrete reason.
- Boot: refresh verification → `decideAutomationBootRecovery` soft-resume only if readiness.ok.
- Execution always `DISABLED` / `EXECUTION_FORBIDDEN` / `placesOrders=false`.

---

## 6. Files changed (57.3)

| Path | Reason |
|------|--------|
| `automation-control/readiness.ts` | Map freshness diagnostics |
| `automation-control/types.ts` | Quote/feed reason codes |
| `service.ts` | Live refresh before START/boot; default TF follow-up |
| `monitoring/worker.ts` | Re-age health on status read |
| `ForexAutomatedTradingPage.tsx` | Market-data status line |
| `phase57-3-*.test.ts` | Synthetic freshness tests |
| This document | Certification |

---

## 7. Tests (synthetic)

```text
node ./node_modules/vitest/vitest.mjs run tests/unit/ai/forex-ai/phase57-3-fresh-quote-recovery.test.ts --no-file-parallelism
→ 11 passed (11), exit 0
```

---

## 8. Production evidence

**Method:** Admin session (`x-kwizera-admin-token`). Deploy path authorized. No broker orders.

| Check | Result |
|-------|--------|
| Deployed SHA | `faab7f3b…` · `verifiedLive=true` |
| `masterEnable` drift | Found `true`; restored `false` via `POST …/controls` (`environment=DEMO`) |
| Pre-START quote | Often aged `QUOTE_AGE_EXCEEDED` when monitor OFF |
| START refresh | `runVerification` → mid-path `LIVE_FRESH` |
| START (`timeframe=15m`) | `ok=true` · `MONITORING` · `marketMonitoring=ACTIVE` · `recoveryStatus=RECOVERED` · `brokerExecution=DISABLED` · `EXECUTION_FORBIDDEN` · `placesOrders=false` · `acceptsForExecution=false` · `entryGenerationEnabled=false` |
| START again | `ALREADY_MONITORING` |
| Worker | `enabled=true`, `workerActive=true`, instrument `XAU/USD`, health `LIVE_FRESH` |
| STOP / STOP again | `OFF` / `ALREADY_OFF` |
| Soft-resume after restart | See §10 — left MONITORING on for docs deploy when performed; otherwise `NOT_VERIFIED` |

### Synthetic vs production

| Class | Result |
|-------|--------|
| Unit tests | 11 passed (synthetic) |
| Production Offers + START | Real provider path; MONITORING certified |

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

- Soft-resume after process restart: verified only when an authorized deploy restart occurs with MONITORING desired and post-restart fresh quotes; otherwise `NOT_VERIFIED`.
- Market closed / no Offers updates correctly keep START blocked.
- Unrelated dirty PMV/typography files preserved, not committed.
