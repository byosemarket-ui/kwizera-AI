# Phase 56.2.8 — Market-Agnostic Data Engine, Multi-Market Connectivity & Production Readiness

**Project:** KWIZERA AI STUDIO  
**Module:** Unified market-data + ForexConnect Automated Trading  
**Document type:** Architecture + production readiness record  
**Starting HEAD:** `7494d40975db639b8085be70e97b563f5c0d1920`  
**Production baseline at start:** `deployedCommit=7494d409…`, `verifiedLive=true`  
**Feature HEAD:** `7f93255abc5637b91208b819e33d63fef248045f`  
**Ending HEAD / deployed:** _(symbol-lookup fix + this finalize; filled after verifiedLive)_  
**Scope:** Market-data infrastructure + simulation readiness. **No execution. LIVE unauthorized. Do not start 56.2.9 / 56.3.**

---

## 1. Baseline (inspected)

| Item | Value |
|------|-------|
| Branch | `main` |
| Starting SHA | `7494d40975db639b8085be70e97b563f5c0d1920` |
| Worktree | Unrelated dirty: PMV / typography / video (preserved) |
| Prior phase | 56.2.7 `PASS_WITH_KNOWN_BLOCKERS` — `FEED_NOT_LIVE` on XAU/USD simulation gates |
| Existing stack | Phase 31 `MarketDataService` + instrument registry; FC live Offers service; Binance/FXCM/FC adapters |

---

## 2. Verified root cause of `FEED_NOT_LIVE`

### Evidence

1. Quote freshness (`quote-freshness.ts`) returns non-fresh whenever verification `market.feedStatus !== "LIVE"` (even when Bid/Ask exist). Mapped reasons now preserve STALE / heartbeat specificity where possible.
2. LIVE requires a **genuine Offers bid/ask change** within 15s (`resolveFcFeedStreamState` / sidecar). Seeded snapshots and same-price heartbeats are never LIVE.
3. **Timeframe alias bug (production path):** Automated Trading Verify defaulted to ForexConnect period id `m1`, while `ForexConnectLiveCandleService.ensure()` only accepts project ids (`1m`, `5m`, …).  
   - UI previously: `timeframe: props.timeframe || "m1"`  
   - Service previously: `input.timeframe ?? "m1"`  
   Invalid TF → subscribe/`ensure` failure or never reaching a healthy live session; remaining Bid/Ask often come from seeds while status stays non-LIVE → `FEED_NOT_LIVE`.

### What this is not

- Not “XAU/USD-only is broken.”
- Not fixed by widening stale thresholds or forcing READY without a verified price change.
- Connected broker session ≠ all instruments LIVE.

### Fix (this phase)

- `resolveForexConnectLiveTimeframe()` maps `m1`→`1m`, `H1`→`1h`, etc.
- AT verify + UI default to project TF (`1m` / monitor TF).
- Short settle polls after `ensure` (still fail-closed if Offers never change).
- Per-instrument readiness module so one symbol’s state cannot mask another.
- Readiness symbol lookup hydrates full catalog then resolves by provider symbol (avoids false UNAVAILABLE when catalog was truncated).

---

## 3. Architecture

| Layer | Role |
|-------|------|
| `MarketInstrumentRegistry` (Phase 31) | Shared catalog; provider+symbol identity retained |
| Provider adapters (Binance / FXCM / ForexConnect) | Capability-declared discovery & data |
| `ForexConnectLiveCandleService` | Per-session Offers stream; `listActiveQuoteSessions()` |
| `instrument-readiness/` (56.2.8) | Independent READY/STALE/… evaluation + catalog summary |
| `GET /api/forex/market-data/instrument-readiness` | Admin/status probe |
| Forex Admin FC page | Compact readiness probe table |

Statuses distinguished: **discovered** · **data-supported** · **live-feed-ready** · **analysis-ready** · **simulation-ready** · **execution-authorized** (always `false` here).

Freshness default: **15 000 ms** genuine price-change age — source `FOREXCONNECT_STALE_MS` / `MARKET_QUOTE_STALE_MS`. Documented in `freshness-policy.ts`.

---

## 4. Provider capability matrix (declared, not claimed universal)

| Provider | Discovery | Historical | Quotes/stream | Trading |
|----------|-----------|------------|---------------|---------|
| FOREXCONNECT | Yes (Offers) | Yes (get_history) | Offers subscribe | **DISABLED** |
| FXCM (legacy path) | Config-dependent | Config-dependent | Config-dependent | **DISABLED** |
| BINANCE | Public | Public klines | Browser ticker / REST | **DISABLED** |

Unsupported capability → `UNSUPPORTED` / `UNAVAILABLE`, never fabricated candles or prices.

---

## 5. Production measurements (read-only)

| Check | Result |
|-------|--------|
| `/api/deployment` (feature `7f93255a`) | `verifiedLive=true`, `result=success`, `status=live`, timestamp `2026-10-21T12:22:32.637Z` |
| `/api/health` | `ok=true`, `status=healthy` |
| CI Production deploy #397 | https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39598672846 — **success** on `7f93255a` |
| `GET /api/forex/market-data/instruments?provider=FOREXCONNECT&limit=20` | `ok=true`, `count=20` (catalog path works; full catalog larger) |
| `GET …/instrument-readiness?provider=FOREXCONNECT&symbols=XAU/USD,EUR/USD` (pre-lookup-fix on `7f93255a`) | API **200**; `placesOrders=false`; `acceptsForExecution=false`; symbols reported `discovered=false` due to truncated-catalog lookup bug (fixed in follow-up commit) |
| Unauthenticated AT status | Admin gate remains (403 without token) |

No broker mutations performed.

---

## 6. Safety locks

| Lock | Required | Observed |
|------|----------|----------|
| `masterTradingEnabled` | false | Unchanged |
| `emergencyEntryLock` | true | Unchanged |
| `placesOrders` | false | Readiness + AT APIs |
| `acceptsForExecution` | false | Readiness + AT APIs |
| ForexConnect trading | DISABLED | Unchanged |
| LIVE trading | unauthorized | Unchanged |
| XAU execution allowlist | preserved | Not broadened |

---

## 7. Tests

| Suite | Result |
|-------|--------|
| `tests/unit/ai/market-data/phase56-2-8-instrument-readiness.test.ts` | **8/8** expected after lookup-fix commit (was 7/7 on feature) |

Synthetic fixtures only; not production evidence.

---

## 8. Remaining blockers / next phase

1. Live READY still requires real Offers price changes after correct subscribe — quiet markets stay PARTIALLY_READY / STALE honestly.  
2. Quantity / CondDist / non-USD FX gates from 56.2.5–56.2.7 remain.  
3. Full interactive admin readiness probe with `subscribeLive=1` needs authorized admin session (token not stored in this phase).  
4. Recommended next (owner-approved only): 56.2.9 metadata attestation / broader simulation readiness — **not started automatically**.

---

## 9. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`** — TF alias root cause fixed and deployed (`7f93255a`); market-agnostic readiness API/admin surface shipped; execution locks unchanged; live READY and full multi-instrument live counts still depend on genuine Offers activity + authorized subscribe probes; catalog symbol-lookup truncation fixed in follow-up.

*End of Phase 56.2.8 record.*
