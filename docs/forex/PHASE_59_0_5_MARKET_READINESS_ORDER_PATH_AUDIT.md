# Phase 59.0.5 — KOMEZA: Market Readiness, Order-Path Audit & Trade Monitor Integration

**Date:** 2026-10-26  
**Deployed commit (unchanged):** `1e4e5903`  
**Verdict:** `PARTIALLY VERIFIED`  
**Safety:** No broker mutation · no grant · no commit/push/deploy · ordinary AT remains `DisabledBrokerMutationAdapter`

---

## 1. Research summary

### Confirmed by official FXCM documentation
- ForexConnect API is a free TSII-compatible SDK (C++/C#/Java/Python/etc.) for streaming prices, orders, positions, history, reports.
- Connect uses Hosts.jsp + username/password + `Connection=demo|…`.
- Prefer current ForexConnect / Gehtsoft samples; **O2G2 namespace is deprecated** (not updated since ~2015).
- Table manager vs non-table manager trade-offs documented by FXCM.
- Official samples (`OpenPosition.py`) show: `Common.get_account` → `Common.get_offer` → `trading_settings_provider.get_base_unit_size` → `amount = base_unit_size * lots` → `create_order_request(TRUE_MARKET_OPEN, ACCOUNT_ID, BUY_SELL, AMOUNT, SYMBOL)` → `send_request` → correlate `resp.order_id` with Orders + Trades table listeners (`open_order_id`).

### Confirmed by this repository
- Sidecar wraps installed `forexconnect` Python SDK; stream stamps `trading: "DISABLED"`.
- Quote readiness (59.0.3): CONNECTED alone never `readyForExecutionQuote`; needs fresh valid bid/ask + age ≤ 15s.
- Ordinary Automated Trading permanently uses `DisabledBrokerMutationAdapter` (`placesOrders=false`, `acceptsForExecution=false`).
- Separate grant-scoped DEMO mutation path exists (`mutation_demo.py` + demo-execution) behind env + secret + DEMO session + grant; **not exercised this phase**.
- Phase 60 Trade Monitor maps RO `/orders`, `/trades`, `/closed-trades` with distinct `orderId` vs `tradeId`.

### Still unknown / needs account-session evidence
- Live **account row** (masked) via broker Accounts table — requires admin-protected RO tables probe (not run without authorized admin token in this session).
- Live `baseUnitSize` / MMR / min quantity for XAU on this account at order time (code reads TradingSettings; not re-probed live here).
- Broker-specific order-status enum values beyond opaque `status` string on Orders rows.
- Whether Offers expose a distinct broker event timestamp (current path: receipt time ≈ source time).

### Unsupported assumptions (must not authorize an order)
- Calendar “market open” ⇒ LIVE ticks.
- Snapshot / listener / subscription ACK ⇒ fresh executable quote.
- Same-price poll heartbeat ⇒ price change.
- HTTP 200 / local plan construction ⇒ broker acceptance or fill.
- Missing trade row ⇒ order cancelled (or vice versa).
- Enabling DEMO mutation env ⇒ ordinary AT may place orders (globals must stay false).

---

## 2. Live read-only market evidence (production)

| Check | Result |
|-------|--------|
| Deployed SHA | `1e4e59032ec8d86b0126c488e7cccac197c89632` (`verifiedLive`) |
| Environment | `demo` / FXCM DEMO |
| Session | `CONNECTED` |
| Stream state | **`LIVE`** (not `MARKET_INACTIVE`) |
| Trading stamp | `DISABLED` |
| Subscription | `XAU/USD` (count 1); listener + poller active |
| Offers snapshot | present (count 1) |
| Instrument | `XAU/USD`, `offerId=4001`, catalog `tradingStatus=O`, `pointSize=0.01` (516 instruments) |
| Last genuine quote | ~`2026-10-26T18:55:30Z`, age **~60–340 ms** |
| Bid / ask (sample) | 4013.47 / 4013.77 (spread positive) |
| Callbacks | `callbackAccepted` ≫ 40k; `callbackFiltered` present |
| Poll | `pollChanges=31`, `lastPollChangeAt` older than `lastPollHeartbeatAt` (heartbeat ≠ change) |
| Intended store | 2 intended rows (XAU 15m + 1m) — symbol-level sub still 1 |

**Conclusion:** Market-data path is receiving **genuine fresh bid/ask changes** on DEMO for XAU/USD. Prior pause condition (`MARKET_INACTIVE` / no ticks) is **not** the current live state.

---

## 3. Order-submission requirements (eligible checklist)

### A. Session / account
| Requirement | Status |
|-------------|--------|
| Authenticated DEMO session | **Verified live** |
| Account from broker Accounts / `Common.get_account` | **Implemented**; live row **not** re-fetched this phase (admin RO) |
| LIVE unlock | Must remain locked — **preserved** |
| Connection health at readiness | Stream LIVE + session CONNECTED — **verified** |

### B. Instrument / price
| Requirement | Status |
|-------------|--------|
| Offer / symbol mapping | **Verified** (`XAU/USD` / offerId `4001`) |
| Fresh bid/ask | **Verified** (sub-second age) |
| Side-dependent pricing (BUY→ask, SELL→bid) | **Coded** in preflight / mutation soft checks |
| Market/session fail-closed | **Coded** (`QUOTE_STALE`, `MARKET_INACTIVE`, etc.) |
| Distinct broker quote timestamp | **Unknown / unavailable** on this SDK path |

### C. Quantity / risk
| Requirement | Status |
|-------------|--------|
| `amount = base_unit_size * lots` | **Coded** (Gehtsoft-aligned) |
| DEMO lots clamp 1..50 (sidecar) | **Coded** |
| Grant maxLots | **Coded** in preflight |
| No silent zero amount | **Coded** (`INVALID_AMOUNT`) |
| Account MMR / min qty from TradingSettings | **Surfaced when SDK provides**; live values not re-probed |

### D. Request / response lifecycle
| Requirement | Status |
|-------------|--------|
| `TRUE_MARKET_OPEN` request construction | **Coded** (gated DEMO only) |
| `send_request` → `order_id` | **Coded**; missing id → reject |
| Fill ≠ accept (`fillConfirmed` / trade row / timeout) | **Coded** |
| Orders table add/change/delete monitor (sample) | **Partial** — demo open waits on **trades** primarily; full Orders monitor from sample not mirrored in ordinary AT |
| Ordinary AT path | **Never sends** (`DisabledBrokerMutationAdapter`) |

---

## 4. Readiness model (evidence-based states)

Distinct codes already exist (59.0.3 + stream):  
`SESSION_DISCONNECTED` · `INSTRUMENT_NOT_CONFIGURED` · `INSTRUMENT_NOT_PERMITTED` · `SUBSCRIPTION_*` · `QUOTE_NOT_RECEIVED` · `QUOTE_INVALID` · `QUOTE_STALE` · `QUOTE_READY` · stream `MARKET_INACTIVE` / `LIVE` · execution `EXECUTION_FORBIDDEN` · demo `NO_ACTIVE_DEMO_GRANT` / env gates.

**Must remain separate:** market-data ready ≠ account ready ≠ parameter valid ≠ execution permitted ≠ broker accepted ≠ filled.

A read-only readiness check **must not** flip `placesOrders` / `acceptsForExecution`.

---

## 5. Trade Monitor integration findings

| Concern | Finding |
|---------|---------|
| Working orders | `openWorkingOrders` ← Orders table; UI table Order / Status |
| Open positions | `openPositions` ← Trades; `tradeId` + optional `orderId` (open order) |
| Closed / history | ClosedTrades + persisted history; Phase 60 no close-from-absence |
| Accepted vs filled | Demo mutation returns `ACCEPTED_PENDING_OR_TIMEOUT` vs trade snapshot; TM does **not** fabricate fills |
| Rejected orders | Depend on broker Orders status string / error path — **limited UI taxonomy** (raw status) |
| Partial fills | Sidecar close supports partial amount; TM does not synthesize multi-trade partial-fill UI |
| Gap | No end-to-end “pending→accepted→filled” state machine in TM beyond RO snapshots |

---

## 6. Tests

| Suite | Outcome |
|-------|---------|
| Existing phase59-0 / 59.0.3 | Present; not re-run remotely (no commit/push this phase) |
| **New** `tests/unit/ai/forex-ai/phase59-0-5-market-readiness-order-path.test.ts` | Authored (readiness distinctions, safety, OrderID/TradeID contracts). **Not committed / not CI-executed** per phase rules |

---

## 7. Code defects fixed this phase

**None.** Live market path is healthy; no read-only defect required a code change that would cross the safety boundary. Audit artifacts only (test + this doc) left uncommitted.

---

## 8. Safety invariants confirmed

- `placesOrders=false` / `acceptsForExecution=false` on AT surfaces and disabled adapter  
- Stream/provider `trading: "DISABLED"`  
- No DEMO grant created; no mutation env change; no order submitted  
- No service restart, secret change, commit, push, or deploy  

---

## 9. Ready for controlled DEMO order-lifecycle phase?

**Not yet authorized.** Market-data readiness for XAU/USD on DEMO is **evidence-positive**.  

Still required before any separately authorized DEMO open:
1. Owner authorization + active time-bounded DEMO grant  
2. `KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION` + matching secret on sidecar **and** Node (ops change — out of scope here)  
3. Live admin RO confirmation of account id (masked) + TradingSettings sizing  
4. Explicit certification plan: open → Orders/Trades correlation → protect → close — **outside** ordinary AT (`DisabledBrokerMutationAdapter` stays)

**Do not** treat this phase as permission to place an order.
