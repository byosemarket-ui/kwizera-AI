# Phase 56.3.5 — Controlled Recovery Acceptance & Restart Verification

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect market-data recovery acceptance  
**Document type:** Controlled acceptance (market-data only)  
**Starting HEAD / prod:** `d04a7c786121fbc0089dbd949712269ab9d31742` (`verifiedLive=true`)  
**Feature / Ending HEAD / deployed:** `fca6ba46f0cef40f10af0e7b10295fe744dbc0a4` (`verifiedLive=true`, CI **#39768266335** success)  
**Scope:** Acceptance A–D. **No execution. No unauthorized production disconnect/restart. Do not start 56.3.6 / 56.4.**

---

## 1. Baseline verification

| Item | Evidence |
|------|----------|
| Production start | `d04a7c78…`, `verifiedLive=true`, healthy |
| Persistence | `lifecycle.persistence.enabled=true`, basename `intended-subscriptions.json` |
| Unrelated dirty files | PMV/typography/video — **preserved** |

---

## 2. Environments

| Acceptance | Environment | Status |
|------------|-------------|--------|
| A — Persistence intent | Production RO diagnostics + vitest/temp store | **PASS** |
| B — Disconnect/reconnect | **Controlled:** vitest + mock bridge (in-process) | **PASS** (controlled) |
| B — Disconnect/reconnect | Production admin `/disconnect` | **BLOCKED** — requires authorized admin; not induced |
| C — Process restart hydrate | **Controlled:** new service instance + same temp store file | **PASS** (controlled) |
| C — Process restart | Production gateway/service restart | **BLOCKED** — no authorized maintenance restart |
| D — Isolation / metadata | Production RO + synthetic | **PASS** |

---

## 3. Acceptance A — persisted subscription intent

### Production RO (safe metadata only — store contents not dumped)

| Check | Result |
|-------|--------|
| Persistence enabled | `true` |
| Store basename | `intended-subscriptions.json` |
| `lastError` | `null` |
| `lastRecoveredCorrupt` | `false` |
| Environment | `demo` |
| After subscribeLive | `intendedCount=5` for XAU/EUR/US30/GBP/XAG; **FAKE/XYZ not intended** |
| Persistence write observed | `lastWriteAtMs` present |
| Secrets in diagnostics | none exposed |

### Synthetic

| Check | Result |
|-------|--------|
| XAU/USD, EUR/USD with `/` | Persisted |
| FAKE/XYZ | Rejected vs catalog |
| Malformed JSON | Quarantine + empty hydrate; no LIVE |
| File contents | No password/token/bid/ask strings |

---

## 4. Acceptance B — controlled disconnect / reconnect

**Environment:** vitest mock ForexConnect bridge (not production).

| Step | Result |
|------|--------|
| XAU/EUR genuine LIVE | PASS |
| Controlled disconnect | Sessions → `DISCONNECTED`; lifecycle `DISCONNECTED`; intended preserved |
| Single-flight restore | Concurrent callers share one workflow; ≤ max attempts |
| Restore without quotes | Not LIVE |
| Fresh events after restore | XAU/EUR independently return LIVE |
| Repeat cycle | Session count stable (no leak) |

**Production disconnect cycle:** **BLOCKED** (admin POST `/disconnect` not invoked).

### Code hardening shipped

- `markAllSessionsDisconnected` clears `lastPriceChangeAtMs`, `lastQuoteAtMs`, and `updateCount`.
- `toSeries` keeps `DISCONNECTED`/`ERROR` sticky (no residual-receipt re-promotion).

---

## 5. Acceptance C — process restart / hydration

**Environment:** controlled in-process restart (new `ForexConnectLiveCandleService` + same store path).

| Step | Result |
|------|--------|
| Persist intended | PASS |
| Hydrate after “restart” | XAU/EUR loaded |
| FAKE in file | Skipped (`not_in_provider_catalog`) |
| Restore with empty quotes | Not LIVE |
| Production service restart | **BLOCKED** |

---

## 6. Acceptance D — isolation matrix

### Production RO readiness (`subscribeLive=1`)

| Symbol | Observation |
|--------|-------------|
| XAU/USD | LIVE |
| EUR/USD | LIVE |
| US30 | LIVE |
| GBP/USD | LIVE |
| XAG/USD | Blocked `seeded_snapshot_no_genuine_event` |
| FAKE/XYZ | Blocked `no_active_session` (undiscovered) |

### Metadata

| Symbol | `marketType` | `providerMarketTypeRaw` |
|--------|--------------|-------------------------|
| US30 | `INDEX` | `FOREX` |
| GBP/USD | `FOREX` | `FOREX` |

### Synthetic isolation

XAU recovers LIVE while EUR remains non-LIVE when EUR quotes are withheld after restore.

---

## 7. Tests & CI

| Suite | Category | Result |
|-------|----------|--------|
| `phase56-3-5-controlled-recovery-acceptance.test.ts` | controlled synthetic | **5/5 PASS** |
| `phase56-3-4-persistence-and-restart.test.ts` | synthetic | **7/7 PASS** |
| CI / deploy | [Production deploy #39768266335](https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39768266335) success; prod `fca6ba46…` `verifiedLive=true` | |

---

## 8. Safety locks

| Lock | Required | Observed |
|------|----------|----------|
| placesOrders | false | Stream lifecycle + readiness |
| acceptsForExecution | false | Stream lifecycle + readiness |
| EXECUTION_FORBIDDEN | yes | `POST …/place-order` → 403 |
| FC trading DISABLED | yes | `trading: DISABLED` |
| LIVE trading unauthorized | yes | DEMO |
| Allowlist XAU-only | yes | Synthetic + unchanged |
| masterTradingEnabled | false | Not mutated; AT status admin-gated (RO probe 403 without token) |
| emergencyEntryLock | true | Not mutated |
| Broker mutations | none | No disconnect/restart/order APIs |

---

## 9. Known blockers

1. Production authorized disconnect→reconnect→fresh-LIVE cycle **not performed**.  
2. Production process restart hydration **not performed**.  
3. Quantity / CondDist / FX draft gates remain from earlier phases.  
4. **Do not start 56.3.6 / 56.4 without owner approval.**

---

## 10. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`**

Controlled-environment acceptance A–D demonstrated (including disconnect/restore/restart hydrate). Production RO confirms persistence, isolation, metadata, and safety. Full production disconnect and service-restart evidence remain BLOCKED pending explicit operational authorization.

*End of Phase 56.3.5 record. STOP.*
