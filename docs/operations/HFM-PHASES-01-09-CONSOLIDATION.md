# HFM MT5 Analysis Engine — Phases 01–09 Consolidation Register

**Scope:** Master Analysis Engine Upgrade Phases 01–09 (not automated-trading PHASE_56–59).  
**Authoritative requirements source:** Owner MASTER IMPLEMENTATION PROMPTs (Cursor agent transcripts) + in-repo `contracts.ts` + this register.  
**There is no single git-tracked Master Plan markdown for 01–09.** Specs are recovered from transcripts and encoded in contracts/tests.

**Phase 09 tip:** `0c54f32fe0a4da39eee184c761775bd4a631b762`  
**Consolidation tip (deployed):** `bd5e70ca0f0efce889c206e5cabb2b983645d7ff`  
**Safety (non-negotiable):** Execution Master OFF · Emergency lock ON · OD OFF · Auto Analysis OFF · ForexConnect stopped · no broker orders · no Phase 10.

---

## Activation / configuration register

| Capability | State | Reason |
|---|---|---|
| HFM MT5 demo quotes/candles | Active | Authoritative Forex source |
| UME / market-evidence adapters | Active | Phase 02 |
| Charts probability | NOT_AVAILABLE / skipProbability | Phase 03 semantic guard |
| Probability calibration claims | Disabled (`isProbabilityCalibration: false`) | Insufficient eligible pairs / policy |
| OD continuous worker | Disabled | Policy + isolation |
| Auto Analysis scheduler | OFF | Policy |
| Phase 04 lifecycle monitor continuous | Disabled | Use run-once only |
| Phase 05 buyer/seller pressure | Active (proxy) | Tick volume ≠ aggressor flow |
| Phase 06 deep technical | Active (partial) | Elliott/MACD/ADX/BB/flags NOT_IMPLEMENTED |
| Phase 07 calendar live ingestion | Disabled | Configuration / policy |
| Phase 07 news / CB / cross-asset | NOT_IMPLEMENTED | No paid providers |
| Phase 08 strategy research | Active (request-driven) | RESEARCH_ONLY |
| Phase 08 continuous research worker | DISABLED_BY_POLICY | Explicit |
| Phase 09 research reliability | Active (request-driven) | Continuous worker disabled |
| ForexConnect | Stopped + disabled | Isolation |
| Binance Forex fallback | Forbidden | Provider gate |

---

## Deferred (explicit — not defects)

- Elliott Wave, MACD, ADX, Bollinger, flags/pennants/channels, supply/demand zones (unless later authorized)
- Live economic calendar ingestion; paid news/central-bank feeds
- Continuous OD / lifecycle / reliability / research workers
- Broker execution / Auto Trading / Execution Master
- True order-book / aggressor-signed volume

---

## Remediation log (consolidation)

| ID | Severity | Issue | Fix |
|---|---|---|---|
| C-01 | P2 | Ops probes used `POST .../realtime/subscribe` → NOT_FOUND | Compat alias → `/subscriptions` + isolation doc |
| C-02 | P2 | Live-only reliability (no candles) returned `RESEARCH_BLOCKED` | Gate maps `dataset_missing` → `INSUFFICIENT_DATA` |
| C-03 | P3 | Consolidation register missing in-repo | This document |

No P0/P1 production outages identified in consolidation audit beyond known post-restart quote warmup.
