# Phase 56.3.3 — Provider Reconnect, Auto-Resubscription & Instrument Metadata Integrity

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect market-data lifecycle + MDS classification  
**Document type:** Infrastructure hardening (market-data only)  
**Starting HEAD:** `33a3c5f68522f5ed3eb52474032b98d2513da176` (matched production `verifiedLive=true`)  
**Phase 56.3.2 baseline:** `PASS_WITH_KNOWN_BLOCKERS`; no auto-resubscribe; MDS `marketType` often `FOREX`  
**Ending HEAD / deployed:** _(filled at ship)_  
**Scope:** Reconnect/resubscribe + metadata integrity. **No execution. Do not start 56.3.4 / 56.4.**

---

## 1. Baseline verification

| Item | Evidence |
|------|----------|
| Local / prod at start | `33a3c5f6…`, `verifiedLive=true`, healthy |
| Unrelated dirty files | PMV/typography/video — **preserved** |

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
| 56.3.2 / 56.3.1 / phase41 regressions | Covered in local run (see ship notes) |

Covers: classification XAU→COMMODITY / US30→INDEX; provider provenance; intended preserve vs clear; restore single-flight + bounded; disconnect invalidates LIVE; peer isolation; FAKE undiscovered; allowlist; safety flags.

---

## 5. Production observations

_(Filled after deploy — RO probes for instruments marketType + stream lifecycle; reconnect may be BLOCKED without authorized disconnect.)_

---

## 6. Safety locks

| Lock | Required | Observed |
|------|----------|----------|
| masterTradingEnabled | false | Unchanged |
| emergencyEntryLock | true | Unchanged |
| placesOrders | false | Restore/lifecycle APIs |
| acceptsForExecution | false | Same |
| FC trading DISABLED | yes | Unchanged |
| LIVE trading unauthorized | yes | DEMO restore only |
| AT allowlist XAU-only | yes | Unchanged |
| Broker mutations | none | No order APIs |

---

## 7. CI/CD / deploy

_(Filled after push.)_

---

## 8. Known blockers

1. Process restart still loses in-memory intended list (clients must re-`ensure`).  
2. Authorized same-env disconnect/reconnect production demo may be BLOCKED without admin action.  
3. Sidecar still stubs `marketType: FOREX` on raw Offers JSON — TS provider classifies on ingest.  
4. Quantity / CondDist / FX draft gates from 56.2.x remain.  
5. **Do not start 56.3.4 / 56.4 without owner approval.**

---

## 9. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`** — root causes fixed in code with synthetic coverage; production reconnect evidence depends on authorized session lifecycle; classification provenance shipped for MDS instruments.

*End of Phase 56.3.3 record.*
