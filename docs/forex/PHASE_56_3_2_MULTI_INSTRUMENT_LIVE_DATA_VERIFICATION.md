# Phase 56.3.2 — Multi-Instrument Live Data Verification

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect market-data engine (multi-instrument)  
**Document type:** Verification + isolation observability  
**Starting HEAD:** `3b24a427210ef4956ffe6c24fb0c541ec8e49119` (matched production `verifiedLive=true`)  
**Phase 56.3.1 baseline:** `PASS_WITH_KNOWN_BLOCKERS`; Offers LIVE after subscribe; catalog-only ≠ LIVE  
**Ending HEAD / deployed:** `a5550311c77228b0d8264d1c161c8f9b749b7f41` (`verifiedLive=true`, CI **#407** success)  
**Scope:** Multi-instrument live-data verification only. **No execution. Do not start 56.3.3 / 56.4.**

---

## 1. Baseline verification

| Item | Evidence |
|------|----------|
| Local HEAD | `3b24a427…` on `main` |
| Production | `deployedCommit=3b24a427…`, `verifiedLive=true`, `healthy` |
| Unrelated dirty files | PMV/typography/video — **preserved** |

---

## 2. Architecture (summary)

| Concern | Finding |
|---------|---------|
| Providers | BINANCE, FXCM, FOREXCONNECT registered |
| FC discovery | Authenticated Offers `/instruments`; classify maps FX / metals / indices / shares / crypto / etc. |
| Unified `marketType` | MDS list often labels rows `FOREX` — explorer classify is the truthful multi-asset map (known limitation) |
| LIVE gate | Genuine `offers-callback` \| `offers-table-diff` + bid/ask **price change** + `priceChangeAgeMs ≤ 15s` |
| Isolation | Per-session; peer LIVE / global sidecar counters never promote another symbol |
| Idle | Sessions released after 180s quiet; **no auto-resubscribe** after disconnect — next `ensure`/`subscribeLive` recreates |
| Execution allowlist | AT remains **XAU/USD / XAUUSD only** — independent of market-data LIVE |

---

## 3. Per-instrument acceptance matrix (production RO)

Provider: **FOREXCONNECT**. Method: `GET …/instrument-readiness?subscribeLive=1&timeframe=1m`.  
Catalog-only discovery confirmed separately (`FAKE/XYZ` hits=0).

| Symbol | Discovered | t0 LIVE | t+10s LIVE | Bid/Ask (t+10s) | upd t0→t+10 | Genuine events | Notes | Verdict |
|--------|------------|---------|------------|-----------------|-------------|----------------|-------|---------|
| XAU/USD | yes | yes | yes | 4139.3 / 4139.6 | 9→26 | offers-callback | Metals; updates continue | **PASS (prod)** |
| EUR/USD | yes | yes | yes | 1.12322 / 1.12336 | 3→7 | offers-callback | FX; ask moved | **PASS (prod)** |
| US30 | yes | yes | yes | 52810.5→52816 / 52819 | 1→26 | offers-table-diff | Index; bid changed | **PASS (prod)** |
| GBP/USD | yes | **no** (seeded) | yes | 1.33923 / 1.33938 | 0→4 | offers-table-diff | Became LIVE independently | **PASS (prod)** |
| XAG/USD | yes | no | **no** | 57.685 / 58.005 | 0→0 | table-diff without price change applied | `seeded_snapshot_no_genuine_event` while peers LIVE | **PASS isolation (prod)** — honest non-LIVE |
| FAKE/XYZ | no | — | — | — | — | — | Search hits=0 | **PASS fail-closed** |

`placesOrders=false`, `executionAuthorized=false` on every snapshot.  
**Do not claim global LIVE:** at t0 `liveReady=3/5`; at t+10s `liveReady=4/5` with XAG still blocked.

### Synthetic unit coverage (not prod evidence)

`phase56-3-2-multi-instrument-live-data.test.ts` — **11/11 PASS**: identity isolation, independent LIVE, peer non-leakage, unknown instrument, bad bid/ask, stale/heartbeat, timestamp units, TF aliases, allowlist ≠ data LIVE, catalog `liveReadySymbols`.

Regression: 56.3.1 **9/9**, 56.2.8 **8/8** (total **28/28** local).

---

## 4. Changes this phase

| Change | Purpose |
|--------|---------|
| Catalog summary `liveReadySymbols` / `blockedSymbols` | Explicit multi-instrument status; avoid global LIVE implication |
| Phase tag `56.3.2` on readiness snapshots/summary | Versioned diagnostics |
| Focused unit suite | Isolation / integrity / safety |

Freshness 15s policy and execution allowlist **unchanged**.

---

## 5. Reconnect / resubscription

| Check | Result |
|-------|--------|
| Code path | `clearAllSessions` on env switch/disconnect; idle release unsubscribes sidecar |
| Auto-resubscribe loop | **Not present** — consumers must call `ensure` / `subscribeLive` again |
| Evidence | Architecture + prior phase41 lifecycle tests; not a new broker mutation path |
| Verdict | **Documented limitation** (fail-closed until re-ensure) — not fabricated recovery |

---

## 6. UI / responsive

| Surface | Result |
|---------|--------|
| Readiness API | Per-instrument `feedDiagnostics`; post-deploy will expose `liveReadySymbols` |
| AT / Charts / AI Analysis | Prior 56.3.1: pages load; Master OFF; emergency ON; `placesOrders=false` |
| Interactive responsive re-check this phase | Optional post-deploy; mark limited if browser facility unavailable |
| Admin AT draft full Scenario 1 | Quantity/CondDist/FX gates remain known blockers |

---

## 7. Safety locks

| Lock | Required | Observed |
|------|----------|----------|
| masterTradingEnabled / Master enable | false | Unchanged / UI OFF |
| emergencyEntryLock | true | Unchanged / UI ON |
| placesOrders | false | Readiness API |
| acceptsForExecution | false | Readiness API |
| EXECUTION_FORBIDDEN / FC trading DISABLED | yes | Unchanged |
| LIVE trading unauthorized | yes | DEMO path only |
| Broker mutations | none | RO discovery + readiness only |
| AT allowlist | XAU only | EUR/XAG/US30 LIVE ≠ executionAuthorized |

---

## 8. CI/CD / deploy

| Item | Value |
|------|-------|
| Feature commit | `a5550311c77228b0d8264d1c161c8f9b749b7f41` |
| GitHub Actions | Production deploy **#407** — completed successfully (~2m 54s) |
| Actions index | https://github.com/byosemarket-ui/kwizera-AI/actions?query=branch%3Amain |
| Production `/api/deployment` | `deployedCommit=a5550311…`, `verifiedLive=true`, `result=success` |
| Post-deploy probe | `phase=56.3.2`, `liveReadySymbols=XAU/USD,EUR/USD`, `blocked=XAG/USD:seeded_snapshot_no_genuine_event`, `placesOrders=false` |
| Health | `healthy` |

---

## 9. Known blockers / limitations

1. XAG/USD remained non-LIVE during observation (no counted genuine price change) — honest.  
2. Unified MDS `marketType` often `FOREX` for shares/notes — classify layer is authoritative for categories.  
3. No automatic Offers resubscribe after disconnect/idle — re-ensure required.  
4. Quantity / CondDist / FX / full simulation draft gates from 56.2.x remain.  
5. **Do not start 56.3.3 / 56.4 without owner approval.**

---

## 10. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`** — required XAU/USD + EUR/USD independently LIVE with genuine updates; additional FC instruments (US30, GBP/USD) verified; XAG isolation proven; synthetic suites green; execution locks closed; reconnect auto-resubscribe and asset-class labeling gaps remain documented.

*End of Phase 56.3.2 record.*
