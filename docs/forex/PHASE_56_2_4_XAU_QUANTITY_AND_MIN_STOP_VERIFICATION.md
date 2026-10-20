# Phase 56.2.4 — XAU/USD Quantity Semantics & Minimum-Stop Verification

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** Quantity / min-stop evidence record  
**Starting HEAD:** `b9f3608207f82d49e58d194e0e13c933b7232ced`  
**Production baseline at start:** `deployedCommit=b9f36082…`, Phase 56.2.3 `PASS_WITH_KNOWN_BLOCKERS`  
**Scope:** Evidence + simulation gates only. **No broker mutations. LIVE unauthorized.**

---

## 1. Inspected paths

| Path | Role |
|------|------|
| `ai/forex-ai/automated-trading/simulation-risk/quantity-semantics.ts` | Evidence resolver (this phase) |
| `ai/forex-ai/automated-trading/simulation-risk/assemble.ts` | Contract meta assembly |
| `ai/forex-ai/automated-trading/simulation-risk/allocation-3r.ts` | Monetary SL risk (blocked when units ambiguous) |
| `ai/forex-ai/position-sizing/contract-spec.ts` | Offers→spec mapping (XAU no longer labeled “lots” solely from PipCost) |
| `services/forexconnect-sidecar/server.py` | TradingSettings + CondDist* RO probes |
| `ai/market-data/forexconnect/{types,provider,client}.ts` | Bridge / offer fields |
| `docs/forex/PHASE_56_2_3_FOREXCONNECT_READ_ONLY_CAPABILITY_AUDIT.md` | Prior blockers |

---

## 2. Instrument identity

| Field | Status | Evidence |
|-------|--------|----------|
| Symbol XAU/USD | **VERIFIED** | DEMO Offers + AT allowlist; production verification `symbol=XAU/USD`, `instrumentType=Bullion` |
| Environment | **DEMO** session label present | LIVE independent attestation still **UNVERIFIED** |

---

## 3. Quantity / contract semantics

### 3.1 Public broker documentation

| Claim | Status | Source (retrieved 2026-10-20) |
|-------|--------|-------------------------------|
| 1 XAU/USD contract = 1 troy ounce | **VERIFIED** (published definition) | https://www.fxcm.com/markets/trading-details/fxcm-contract-sizes-a-quick-guide/ |
| Price quoted USD per troy ounce; min pip/point value $0.01; max 10,000 contracts | **VERIFIED** (published help) | https://www.fxcm.com/markets/help/commodities-xau-usd-gold/ |

### 3.2 DEMO Offers + TradingSettings (production probe)

Observed on authorized AT status (DEMO):

| Field | Value | Status |
|-------|-------|--------|
| `baseUnitSize` | `1` | **VERIFIED** (present) |
| `contractMultiplier` | `1` | **VERIFIED** (present) |
| `pointSize` | `0.01` | **VERIFIED** |
| `pipCostAccount` | `0.01` | **VERIFIED** (matches published $0.01/point) |
| `quantityStep` | `1` | **PARTIALLY_VERIFIED** |
| `quantityMin` | `0.01` | **PARTIALLY_VERIFIED** (conflicts with step=1 — do not invent reconciliation) |
| Legacy local label `quantityUnit: "lots"` | display-only | **NOT** ounce/lot proof |

### 3.3 Binding conclusion

| Question | Verdict |
|----------|---------|
| Published FXCM contract size for XAU | **VERIFIED** — 1 contract = 1 troy ounce |
| DEMO metadata aligns with that definition (`baseUnitSize=1`, `contractMultiplier=1`, `pointSize=0.01`, `pipCost=0.01`) | **VERIFIED** alignment |
| ForexConnect order/trade `Amount` uses that contract unit | **VERIFIED** for simulation gating when alignment holds (Amount treated as contracts); no live order used to prove |
| Legacy “lots” label | Discarded as authoritative unit |

**Resolved sim unit when aligned:** `contracts` with `quantityUnitAmbiguous=false` and `monetaryRiskAllowed=true`.

**If alignment incomplete:** keep `UNVERIFIED` / ambiguous and **block** monetary R.

---

## 4. Minimum stop distance

| Source | Finding | Status |
|--------|---------|--------|
| FXCM XAU help: “With FXCM’s new Enhanced Execution, there is no minimum stop distance.” | Conditional public claim | **PARTIALLY_VERIFIED** |
| Connected DEMO Enhanced Execution mode | Not independently attested | **UNVERIFIED** |
| TradingSettings `CondDist*` RO (sidecar) | Probed read-only this phase; never mapped to `lotStep` | **VERIFIED** capability path; value **UNVERIFIED** until SDK returns account-scoped number |
| Order-rejection probing | Forbidden | **NOT_AVAILABLE** |

**Engine policy:** `minStopDistanceVerified=false` unless CondDist returns a finite **positive** distance. Public “no min stop” is **not** applied as account-attested zero. Drafts still emit `MIN_STOP_DISTANCE_UNVERIFIED` (BLOCKED) when geometry otherwise valid.

---

## 5. Monetary P/L path

When units **VERIFIED** and `pipCostAccount` + `pointSize` present:

`estimatedStopLossRisk = (abs(entry−SL) / pointSize) * pipCostAccount * quantity`

Account currency: DEMO equity USD observed; conversion **NOT_AVAILABLE** if account ≠ quote without verified FX path.

Fees/spread/slippage: **not** included — estimated risk only.

---

## 6. Safety

- No broker orders submitted to discover units or min-stop.
- Execution locks unchanged.
- LIVE unauthorized.

---

## 7. Remaining blockers

1. Account Enhanced Execution attestation (for treating public “no min stop” as VERIFIED).  
2. CondDist unit confirmation (pips vs price) when SDK returns values.  
3. Resolve DEMO `quantityMin=0.01` vs `quantityStep=1` inconsistency with broker docs.  
4. LIVE identity attestation.

*End of quantity / min-stop verification record.*
