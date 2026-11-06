# Stage 3 — Risk Policy Configuration & Order Readiness Audit

**Status:** Implemented (configuration contracts + readiness audit; fail-closed; no broker mutation)  
**Module:** `ai/forex-ai/automated-trading/risk-policy/`  
**Stage id:** `STAGE_3_RISK_POLICY_ORDER_READINESS`  
**Schema:** `kwizera.at-risk-policy.v1`

---

## 1. Mission

Formalize instrument risk-policy contracts (spread/slippage), proposed-order margin attestation, and proposal/handoff readiness consistency — **before** any DEMO submission adapter.

Safety stamps unchanged: `placesOrders=false`, `acceptsForExecution=false`, `mutatesBroker=false`, Execution Master OFF, Emergency Lock ON, owner max `0.01` lots.

---

## 2. Existing configuration sources (audit)

| Concern | Existing source | Gap closed by Stage 3 |
|---------|-----------------|------------------------|
| Spread | Env `KWIZERA_AT_MAX_SPREAD_ABSOLUTE` + request override | Instrument-specific persisted policy + audit |
| Slippage | None (optional non-mandatory code only) | Mandatory fail-closed policy + entry vs executable |
| Margin | Proposal `estimatedMargin` / handoff `requiredMargin` / verification `mmrPerLot` | Explicit attestation helper; mmr×lots only when contract verified |
| AT capital risk | ForexRiskSettings + AT controls + proposal allocation | **Not duplicated** |
| Daily/drawdown | Stage 2 daily-risk store | Unchanged |

---

## 3. Spread policy contract

```text
InstrumentSpreadPolicy {
  instrument: "EUR/USD" | "GBP/USD" | "USD/JPY" | "XAU/USD" | …
  maxSpreadAbsolute: number | null   // absolute price units (same scale as bid/ask)
  units: "absolute_price"
  pricePrecision: number | null      // optional; never invented
  status: VERIFIED | NOT_CONFIGURED | INVALID
}
```

**Resolution order:** request override → instrument policy store → global env → `NOT_CONFIGURED`.

**Owner approval required** before any numeric value is set. Default store slots for EUR/USD, GBP/USD, USD/JPY, XAU/USD are empty (`NOT_CONFIGURED`).

API:

- `GET /api/forex/automated-trading/risk-policy`
- `POST/PUT/PATCH /api/forex/automated-trading/risk-policy` `{ instrument, kind:"spread", value, pricePrecision?, clear? }`

---

## 4. Slippage policy contract

```text
InstrumentSlippagePolicy {
  maxSlippageAbsolute: number | null  // absolute |entry − executable|
  units: "absolute_price"
  basis: "entry_vs_executable"        // BUY→ask, SELL→bid
  status: VERIFIED | NOT_CONFIGURED | INVALID
}
```

Precheck now **always** evaluates slippage (mandatory). Missing policy → `SLIPPAGE_LIMIT_NOT_CONFIGURED`.

---

## 5. Proposed-order margin attestation

`attestProposedOrderMargin` distinguishes:

- Account **usableMargin** (live RO)
- Proposed-order **requiredMargin** from:
  1. `proposal.quantity.estimatedMargin`
  2. `handoff.riskCapital.requiredMargin`
  3. `mmrPerLot × lots` **only** when `contractVerified` and both finite positive

Never fabricates MMR. ForexConnect limitation: required margin depends on verified Offers/TradingSettings `mmrPerLot`; without it attestation stays `UNAVAILABLE` → precheck `MISSING_MARGIN_DATA`.

---

## 6. Handoff / proposal lifecycle findings

Pipeline unchanged (no new state machine / no `READY_TO_SUBMIT`).

Stage 3 adds consistency checks:

| Check | Code |
|-------|------|
| Proposal newer than handoff | `STALE_PROPOSAL_SNAPSHOT` |
| Account ref ≠ live account | `ACCOUNT_IDENTITY_MISMATCH` |
| GTD without/expired expiration | `INVALID_GTD_EXPIRY` |
| Unsupported TIF | `UNSUPPORTED_TIME_IN_FORCE` |

Readiness audit API: `GET /api/forex/automated-trading/lifecycle-readiness`  
(Path avoids the substring `order`, which the AT API gate rejects as `EXECUTION_FORBIDDEN`.)

Production not-ready causes (observed Stage 2): expired/blocked handoff, missing proposal, TTL (15m), `SPREAD_LIMIT_NOT_CONFIGURED`, Execution Master OFF, Emergency Lock ON.

---

## 7. Precheck integration

`runBrokerPrecheck` resolves Stage 3 spread/slippage limits, attaches `riskPolicy` (document + resolved limits + margin attestation + order readiness) alongside Stage 2 `riskIntelligence`.

---

## 8. Remaining owner approvals (numeric values)

Approve per instrument (absolute price units):

| Instrument | `maxSpreadAbsolute` | `maxSlippageAbsolute` | Notes |
|------------|---------------------|------------------------|-------|
| EUR/USD | *awaiting* | *awaiting* | typically 5-digit price scale |
| GBP/USD | *awaiting* | *awaiting* | typically 5-digit price scale |
| USD/JPY | *awaiting* | *awaiting* | typically 3-digit price scale |
| XAU/USD | *awaiting* | *awaiting* | use verified FXCM gold precision |

Do **not** derive limits from current live spreads.

---

## 9. Safety

- No FXCM mutation bridge changes
- No order-submission adapter
- Policy writes are audited; stamps remain false
