# Phase 56.3.5 — Controlled Recovery Acceptance & Restart Verification

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect market-data recovery acceptance  
**Document type:** Controlled acceptance (market-data only)  
**Starting HEAD / prod:** `d04a7c786121fbc0089dbd949712269ab9d31742` (`verifiedLive=true`)  
**Ending HEAD / deployed:** _(filled after CI)_  
**Scope:** Acceptance A–D. **No execution. Do not start 56.3.6 / 56.4.**

---

## 1. Baseline

| Item | Evidence |
|------|----------|
| Production start | `d04a7c78…`, `verifiedLive=true` |
| Persistence | `enabled=true`, basename `intended-subscriptions.json` (full path not echoed) |
| Unrelated dirty | PMV/typography/video — preserved |

---

## 2. Defect found & fixed

**Root cause:** `toSeries()` re-applied receipt-age freshness after `markAllSessionsDisconnected`, rewriting sticky `DISCONNECTED` to `NO_RECENT_MARKET_UPDATES` when residual `lastQuoteAtMs` was still young.

**Fix:** Preserve hard provider-loss states (`DISCONNECTED` / `ERROR` / `SERVICE_UNAVAILABLE` / `DISABLED`) in `toSeries` until reconnect restore.

---

## 3. Acceptance matrix

| ID | Criterion | Environment | Result |
|----|-----------|-------------|--------|
| A | Persist intent; slash symbols; no FAKE; no secrets; corrupt fails safe | Synthetic + prod RO metadata | **PASS** |
| B | Controlled disconnect → stale → single-flight restore → fresh LIVE | Synthetic (vitest mock bridge) | **PASS** |
| B | Same cycle on production | Production | **BLOCKED** — admin `POST …/disconnect` not authorized; outage not induced |
| C | Process restart hydrate; no LIVE until fresh tick; FAKE skipped | Synthetic (temp store + new service) | **PASS** |
| C | Production gateway/service restart | Production | **BLOCKED** — no authorized restart |
| D | Per-instrument isolation; US30 INDEX; FAKE undiscovered; allowlist | Synthetic + prod RO | **PASS** |

---

## 4. Tests

| Suite | Category | Result |
|-------|----------|--------|
| `phase56-3-5-controlled-recovery-acceptance.test.ts` | controlled synthetic | **5/5 PASS** |
| `phase56-3-4-persistence-and-restart.test.ts` | synthetic | **7/7 PASS** |
| `phase56-3-3-reconnect-and-metadata.test.ts` | synthetic | **9/9 PASS** |
| Combined light local | synthetic | **21/21 PASS** |

---

## 5. Production RO observations

- Persistence enabled; writes after subscribeLive; FAKE not in intended.
- XAU/EUR/US30/GBP can be LIVE; XAG independently blocked (`seeded_snapshot_no_genuine_event`); FAKE `no_active_session`.
- US30 `marketType=INDEX` (raw FOREX); GBP/USD `FOREX`.
- `placesOrders=false`, `acceptsForExecution=false`, `trading=DISABLED`, `EXECUTION_FORBIDDEN` on place-order.
- Store file contents **not** dumped.

---

## 6. Safety locks

| Lock | Observed |
|------|----------|
| placesOrders | false |
| acceptsForExecution | false |
| EXECUTION_FORBIDDEN | 403 |
| FC trading | DISABLED |
| Allowlist | XAU-only (unchanged) |
| masterTradingEnabled / emergencyEntryLock | Unchanged; no control mutation (UI browser probe skipped per RO policy) |

---

## 7. Known blockers

1. Production disconnect/reconnect cycle **BLOCKED** (no authorized admin disconnect).  
2. Production process restart **BLOCKED** (no authorized service restart).  
3. Quantity / CondDist / FX draft gates remain.  
4. **Do not start 56.3.6 / 56.4 without owner approval.**

---

## 8. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`** — controlled-environment acceptance A/B/C/D demonstrated; production B/C restart/disconnect evidence explicitly BLOCKED.

*End of Phase 56.3.5. STOP.*
