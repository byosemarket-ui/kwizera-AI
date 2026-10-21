# Phase 56.3.1 — Live Market Data Diagnostics and Safe Recovery

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect live Offers / simulation readiness  
**Document type:** Diagnostics + narrowly scoped safe recovery  
**Starting HEAD:** `5c3a6d6caf23db6049938c58a550ff93e3497fe0` (matched production `verifiedLive=true`)  
**Phase 56.2.9 baseline:** `PASS_WITH_KNOWN_BLOCKERS`; `liveReady=0`; interactive draft blocked by `FEED_NOT_LIVE`  
**Ending HEAD / deployed:** `154022ce6415f1870f0f975f78f6f14d89255596` (`verifiedLive=true`, CI **#404** success)  
**Scope:** Diagnostics and data-feed recovery only. **No execution. Do not start 56.3.2 / 56.4.**

---

## 1. Baseline verification

| Item | Evidence |
|------|----------|
| Local HEAD at start | `5c3a6d6c…` on `main` |
| Production `/api/deployment` | `deployedCommit=5c3a6d6c…`, `verifiedLive=true`, `status=live` |
| Health | `healthy` / `ok=true` |
| Unrelated dirty files | PMV/typography/video — **preserved** (not staged) |

---

## 2. Exact `FEED_NOT_LIVE` source path

| Layer | Path |
|-------|------|
| Emission | `evaluateVerificationQuoteFreshness` in `ai/forex-ai/automated-trading/quote-freshness.ts` when `market.feedStatus !== "LIVE"` |
| Remaps | `STALE`→`QUOTE_AGE_EXCEEDED`; `NO_RECENT_MARKET_UPDATES`→`HEARTBEAT_ONLY_NO_PRICE_CHANGE`; `SUBSCRIBING`/`UNKNOWN_SESSION`→`NO_QUOTE_UPDATES`; other non-LIVE (e.g. `MARKET_INACTIVE`) remain **`FEED_NOT_LIVE`** |
| LIVE gate | `resolveFcFeedStreamState`: `updateCount > 0` **and** `priceChangeAgeMs ≤ 15_000` |
| Genuine events only | `eventSource` ∈ `offers-callback` \| `offers-table-diff` (`isGenuineFcOfferEventSource`) |
| Seeded snapshots | Subscribe seed **without** `eventSource` — never LIVE |
| Heartbeats | Same-price receipt refresh — `NO_RECENT_MARKET_UPDATES`, not LIVE |

Lifecycle:

```
ensure/subscribe → sidecar Offers subscribe_table_updates
  → poll /quotes → genuine bid/ask change
  → updateCount++ / lastPriceChangeAtMs
  → streamState LIVE (≤15s)
  → AT verification market.feedStatus
  → evaluateVerificationQuoteFreshness
```

---

## 3. Proven cause(s)

### 3.1 Catalog readiness without active session (confirmed)

`GET …/instrument-readiness` **without** `subscribeLive=1` evaluates catalog discovery only. Active live sessions are included when already present; otherwise `live=null` → `liveFeedReady=false`.

**This is honest, not a false negative inventing LIVE.** Phase 56.2.9 `discovered=2 liveReady=0` with catalog-only probes matches this design.

### 3.2 Readiness `subscribeLive` lacked settle polls (code defect — fixed)

AT `verify` already settle-polls 3×400ms after `ensure` for genuine Offers changes.  
`MarketDataService.getInstrumentReadiness({ subscribeLive: true })` called `ensure` **once** and evaluated immediately — often while only a **seeded** snapshot existed (`updateCount=0`, no `eventSource`).

**Fix (56.3.1):** after each `ensure` under `subscribeLive`, apply the same settle loop as AT verify. Still **does not invent LIVE** if the provider stays quiet.

### 3.3 Quiet / non-publishing Offers (environmental — not weakened)

If Offers never deliver a genuine bid/ask change within the settle window and 15s freshness policy, readiness and AT correctly remain blocked (`seeded_snapshot_no_genuine_event` / `FEED_NOT_LIVE` / heartbeat-only). **Freshness thresholds were not relaxed.**

### 3.4 Independent instruments

XAU/USD and EUR/USD evaluate independently. Peer LIVE never promotes another symbol.

---

## 4. Changes made

| Change | Purpose |
|--------|---------|
| `feed-diagnostics.ts` | Precise blocker ids: `no_active_session`, `seeded_snapshot_no_genuine_event`, `heartbeat_only_no_price_change`, `quote_stale`, etc. |
| `evaluate.ts` + `types.ts` | Expose `feedDiagnostics` / quote.diagnostics; phase tag `56.3.1` |
| `live-service.listActiveQuoteSessions` | Add `eventSource`, absolute last change/receipt timestamps |
| `market-data-service` readiness | Settle polls on `subscribeLive`; pass `subscriptionRequested` |
| Tests | `phase56-3-1-live-feed-diagnostics.test.ts` (synthetic) |

**Not changed:** freshness 15s policy; execution allowlist; master/emergency locks; ForexConnect trading DISABLED.

---

## 5. Tests

| Suite | Scope | Result |
|-------|-------|--------|
| `phase56-3-1-live-feed-diagnostics.test.ts` | Synthetic diagnostics / independence / FEED_NOT_LIVE remaps / safety | **9/9 PASS** (local vitest) |
| `phase56-2-8-instrument-readiness.test.ts` | Regression | **8/8 PASS** (local vitest) |

Synthetic fixtures are **not** production Offers evidence.

---

## 6. Production observations

### 6.1 Pre-ship (against `5c3a6d6c…`)

| Check | Result |
|-------|--------|
| Catalog readiness XAU+EUR | `discovered=2`, `liveReady=0`, `NO_DATA` |
| `subscribeLive=1` | `liveReady=2` with LIVE bid/ask (Offers publishing when subscribed) |

### 6.2 Post-deploy (against `154022ce…`, `verifiedLive=true`)

| Check | Result |
|-------|--------|
| Catalog readiness | `phase=56.3.1`, `liveReady=0`, both symbols `feedDiagnostics.blockerId=no_active_session`, `sessionActive=false`, `placesOrders=false` |
| `subscribeLive=1&timeframe=1m` | `liveReady=2`; XAU `LIVE` bid/ask `4133.94/4134.24` `upd=1` `eventSource=offers-callback`; EUR `LIVE` `1.12328/1.12341` `upd=1` `offers-callback`; `executionAuthorized=false` |
| ~13s later (active sessions) | XAU bid **4133.94→4134.77**, `upd=157`; EUR `upd=71` `eventSource=offers-table-diff` — genuine independent updates |
| AT UI `/forex/automated-trading` | Loads; banner `AUTOMATED EXECUTION NOT IMPLEMENTED`; admin session **Not authorized** this pass |
| Responsive | 390 / 768 / 1024 / 1440: `overflowX=false` |
| AT Verify / draft with admin token | **BLOCKED** (no token stored) |

**Cause of 56.2.9 `FEED_NOT_LIVE`:** AT/draft freshness evaluated without an active LIVE Offers session (catalog discovery alone never LIVE), not permanent Offers failure.

**Important:** Live recovery requires explicit subscribe (AT Verify / `subscribeLive=1` / live candles). Discovery alone must stay non-LIVE.

---

## 7. CI/CD / deploy

| Item | Value |
|------|-------|
| Feature commit | `154022ce6415f1870f0f975f78f6f14d89255596` |
| GitHub Actions | Production deploy **#404** — completed successfully (~2m 37s) |
| Actions index | https://github.com/byosemarket-ui/kwizera-AI/actions?query=branch%3Amain |
| Production `/api/deployment` | `deployedCommit=154022ce…`, `status=live`, `result=success`, `verifiedLive=true` |
| Health | `healthy` |

---

## 8. Safety locks (required = observed)

| Lock | Required | Observed |
|------|----------|----------|
| `masterTradingEnabled` / masterEnable | false | Code unchanged; AT controls not loaded without admin token this pass |
| `emergencyEntryLock` | true | Code unchanged |
| `placesOrders` | false | Readiness API `placesOrders=false` |
| `acceptsForExecution` | false | Readiness API `acceptsForExecution=false` |
| ForexConnect trading | DISABLED | Unchanged |
| LIVE trading | unauthorized | Unchanged |
| Broker mutations | none | RO deployment/health/readiness only |

---

## 9. Remaining blockers / next

1. Genuine Offers price changes required for LIVE — quiet/seeded markets stay blocked honestly.  
2. Quantity / CondDist / FX gates from 56.2.5–56.2.7 remain.  
3. Authorized AT status / Verify with admin token for full draft retest — deferred if token unavailable.  
4. **Do not start 56.3.2 / 56.4 without owner approval.**

---

## 10. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`** — root cause proven (no active LIVE session / catalog-only path); diagnostics + `subscribeLive` settle shipped and verified on production (`154022ce`, CI #404); Offers deliver genuine independent XAU/EUR updates when subscribed; admin-gated AT draft retest remains BLOCKED without token; quantity/CondDist/FX gates unchanged.

*End of Phase 56.3.1 record.*
