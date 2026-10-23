# Phase 57.7 — Selected-Market Live Data, Charts & AI Analysis Certification

**Project:** KWIZERA AI STUDIO  
**Module:** Forex selected-market → charts → AI Analysis  
**Phase:** 57.7  

**Final verdict:** `PASS_WITH_KNOWN_BLOCKERS`

> Certifies market-selection-to-chart live path and Local AI snapshot generation. Broker execution remains **DISABLED**. Historical candles alone are not treated as a continuous Offers soak.

---

## 1. SHAs

| Item | SHA |
|------|-----|
| Baseline (Phase 57.6 feature) | `79418bb2` |
| Baseline (Phase 57.6 documentation) | `955dd9ed` |
| Repo HEAD at certification start | `955dd9ed` |
| Deployed at live checks | `955dd9ed` (`verifiedLive=true`) |
| Phase 57.7 feature (schema-echo normalize + tests) | _(fill on commit)_ |
| Phase 57.7 documentation | _(fill on commit)_ |

---

## 2. Selected-market data flow

```text
Markets / URL ?symbol&provider&timeframe
  → ForexShell.selectMarket / writeMarketQuery
  → SelectedMarket (venue, symbol, displaySymbol, provider)
  → ForexChartWorkspace / useUnifiedCandles
  → GET /api/forex/market-data/candles (unified MarketDataService)
  → Binance: HISTORICAL klines + browser miniTicker/kline WS overlay
  → FXCM/FOREXCONNECT: mode=live poll (not primary path this phase)
  → Chart render (instrument + TF identity)

Same SelectedMarket
  → ForexAiAnalysisPage
  → POST /api/forex/analysis-snapshot
  → POST /api/forex/ai-analysis/local (Ollama llama3.2:1b)
  → normalizeLocalAnalysisFromModel → UI
```

| Step | Component | Input | Output | Evidence |
|------|-----------|-------|--------|----------|
| Selection | `selected-market.ts` / ForexShell | URL / Markets pick | `SelectedMarket` | SPA Selected Market bar |
| Mapping | `parseSelectedMarket` | symbol, provider | BINANCE / FXCM / FOREXCONNECT / unsupported | Unit + live BTC/ETH |
| Candles API | `studio-unified-candles-client.ts` | provider, symbol, TF | series + identity | API JSON identity.providerSymbol |
| Stale discard | `use-unified-candles.ts` | generation ref | drop late responses | Code + regression test |
| Chart UI | ForexChartWorkspace | selected market | candlesticks + LIVE ticker | Prod SPA screenshots |
| Snapshot | analysis-snapshot engine | provider/symbol/TF/period | immutable snapshot | API `evidenceReady=true` |
| Local AI | snapshot-local engine | snapshotId + fingerprint | analysis + model | API `model=llama3.2:1b` |

---

## 3. Market-data integrity

| Check | Result |
|-------|--------|
| Deploy | `GET /api/deployment` → `deployedCommit=955dd9ed…`, `verifiedLive=true` |
| Binance REST | `CONNECTED`, `restReachable=true`, `liveMarketData=false` (server WS not streaming) |
| Candles BTCUSDT 1h | identity `BTCUSDT` / BINANCE / `sourceMode=HISTORICAL` / `dataQuality=VALID` |
| Candles ETHUSDT 15m | identity `ETHUSDT` / BINANCE / timeframe `15m` |
| Server quote API | `quote=null` for Binance (live quotes on **browser** miniTicker path) |
| Snapshot quote freshness | `HISTORICAL_ONLY` when `requireLiveQuote=false` (honest, not fabricated LIVE) |
| Continuous Offers soak | `UNVERIFIED` (out of short certification window) |

---

## 4. Chart certification (production SPA)

| Step | Result |
|------|--------|
| Open `/forex/charts?symbol=BTCUSDT&provider=BINANCE&timeframe=1h` | Selected Market `BTC/USDT · Binance Spot`; candlesticks; **LIVE** / **Price LIVE** miniTicker |
| Switch TF → 15m | URL `timeframe=15m`; title `BTC/USDT · 15m · Binance Spot klines`; loading then LIVE forming candle |
| Switch instrument → ETHUSDT 15m | Selected Market `ETH/USDT`; price ~2407 (not BTC 81k); no BTC candle leak |
| Empty / no selection | Expected empty messaging (prior phase); not re-blocked this window |
| Late-response overwrite | Guarded by `generation` in `useUnifiedCandles` (code + unit) |

**Chart path:** `PASS_WITH_KNOWN_LIMITATIONS`  
Limitation: Binance “LIVE” on charts is browser ticker/kline overlay + historical unified series; server-side Binance WS not active. Long-duration continuity `UNVERIFIED`.

---

## 5. AI Analysis generation round-trip

| Step | BTC 7d/1h | ETH 24h/15m |
|------|-----------|-------------|
| Request accepted | yes | yes |
| Snapshot built | `evidenceReady=true`, 169 candles | `evidenceReady=true`, 97 candles |
| Identity | BTC/USDT 1h 7d | ETH/USDT 15m 24h |
| Model invocation | attempted (`llama3.2:1b`) | attempted + completed |
| Model response | **timeout 120057 ms** → HTTP 422, `status=failed`, honest error | HTTP 200, `status=completed`, ~91s |
| Validated / serialized | failed analysis payload with limitations | completed analysis; decision `WAIT` |
| UI rendered | SPA: ETH/USDT, AI_READY, snapshot prepared | SPA Local AI: market summary ETH/USDT SIDEWAYS rendered; this SPA run timed out at 120s (honest); API success earlier |
| Journal persisted | local analysis store save on server (API path); SPA journal UI not deeply audited | same |

**Invalid period probe:** `analysisPeriod=1d` → `INVALID_ANALYSIS_PERIOD` (allowed: 5m…24h…7d, custom). Honest error.

**AI path:** `PASS_WITH_KNOWN_LIMITATIONS`  
- Successful Local AI generation verified on ETH 24h/15m.  
- Larger 7d/1h windows may exceed default 120s timeout on `llama3.2:1b`.  
- Small models may echo JSON schema; Phase 57.7 normalizes schema-echo `dataQuality` / `marketBias`.

---

## 6. Defects repaired

| Defect | Root cause | Fix |
|--------|------------|-----|
| Local AI returned `dataQuality:"string"` and `marketBias:"BULLISH\|BEARISH\|…"` | Small model echoes prompt schema placeholders; prior normalize used `asString` only | `normalizeDataQuality` / `normalizeMarketBias` reject schema echoes; fall back to evidence validation / `UNCERTAIN` |

Files:
- `ai/forex-ai/snapshot-local/validate-result.ts`
- `tests/unit/desktop/forex/phase57-7-selected-market-charts-ai.test.ts`

---

## 7. Tests

```text
node ./node_modules/vitest/vitest.mjs run \
  tests/unit/desktop/forex/phase57-7-selected-market-charts-ai.test.ts --reporter=dot
→ 1 file; 11 tests passed; exit 0

node ./node_modules/vitest/vitest.mjs run \
  tests/unit/ai/forex-ai/snapshot-local-phase43d.test.ts --reporter=dot
→ 1 file; 6 tests passed; exit 0

Combined: 2 files / 17 tests passed
```

Coverage includes: selected-market mapping, generation stale-discard wiring, HISTORICAL≠LIVE client rule, schema-echo normalization, AI page seq guards, `placesOrders`/`acceptsForExecution` hard-false in automation service.

---

## 8. Safety invariants (production AT SPA read)

Observed on `/forex/automated-trading` (authorized session UI):

```text
placesOrders = false
acceptsForExecution = false
execution status = EXECUTION_FORBIDDEN
Broker execution: Forbidden / DISABLED
emergencyEntryLock = ON
Entry generation = OFF
mutatesBroker = false
simulationOnly = true
```

**Note:** UI also showed **Master enable: ON (config)** with product warning “must stay OFF for broker safety”. Broker mutation remains blocked (`placesOrders=false`, `EXECUTION_FORBIDDEN`). Ideal invariant `masterTradingEnabled=false` is **not** confirmed for the config flag this window — report as **config deviation / owner follow-up**; do not flip controls without explicit approval. No broker order submitted.

---

## 9. Unverified / blocked / remaining

| Item | Status | Reason |
|------|--------|--------|
| Long Offers continuity soak | `UNVERIFIED` | Not timed this phase |
| AI Analysis SPA Local AI full render after generate | `PASS_WITH_KNOWN_LIMITATIONS` | SPA instrument/AI_READY/controls verified; successful generate certified via API (ETH 24h); large 7d windows may timeout |
| Deep Forex Admin audit | `UNVERIFIED` | Out of scope |
| FXCM/FC chart live path | `UNVERIFIED` | Binance path certified |
| Continuous server Binance WS | `BLOCKED` / limited | `liveMarketData=false` on server status |
| Large-window Local AI (7d/1h) | `PASS_WITH_KNOWN_LIMITATIONS` | Timeout at default 120s |

Unrelated dirty PMV/typography files preserved, not committed.

---

## 10. Next recommended step

Owner-approved: (1) confirm Master enable config OFF without changing execution authorization; (2) optional Local AI timeout/capacity tuning for larger windows; (3) optional Offers soak. Do not enable broker execution without explicit approval.
