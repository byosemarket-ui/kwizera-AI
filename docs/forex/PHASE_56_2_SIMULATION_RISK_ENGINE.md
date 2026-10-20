# Phase 56.2 — Simulation-Only Risk Engine & Trade Draft Validation

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** Implementation note  
**Status:** IMPLEMENTED — OWNER REVIEW  
**Baseline prior HEAD:** `7690ede6159ff567f6f27f8cfa7d97ea7bf5f02b` (Phase 56.1 audit)  
**Authoring date (UTC):** 2026-10-20

**This phase does not authorize broker execution, DEMO submit, or LIVE trading.**

---

## 1. Implementation scope

### Implemented

- Isolated simulation risk engine under `ai/forex-ai/automated-trading/simulation-risk/`
- Central XAU/USD allowlist (`XAU/USD` / `XAUUSD`)
- Deterministic BUY/SELL + SL/TP geometry validation
- Fail-closed handling for undecided risk %, missing account/contract/exposure/min-stop
- Draft result schema with `simulationOnly: true`, `placesOrders: false`, `acceptsForExecution: false`
- Light persistence: `forex-automated-trading/simulation-drafts.json` (draft history only — not order-intent lifecycle)
- Admin API:
  - `GET /api/forex/automated-trading/simulation-risk/status`
  - `POST /api/forex/automated-trading/simulation-risk/validate`
  - `GET /api/forex/automated-trading/simulation-risk/history`
- AT UI panel: Simulation draft (entry/SL/TP inputs, status, reasons — no execute controls)
- Focused unit tests: `tests/unit/ai/forex-ai/phase56-2-simulation-risk.test.ts`
- CI workflow includes the new test file

### Deliberately not implemented

- Broker order submit / modify / cancel / close
- Durable order-intent lifecycle (`SUBMISSION_*`, fills, reconciliation)
- Orders/Trades RO sidecar readers
- Invented ounce conversion or default risk percentage
- Invented minimum stop distance
- Public unauthenticated `/accounts` route
- LIVE credential activation or LIVE execution
- Phase 56.3+

---

## 2. Risk-engine architecture

```
Decision (Phase 54) + Verification + Quote freshness + Draft prices (SL/TP)
        │
        ▼
 assembleSimDraftInput()  —— never invents ounces / risk% / min-stop
        │
        ▼
 validateSimulationDraft()  —— pure, DEMO/LIVE shared rules
        │
        ▼
 AtSimDraftResult (persist optional) —— simulationOnly, never execution
```

Environment is a parameter on the draft. Rules are not duplicated per environment. The engine does not select credentials, connect, or enable execution.

---

## 3. Input / output contracts

### Input (`AtSimDraftInput`)

Environment meta, instrument, direction, entry/SL/TP, optional quantity, quote freshness, contract meta, account meta, source decision fingerprint, risk policy, exposure flags.

### Output (`AtSimDraftResult`)

| Field | Notes |
|-------|--------|
| `overallStatus` | `DRAFT` / `VALIDATING` / `VALIDATION_PASSED` / `REJECTED_LOCAL` / `BLOCKED_INSUFFICIENT_DATA` / `BLOCKED_POLICY_UNDECIDED` |
| `structuralOk` | Geometry + allowlist + env match without FAIL |
| Category statuses | instrument, quote, SL/TP, account, quantity/contract, risk budget, margin |
| `proposedQuantity` | Always `null` in current policy until owner risk % + verified units exist |
| `simulationOnly` | always `true` |
| `placesOrders` | always `false` |
| `acceptsForExecution` | always `false` |

`VALIDATION_PASSED` means supported required checks passed — **not** authorization to trade.

---

## 4. Validation rules and reason codes (selected)

| Code | Meaning |
|------|---------|
| `INSTRUMENT_NOT_ALLOWLISTED` | Non-XAU rejected |
| `BUY_SL_NOT_BELOW_ENTRY` / `BUY_TP_NOT_ABOVE_ENTRY` | BUY geometry |
| `SELL_SL_NOT_ABOVE_ENTRY` / `SELL_TP_NOT_BELOW_ENTRY` | SELL geometry |
| `SL_MISSING` / `TP_MISSING` | Both required |
| `QUOTE_STALE` | Freshness fail |
| `BLOCKED_ACCOUNT_DATA_UNAVAILABLE` | No verified equity/margin |
| `QUANTITY_UNIT_AMBIGUOUS` | No invented ounces |
| `MIN_STOP_DISTANCE_UNVERIFIED` | Not invented |
| `EXPOSURE_DATA_UNAVAILABLE` | Orders/Trades RO missing |
| `BLOCKED_POLICY_UNDECIDED` | OD-04 risk % undecided |
| `ENVIRONMENT_MISMATCH` | Requested ≠ session |
| `LIVE_EXECUTION_UNAUTHORIZED` | Always recorded |

---

## 5. Missing-input / fail-closed behavior

Missing or unverified inputs produce `BLOCKED_*` or `FAIL` with machine-readable codes. No guessed equity, risk %, contract ounces, or min-stop. Structural PASS can coexist with overall `BLOCKED_POLICY_UNDECIDED`.

---

## 6. Shared DEMO/LIVE design

One engine, `environment: DEMO | LIVE` on every draft. LIVE context may be validated in simulation without enabling LIVE execution (`liveExecutionAuthorized: false`). Operational preference remains DEMO first.

---

## 7. Simulation-only restrictions

- No broker mutation routes added
- Existing `EXECUTION_FORBIDDEN` path guard preserved
- Master switch / emergency lock unchanged by this phase
- UI has Validate draft only — no Buy/Sell execute button

---

## 8. Test coverage

`tests/unit/ai/forex-ai/phase56-2-simulation-risk.test.ts` covers BUY/SELL geometry, invalid prices, allowlist, stale quote, increments, undecided risk %, missing account, ambiguous units, min-stop unverified, DEMO/LIVE context, persistence flags, and source/API/UI safety greps.

---

## 9. Known limitations

- Assemble path marks XAU quantity units ambiguous (Phase 56.1 ounce semantics unproven)
- Min-stop always unverified unless a future RO source supplies it
- Exposure always non-authoritative until Orders/Trades readers exist
- Default policy keeps risk budget `UNDECIDED` (OD-04)
- `VALIDATION_PASSED` in tests requires explicitly configured risk % — production default remains blocked on policy

---

## 10. Unresolved owner decisions

| ID | Topic |
|----|--------|
| OD-04 | Risk percentage / fixed budget |
| — | Max daily loss / exposure caps |
| — | When LIVE simulation drafts may be created operationally |
| — | Account fingerprint allowlist |
| — | Quantity unit acceptance criteria for XAU |

---

## 11. Phase 56.3 prerequisites

1. Owner review of 56.2 behavior and reason codes  
2. Resolve or explicitly defer OD-04  
3. Optional: RO Orders/Trades readers (still no submit)  
4. Optional: verified min-stop mapping  
5. Explicit authorization before any durable intent / submission lifecycle  

**Phase 56.3 has not started.**
