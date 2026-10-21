# Phase 56.3.1 — Live Market Data Diagnostics and Safe Recovery

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect live Offers / simulation readiness  
**Document type:** Diagnostics + narrowly scoped safe recovery  
**Starting HEAD:** `5c3a6d6caf23db6049938c58a550ff93e3497fe0` (matched production `verifiedLive=true`)  
**Phase 56.2.9 baseline:** `PASS_WITH_KNOWN_BLOCKERS`; `liveReady=0`; interactive draft blocked by `FEED_NOT_LIVE`  
**Ending HEAD / deployed:** `7711d3aa552946ae0b42ccda8109932084ddb82c` (`verifiedLive=true`; feature `154022ce…`, CI **#404**/docs **#405**)  
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

### 6.2 Post-deploy (against `154022ce…` / docs `7711d3aa…`, `verifiedLive=true`)

| Check | Result |
|-------|--------|
| Catalog readiness | `phase=56.3.1`, `liveReady=0`, both `blockerId=no_active_session`, `placesOrders=false` |
| `subscribeLive=1` t0 | **Independent:** XAU `LIVE` `upd=2` `offers-table-diff`; EUR `MARKET_INACTIVE` `upd=0` `blockerId=seeded_snapshot_no_genuine_event` (XAU LIVE did not promote EUR) |
| ~8s later | `liveReady=2`; XAU bid moved `4133.73→4133.54` `upd=5`; EUR became `LIVE` `upd=3` — genuine Offers changes |
| AT Verify (authorized session) | Market data **PASS**; Ready for future analysis **PASS**; audit `verification_completed`; Master OFF; emergency ON |
| Simulation draft UI | May still list prior `FEED_NOT_LIVE` until draft is recalculated against the fresh verification — not an Offers outage |
| Responsive | 390: `overflowX=false`; Master OFF; `placesOrders=false` |
| Broker mutations | none |

**Cause of 56.2.9 `FEED_NOT_LIVE`:** AT/draft freshness evaluated without an active LIVE Offers session (catalog discovery alone never LIVE), not permanent Offers failure.

**Important:** Live recovery requires explicit subscribe (AT Verify / `subscribeLive=1` / live candles). Discovery alone must stay non-LIVE.

---

## 7. CI/CD / deploy

| Item | Value |
|------|-------|
| Feature commit | `154022ce6415f1870f0f975f78f6f14d89255596` |
| Docs finalize | `7711d3aa552946ae0b42ccda8109932084ddb82c` |
| GitHub Actions | **#404** success (`154022c`, ~2m 37s); **#405** success (`7711d3a`, ~2m 58s) |
| Actions index | https://github.com/byosemarket-ui/kwizera-AI/actions?query=branch%3Amain |
| Production `/api/deployment` | `deployedCommit=7711d3aa…`, `status=live`, `result=success`, `verifiedLive=true` |
| Health | `healthy` |

---

## 8. Safety locks (required = observed)

| Lock | Required | Observed |
|------|----------|----------|
| `masterTradingEnabled` / masterEnable | false | AT UI Master enable OFF |
| `emergencyEntryLock` | true | AT UI Emergency entry lock ON |
| `placesOrders` | false | Readiness API + AT draft `placesOrders=false` |
| `acceptsForExecution` | false | Readiness API + AT draft `acceptsForExecution=false` |
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

**`PASS_WITH_KNOWN_BLOCKERS`** — root cause proven (catalog/no-session path; Offers work when subscribed); diagnostics + settle shipped (`154022ce` / deploy `7711d3aa`, CI #404/#405); independent XAU/EUR LIVE confirmed; AT Verify recovers Market data PASS; quantity/CondDist/FX gates and full draft acceptance remain known blockers.

*End of Phase 56.3.1 record.*
