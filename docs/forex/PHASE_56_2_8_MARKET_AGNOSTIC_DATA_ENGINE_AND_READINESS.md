# Phase 56.2.8 — Market-Agnostic Data Engine, Multi-Market Connectivity & Production Readiness

**Project:** KWIZERA AI STUDIO  
**Module:** Unified market-data + ForexConnect Automated Trading  
**Document type:** Architecture + production readiness record  
**Starting HEAD:** `7494d40975db639b8085be70e97b563f5c0d1920`  
**Production baseline at start:** `deployedCommit=7494d409…`, `verifiedLive=true`  
**Ending HEAD / deployed:** _(filled at ship)_  
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

1. Quote freshness (`quote-freshness.ts`) returns `FEED_NOT_LIVE` whenever verification `market.feedStatus !== "LIVE"` (even when Bid/Ask exist).
2. LIVE requires a **genuine Offers bid/ask change** within 15s (`resolveFcFeedStreamState` / sidecar). Seeded snapshots and same-price heartbeats are never LIVE.
3. **Timeframe alias bug (production path):** Automated Trading Verify defaulted to ForexConnect period id `m1`, while `ForexConnectLiveCandleService.ensure()` only accepts project ids (`1m`, `5m`, …).  
   - UI: `timeframe: props.timeframe || "m1"`  
   - Service: `input.timeframe ?? "m1"`  
   Invalid TF → subscribe/`ensure` failure or never reaching a healthy live session; remaining Bid/Ask often come from seeds/peers while status stays non-LIVE → `FEED_NOT_LIVE`.

### What this is not

- Not “XAU/USD-only is broken.”
- Not fixed by widening stale thresholds or forcing READY without a verified price change.
- Connected broker session ≠ all instruments LIVE.

### Fix (this phase)

- `resolveForexConnectLiveTimeframe()` maps `m1`→`1m`, `H1`→`1h`, etc.
- AT verify + UI default to project TF (`1m` / monitor TF).
- Short settle polls after `ensure` (still fail-closed if Offers never change).
- Per-instrument readiness module so one symbol’s state cannot mask another.

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

Freshness default: **15 000 ms** genuine price-change age — source `FOREXCONNECT_STALE_MS` / `MARKET_QUOTE_STALE_MS`. Documented in `freshness-policy.ts`; not a silent universal invention for every future venue.

---

## 4. Provider capability matrix (declared, not claimed universal)

| Provider | Discovery | Historical | Quotes/stream | Trading |
|----------|-----------|------------|---------------|---------|
| FOREXCONNECT | Yes (Offers) | Yes (get_history) | Offers subscribe | **DISABLED** |
| FXCM (legacy path) | Config-dependent | Config-dependent | Config-dependent | **DISABLED** |
| BINANCE | Public | Public klines | Browser ticker / REST | **DISABLED** |

Unsupported capability → `UNSUPPORTED` / `UNAVAILABLE`, never fabricated candles or prices.

---

## 5. Safety locks

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

## 6. Tests

| Suite | Result |
|-------|--------|
| `tests/unit/ai/market-data/phase56-2-8-instrument-readiness.test.ts` | **7/7 passed** (local vitest; synthetic) |

Synthetic fixtures only; not production evidence.

---

## 7. CI/CD / production verification

_(Filled after push / verifiedLive.)_

---

## 8. Remaining blockers / next phase

1. Live READY still requires real Offers price changes after correct subscribe — quiet markets stay PARTIALLY_READY / STALE honestly.  
2. Quantity / CondDist / non-USD FX gates from 56.2.5–56.2.7 remain.  
3. Recommended next (owner-approved only): 56.2.9 metadata attestation / broader simulation readiness — **not started automatically**.

---

## 9. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`** (pending production deploy verification after ship) — root-cause TF alias fixed; market-agnostic readiness shipped; live READY still depends on genuine Offers updates; execution locks unchanged.

*End of Phase 56.2.8 record.*
