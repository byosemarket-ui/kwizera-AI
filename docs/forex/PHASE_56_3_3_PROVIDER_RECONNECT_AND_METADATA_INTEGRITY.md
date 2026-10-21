# Phase 56.3.3 — Provider Reconnect, Auto-Resubscription & Instrument Metadata Integrity

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect market-data lifecycle + MDS classification  
**Document type:** Infrastructure hardening (market-data only)  
**Starting HEAD:** `33a3c5f68522f5ed3eb52474032b98d2513da176` (matched production `verifiedLive=true`)  
**Phase 56.3.2 baseline:** `PASS_WITH_KNOWN_BLOCKERS`; no auto-resubscribe; MDS `marketType` often `FOREX`  
**Feature commit:** `bfd2e59662f5b1a06629711189d3faebc5e2ecfe`  
**Ending HEAD / deployed:** `bfd2e59662f5b1a06629711189d3faebc5e2ecfe` (`verifiedLive=true`, CI **#39689169044** success)  
**Scope:** Reconnect/resubscribe + metadata integrity. **No execution. Do not start 56.3.4 / 56.4.**

---

## 1. Baseline verification

| Item | Evidence |
|------|----------|
| Local / prod at start | `33a3c5f6…`, `verifiedLive=true`, healthy |
| Ending production `/api/deployment` | `deployedCommit=bfd2e596…`, `verifiedLive=true`, `result=success`, `status=live` |
| Unrelated dirty files | PMV/typography/video — **preserved** (not staged) |

---

## 2. Root causes (proven)

### 2.1 No intended-subscription registry

`ForexConnectLiveCandleService` only kept an in-memory `sessions` Map. `clearAllSessions` / disconnect wiped actives with **no** restore list. FXCM already had a mark-for-restore pattern; ForexConnect did not.

### 2.2 MDS `marketType` hardcoded `FOREX`

`ai/market-data/forexconnect/provider.ts` mapped every Offers row to `marketType: "FOREX"` despite `classifyForexConnectInstrument` correctly producing INDEX / COMMODITY / SHARE / etc. for the explorer catalog.

---

## 3. Design / changes

| Change | Behavior |
|--------|----------|
| `intendedSubscriptions` Map | Remembered on successful `createSession`; forgotten on explicit unsubscribe / idle release / env switch |
| `clearAllSessions({ clearIntended })` | Marks sessions `DISCONNECTED` + clears price-change freshness; default preserves intended; `clearIntended` on DEMO↔LIVE |
| `restoreIntendedSubscriptions` | Single-flight, max 3 attempts with backoff; `ensure` only — **never invents LIVE** |
| Poll disconnect | `sessionStatus`/`streamState` DISCONNECTED → `markAllSessionsDisconnected` |
| Session connect | After CONNECTED → `notifyProviderConnected` + best-effort restore |
| Provider `listInstruments` | Uses `classifyForexConnectInstrument`; stores `classificationSource`, `normalizedMarketType`, `providerMarketTypeRaw` |
| Live session `marketType` | Classified per instrument (not hardcoded FOREX) |
| Stream status API | Adds `lifecycle` diagnostics (intended vs active, no secrets) |

---

## 4. Tests (synthetic)

| Suite | Result |
|-------|--------|
| `phase56-3-3-reconnect-and-metadata.test.ts` | **9/9 PASS** |
| `phase56-3-2-multi-instrument-live-data.test.ts` | **11/11 PASS** |
| `phase56-3-1-live-feed-diagnostics.test.ts` | **9/9 PASS** |
| Combined local light run | **29/29 PASS** |

Covers: classification XAU→COMMODITY / US30→INDEX; provider provenance; intended preserve vs clear; restore single-flight + bounded; disconnect invalidates LIVE; peer isolation; FAKE undiscovered; allowlist; safety flags.

**Label:** synthetic/unit only — not production Offers evidence.

---

## 5. Production observations (genuine)

**Deploy:** CI run [39689169044](https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39689169044) — Production deploy **success** for `bfd2e596`.  
**Base URL:** `http://162.35.114.19:5173`

### 5.1 Metadata provenance (MDS `/api/forex/market-data/instruments`)

| Symbol | Found | `marketType` (normalized) | `providerMarketTypeRaw` | `classificationSource` | Notes |
|--------|-------|---------------------------|-------------------------|------------------------|-------|
| XAU/USD | yes | `COMMODITY` | `FOREX` | `provider_instrument_type` | Metals; contract fields preserved |
| XAG/USD | yes | `COMMODITY` | `FOREX` | `provider_instrument_type` | Same |
| US30 | yes | `INDEX` | `FOREX` | `provider_instrument_type` | **Does not default to FOREX** |
| EUR/USD | yes | `FOREX` | `FOREX` | `provider_instrument_type` | Correct FX |
| GBP/USD | yes | `FOREX` | `FOREX` | `provider_instrument_type` | Correct FX |
| FAKE/XYZ | **no** | — | — | — | Undiscovered (`search=FAKE` → `[]`) |

Contract-size / quantity fields (`baseUnitSize`, `contractMultiplier`) remain instrument-specific; classification does not rewrite them into Forex lots.

### 5.2 Lifecycle + per-instrument readiness

`GET /api/forex/providers/forexconnect/stream/status` exposes `lifecycle` with `placesOrders=false`, `acceptsForExecution=false`.

After RO `subscribeLive=1` readiness probe (`timeframe=m1`):

| Time | `liveReadySymbols` | Blocked |
|------|--------------------|---------|
| t0 | `XAU/USD`, `EUR/USD` | US30/GBP/XAG: `seeded_snapshot_no_genuine_event`; FAKE: `no_active_session` |
| t+12s | `XAU/USD`, `EUR/USD`, `US30`, `GBP/USD` | XAG: `seeded_snapshot_no_genuine_event`; FAKE: `no_active_session` |

Lifecycle after subscribe: `intendedCount=5`, intended list matches XAU/EUR/US30/GBP/XAG (FAKE never remembered), `restoreInFlight=false`, `placesOrders=false`.

**Independent recovery:** XAU/EUR LIVE while peers blocked; later US30/GBP LIVE while XAG remains blocked. No peer leakage.

### 5.3 Authorized disconnect/reconnect demo

**BLOCKED** — no authorized same-env disconnect was performed in this phase (admin mutation avoided). Synthetic suite covers disconnect invalidation + bounded restore; production restore hook is wired (`CONNECTED` → `restoreIntendedSubscriptions`) but live disconnect→LIVE recovery was **not** evidenced on the VPS in this run.

### 5.4 UI / responsive

| Surface | HTTP | Notes |
|---------|------|-------|
| `/forex/ai-analysis` | 200 | OK |
| `/forex/charts` | 200 | Compact at 390/768/1024/1440; empty-state when no market selected |
| `/forex/automated-trading` | 200 | Master OFF / Emergency ON; `simulationOnly=true · placesOrders=false · acceptsForExecution=false` |
| `/admin/forex` | 200 | OK |

---

## 6. Safety locks

| Lock | Required | Observed |
|------|----------|----------|
| masterTradingEnabled | false | UI: Master enable **OFF** (readonly) |
| emergencyEntryLock | true | UI: Emergency entry lock **ON** (checked, readonly) |
| placesOrders | false | Stream lifecycle + readiness + AT UI |
| acceptsForExecution | false | Stream lifecycle + readiness + AT UI |
| EXECUTION_FORBIDDEN | yes | `POST …/place-order` → 403 `EXECUTION_FORBIDDEN` |
| FC trading DISABLED | yes | `stream/status` + provider status `trading: DISABLED` |
| LIVE trading unauthorized | yes | DEMO only; LIVE env button released |
| AT allowlist XAU-only | yes | Unchanged (UI instrument XAU/USD; no allowlist edit) |
| Broker mutations | none | No connect/disconnect/order APIs invoked for mutation |

`GET /api/forex/automated-trading/status` returned **403** without admin token in the RO node probe; safety values above are from stream/readiness APIs + authorized-session UI.

---

## 7. CI/CD / deploy

| Step | Result |
|------|--------|
| Commit | `bfd2e596` — `feat(forex): Phase 56.3.3 provider reconnect restore and MDS marketType integrity` |
| Push | `33a3c5f6..bfd2e596` → `origin/main` |
| CI | [Production deploy #39689169044](https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39689169044) — **success** |
| Production SHA | `bfd2e596…` `verifiedLive=true` |

---

## 8. Known blockers

1. Process restart still loses in-memory intended list (clients must re-`ensure`).  
2. Authorized same-env disconnect/reconnect production demo **not run** this phase — restore path verified in synthetic tests + CONNECTED hook present.  
3. Sidecar may still stub raw Offers `marketType: FOREX` — TS MDS provider classifies on ingest (`providerMarketTypeRaw` preserved).  
4. Quantity / CondDist / FX draft gates from 56.2.x remain.  
5. XAG/USD can remain independently blocked (`seeded_snapshot_no_genuine_event`) even when peers are LIVE.  
6. **Do not start 56.3.4 / 56.4 without owner approval.**

---

## 9. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`**

Proven: MDS marketType integrity (US30→INDEX, XAU→COMMODITY despite raw FOREX); intended-subscription registry + lifecycle diagnostics live in production; per-instrument LIVE isolation and XAG/FAKE blockers; safety locks closed; CI/deploy SHA match.

Unverified in production: full disconnect → reconnect → fresh-quote LIVE restore cycle (requires authorized disconnect).

*End of Phase 56.3.3 record. STOP — do not begin Phase 56.3.4 / 56.4.*
