# Phase 56.2.3 — ForexConnect Read-Only Capability Audit

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** Read-only capability audit  
**Baseline HEAD at start:** `7b64900be23aa96db6e238e4531dd62fade8bdb6`  
**Production baseline at start:** `deployedCommit=7b64900be23aa96db6e238e4531dd62fade8bdb6`, `verifiedLive=true`  
**Scope:** Capability evidence only + smallest safe RO gap fills. **No broker mutations. LIVE unauthorized.**

---

## 1. Executive summary

| Area | Status | Severity |
|------|--------|----------|
| Offers / instruments RO | **PASS** (source + prior DEMO runtime) | — |
| Accounts RO (sidecar + Node bridge) | **PASS** sidecar/bridge; public provider HTTP historically missing; AT admin exposure added this phase where authorized | MEDIUM→mitigated for AT |
| XAU/USD quantity-unit semantics (ounces vs lots vs contracts) | **UNVERIFIED** | **BLOCKING** for monetary risk inventing |
| Contract size / baseUnitSize / lotStep fields present | **PARTIAL** — fields observed; meaning not proven as ounces | BLOCKING for ounce assumption |
| Minimum stop distance | **UNVERIFIED / MISSING** in app mapping | **BLOCKING** |
| Orders table RO | **MISSING prior**; defensive RO reader + routes added this phase **if** installed SDK exposes table constant — runtime must confirm | HIGH until E2E verified |
| Trades / open positions RO | Same as Orders | HIGH until E2E verified |
| ClosedTrades history RO | **MISSING** (not implemented this phase) | MEDIUM |
| Order create/modify/cancel/close | **ABSENT by design** — PASS | — |
| DEMO session label | **PASS** (prior + status) | — |
| LIVE independent attestation | **UNVERIFIED**; LIVE unauthorized | HIGH for LIVE |
| Safe for broker submission | **NOT READY** | — |

**Completed audit ≠ all capabilities proven.** Where the SDK/runtime cannot prove a value, status remains `UNVERIFIED` / `BLOCKED`.

---

## 2. Exact SDK / runtime evidence

| Item | Finding | Label |
|------|---------|-------|
| Provision pin | `forexconnect==1.6.43` | `VERIFIED_SOURCE_CODE` |
| Sidecar requirements | `forexconnect>=1.6.43` | `VERIFIED_SOURCE_CODE` |
| Production probe `sdkVersionInstalled` | Often `"installed"` (not semver) | `VERIFIED_INSTALLED_RUNTIME` (prior 56.1) |
| Sidecar bind | `127.0.0.1:5179` | `VERIFIED_SOURCE_CODE` |
| Status `trading` | Always `DISABLED` in safe status | `VERIFIED_SOURCE_CODE` |

Exact installed package semver on VPS remains **UNVERIFIED** without `pip show` in this phase.

---

## 3. XAU/USD quantity and contract semantics

### 3.1 What is available

From Offers + TradingSettings enrichment (sidecar `_normalize_offer` / `_trading_settings_for`):

- Symbol mapping for XAU/USD / XAUUSD allowlist (AT)  
- `pointSize`, `digits`, `contractMultiplier`, `baseUnitSize`, `lotStep`, `mmrPerLot`, bid/ask  

### 3.2 What is **not** proven

| Claim | Verdict |
|-------|---------|
| Quantity = troy ounces | **UNVERIFIED** — must not invent |
| `contractMultiplier: 1` proves ounce contract | **UNVERIFIED** |
| `baseUnitSize` meaning | **UNVERIFIED** beyond opaque SDK number |
| Pip/point monetary value in account currency for risk | **PARTIAL** — `pipCost` may appear; conversion path incomplete |

**Policy:** simulation monetary R / 3R / 25% loss-limit checks require non-ambiguous quantity units. Until verified, dependent calcs stay `BLOCKED` / `UNVERIFIED`.

---

## 4. Minimum stop distance

| Source | Finding |
|--------|---------|
| Sidecar | Explicitly does **not** map CondDist*/stop distances to lotStep |
| Offers metadata mapped to AT | `minStopDistanceVerified: false` in assemble |
| Broker order probe | **Forbidden** this phase |

**Status: UNVERIFIED / MISSING.** Do not invent. Drafts that require min-stop validation remain blocked via `MIN_STOP_DISTANCE_UNVERIFIED`.

---

## 5. Orders / Trades / positions read-only

### 5.1 Prior state (56.1)

- No sidecar `/orders` or `/trades`  
- No Node listOrders/listTrades  
- No AT public RO exposure  
- Sim engine `exposureDataAuthoritative: false` → `EXPOSURE_DATA_UNAVAILABLE`

### 5.2 This phase (smallest safe gap fill)

Defensive read-only readers added that:

1. Resolve `getattr(ForexConnect, "ORDERS"|"TRADES", None)`.  
2. If constant missing → `capabilityStatus: UNSUPPORTED` (not fake empty success).  
3. If present → read table RO, normalize safe fields (ids masked where needed), `trading: DISABLED`.  
4. **Never** create/modify/cancel/close.  
5. Node bridge + **admin-gated** AT routes only.  
6. ClosedTrades **not** implemented (explicit MISSING).

**Runtime E2E (production):**

| Check | Result |
|-------|--------|
| Unauthenticated `GET …/broker-ro-tables` | **403** (auth enforced) — PASS |
| First authorized probe after `cdff15b4…` ship | **500** — wrong dynamic import `forexconnect/index.js` (barrel file does not exist). Module resolution failure — **not** an empty success. |
| Fix | Import corrected to `forexconnect/client.js` (follow-up ship in this phase). |
| Post-fix authorized probe | Required after redeploy — expect `UNSUPPORTED` / `DISCONNECTED` / rows, never fabricated empty OK. |
| ClosedTrades | Explicit `CLOSED_TRADES_NOT_IMPLEMENTED` / `MISSING` |

Simulation drafts still set `exposureDataAuthoritative: false` until ORDERS/TRADES RO is confirmed authoritative end-to-end on the installed SDK.

### 5.3 Accounts RO

Sidecar `GET /accounts` + `ForexConnectBridge.listAccounts()` already exist. This phase exposes an **admin-gated** AT snapshot route so Automated Trading can show equity without a public unauthenticated provider route. Verified equity for capital budget is taken from the existing AT verification path (not balance substitution).

---

## 6. Environment identity (DEMO vs LIVE)

| Mechanism | Finding |
|-----------|---------|
| Session `environment` / connection Demo|Real label | Present on status |
| Independent broker “account type certificate” | **UNVERIFIED** |
| LIVE profile on production | Historically `liveConfigured: false` |
| LIVE execution | **Unauthorized** — must remain so |

Login/session label ≠ independent attestation for LIVE.

---

## 7. Safety invariants (must hold)

- `masterEnable` default false; emergency lock default true  
- `placesOrders=false`, `acceptsForExecution=false`  
- FC `trading=DISABLED`  
- No order-like AT paths (EXECUTION_FORBIDDEN)  
- Capital setting saves must not flip execution flags  

---

## 8. Residual blockers requiring owner/broker evidence

1. Proven XAU quantity-unit semantics (documentation or broker confirmation).  
2. Verified minimum stop distance without submitting an order.  
3. Confirmed ORDERS/TRADES table availability on **installed** SDK (post-deploy probe).  
4. ClosedTrades history if required for strategy accounting.  
5. LIVE independent identity attestation before any LIVE work.

---

## 9. Explicit non-actions

- No broker orders, cancels, amendments, or position closes.  
- No LIVE enablement.  
- No execution-lock changes to make tests pass.  
- Phase 56.3 not started.

*End of Phase 56.2.3 ForexConnect RO capability audit.*
