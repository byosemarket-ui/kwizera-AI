# Phase 56.2.4 — Authoritative Orders/Trades Exposure Reconciliation

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** Exposure reconciliation policy + evidence  
**Starting HEAD:** `b9f3608207f82d49e58d194e0e13c933b7232ced`  
**Ending HEAD / deployed:** `c48ac4f52b6d27c6d3a0a351d86ee540dbc344f4` (`verifiedLive=true`)  
**Scope:** Read-only ORDERS/TRADES → simulation exposure. **No broker mutations.**

**Production post-deploy probe:** `exposureReconciliation.authoritative=true`, `confirmedZeroExposure=true`, ORDERS/TRADES `AVAILABLE`.

---

## 1. Inspected paths

| Path | Role |
|------|------|
| `ai/forex-ai/automated-trading/simulation-risk/exposure-reconciliation.ts` | Pure reconciliation |
| `ai/forex-ai/automated-trading/service.ts` | Status + draft validation wiring |
| `dev/server/forex-automated-trading-api.ts` | Admin `broker-ro-tables` |
| `services/forexconnect-sidecar/server.py` | `orders_payload` / `trades_payload` |
| `ai/market-data/forexconnect/client.ts` | `listOrders` / `listTrades` |

---

## 2. Capability evidence (DEMO production)

Prior Phase 56.2.3 E2E (and re-used this phase):

| Table | capabilityStatus | Empty code |
|-------|------------------|------------|
| ORDERS | AVAILABLE | `NO_ORDERS` |
| TRADES | AVAILABLE | `NO_TRADES` |
| ClosedTrades | MISSING | not implemented |

Unauthenticated `broker-ro-tables` → **403**. Auth responses keep `placesOrders=false`, `mutatesBroker=false`.

---

## 3. Reconciliation rules

1. **Authoritative** only when **both** ORDERS and TRADES are `capabilityStatus=AVAILABLE` (including confirmed empty).  
2. **Confirmed zero** ≠ missing: requires `NO_ORDERS`/`OK` + `NO_TRADES`/`OK` with count 0.  
3. Failed / disconnected / unsupported → `UNAVAILABLE` — **never** render as zero.  
4. Stale snapshots (default &gt; 60s) → `STALE` — fail closed.  
5. Working **orders are not fills**; open **trades** counted separately.  
6. No single “filled exposure” bucket that sums order Amount + trade Amount for the same lifecycle event.  
7. Local ACTIVE draft reservations remain the monetary strategy-budget reservation mechanism. Broker quantity sums are informational until units are VERIFIED; monetary strategy consumption from broker Amount is **not invented**.  
8. Multiple simulation drafts still cannot independently consume the full strategy budget (existing reservation accounting).

### Allocation concepts (kept separate)

1. Verified account equity  
2. Strategy allocation %  
3. Strategy allocation budget = equity × pct / 100  
4. Existing committed allocation (local ACTIVE reservations; broker qty separate)  
5. Remaining strategy allocation  
6. Proposed per-order allocation  
7. Estimated required broker margin (distinct)  
8. Verified free/usable margin  
9. Estimated monetary SL risk  
10. Max permitted order loss = per-order allocation × 0.25  

---

## 4. ClosedTrades assessment

| Need | Required now? |
|------|----------------|
| Open exposure for draft eligibility | **No** — ORDERS+TRADES suffice |
| Strategy budget accounting | **No** — local reservations + equity |
| Historical realized P/L | **Yes for stats** — out of scope |
| Closed-position audit trail | **Yes for audit** — defer |
| Duplicate lifecycle across closed states | Optional; open tables sufficient if disjoint |

**Policy:** Do not mix historical realized P/L into open exposure or free margin without verified ClosedTrades semantics. ClosedTrades remains **MISSING** / not implemented.

---

## 5. Engine behavior

| RO outcome | `exposureDataAuthoritative` | Check |
|------------|----------------------------|-------|
| Both AVAILABLE empty | `true` | `EXPOSURE_DATA` PASS — confirmed empty |
| Both AVAILABLE nonempty | `true` | `EXPOSURE_DATA` PASS — separate counts |
| Any fail/disconnect/stale/missing | `false` | `EXPOSURE_DATA_UNAVAILABLE` BLOCKED |

---

## 6. Safety

- Reconciliation is read-only.  
- No cancel/amend/close.  
- Saving settings / validating drafts never sets `acceptsForExecution` or `placesOrders`.

*End of exposure reconciliation record.*
