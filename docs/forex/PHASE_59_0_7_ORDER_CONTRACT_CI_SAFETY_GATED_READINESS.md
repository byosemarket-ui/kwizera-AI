# Phase 59.0.7 — Order Contract Verification, Remote CI & Safety-Gated Readiness

**Date:** 2026-10-26  
**Deployed commit (unchanged):** `1e4e5903`  
**Verdict:** `PARTIALLY VERIFIED`  
**Safety:** No mutation · no commit/push/deploy · non-deploy workflow prepared but **not triggered**

---

## 1. Diff review (59.0.6 → 59.0.7)

Reviewed uncommitted order-execution + Trade Monitor changes. Secret scan on scoped diff: **clean**.

Defects addressed this phase:
- Replaced opaque `timeInForce: "SDK_DEFAULT_UNVERIFIED"` with **documented OM default IOC** and explicit fail-closed validation for unsupported/GTD values.
- Orders RO payload now surfaces `timeInForce` when SDK exposes it.
- Sidecar capability probe documents TIF constant enumeration (probe-only).
- Added dedicated **non-deploy** GitHub Actions workflow.

Unrelated commercial/typography/video/PMV dirty files preserved.

---

## 2. SDK / docs evidence

| Topic | Evidence |
|-------|----------|
| Order type for open | `TRUE_MARKET_OPEN` / OM (`Constants.Orders.TrueMarketOpen`) — Gehtsoft sample + FXCM help |
| Required fields | AccountID, BuySell, Amount, OfferID **or** Symbol — FXCM Create Open Market Order |
| Amount units | FX: base currency; CFD/metal: contracts; must be divisible by lot size (`base_unit_size * lots`) |
| TIF supported (OM) | **GTC, IOC, FOK, DAY** — FXCM help |
| TIF default (OM) | **IOC** when omitted — FXCM help (“Open Market orders are IOC orders by default”) |
| Python Constants.TIF | IOC, GTC, FOK, DAY, **GTD** — GTD needs expiry → treated **unsupported** offline until modelled |
| Acceptance vs fill | `send_request` → `order_id` = request ack; fill = Trades row with matching `open_order_id` (sample) |
| Partial fills | Sidecar close supports partial amount; open partial-fill status mapped when broker status string matches |
| Account permissions | Not inferred from CONNECTED; hedging/netting behavior documented by FXCM but **not account-verified** here |

Repo `mutation_demo.open_true_market` still omits TIME_IN_FORCE (relies on SDK/OM default) — consistent with docs once default is understood as IOC.

---

## 3. Live RO recheck

| Check | Result |
|-------|--------|
| Session / stream | CONNECTED · LIVE |
| Quote age | ~2s (fresh) |
| XAU/USD | offerId `4001`, baseUnitSize/minQuantity/lotStep = 1, tradingStatus `O` |
| Account (prior 59.0.6) | Present `***9634` USD |
| Live Orders status samples | **None** (0 working orders) — mapping covered by fixtures only |

---

## 4. Remote CI

Prepared: `.github/workflows/phase59-order-contract-validate.yml`  
- `workflow_dispatch` + push to **non-main** branches only  
- Runs Phase 59.0 / 59.0.3 / 59.0.5 / 59.0.6 vitest files  
- Safety source gates; **no** VPS/mutation secrets; **no** deploy job  

**Blocker:** Phase rules forbid commit/push. Workflow exists only in the working tree and **cannot be triggered** until an owner commits it (preferably on a non-main branch or via dispatch after merge of the workflow file alone).

Offline tests: **authored / refined**; **not executed** on GitHub-hosted runner this phase (no push). Not run locally (heavy suite forbidden).

---

## 5. Trade Monitor

Normalized status + raw status + optional TIF column. No mock production rows. OrderID ≠ TradeID. Missing-row ≠ cancel/close.

---

## 6. Safety

`DisabledBrokerMutationAdapter` · `placesOrders=false` · `acceptsForExecution=false` · Master expected OFF · Emergency expected ON · no order sent · no deploy.

---

## 7. Prerequisites before controlled DEMO order-lifecycle

1. Owner commit of Phase 59.0.6/59.0.7 artifacts (preserve unrelated dirty files)  
2. Trigger `Phase 59 order-contract validate` and obtain green run URL  
3. Owner DEMO grant + mutation env/secret enablement (separate auth)  
4. Optional: observe a real Orders.time_in_force / status string after a future authorized open (not this phase)  
5. Account hedging/netting permission still unknown — do not assume

**Not ready for order submission** solely because market data is live.
