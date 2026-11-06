# Phase 2 — Final Pre-Execution Validator

**Status:** Implemented (fail-closed; no broker mutation)  
**Module:** `ai/forex-ai/automated-trading/broker-execution/`  
**Phase id:** `4.18G.4-P2`

---

## 1. Architecture

```
HANDOFF_READY + PROPOSAL_READY
        │
        ▼
runPreExecutionValidation (pure)
        │
        ├── blockingReasons (machine codes)
        ├── suggestedLifecycle: PRECHECK_BLOCKED | AUTHORIZATION_REQUIRED
        └── stamps: placesOrders=false, acceptsForExecution=false, mutatesBroker=false
        │
        ▼
applyPreExecutionValidation (optional)
        │
        └── store.transitionLifecycle(suggested) + bindActiveIds
            (never READY_TO_SUBMIT / SUBMITTING / FILLED / …)
```

Reuses (does not rebuild):

| Concern | Module |
|---------|--------|
| Handoff record | `broker-compatibility` |
| Proposal record | `order-proposal` |
| Quantity contract | `order-execution/broker-quantity-contract` |
| SL/TP / 3R geometry | `broker-intent/protective-geometry` |
| Bid/ask/spread parse | `verification-engine.validateBidAsk` |
| Risk limit shapes | `demo-execution/open-market-risk` patterns (reference) |
| Controls | AT `store` / `types.defaultEnvControls` |
| Foundation SM | existing Phase 1 `state-machine.ts` |

---

## 2. Inputs / outputs

**Input (`AtPreExecutionValidationInput`):** handoff, proposal, expected ids, environment, authoritative controls, foundation stamps, account, market, exposure, instrument contract, optional risk limit overrides.

**Output (`AtPreExecutionValidationResult`):**  
`validationId`, `proposalId`, `handoffId`, `validatedAt`, `status`, `allowed`, `blockingReasons`, `warnings`, grouped checks, `controlSnapshot`, `expiresAt`, safety stamps, `executionAuthorized: false`, `phase2SubmitImplemented: false`, `suggestedLifecycle`.

---

## 3. Validation rules (summary)

| Area | Fail-closed when |
|------|------------------|
| Handoff | Missing, not `HANDOFF_READY`, superseded, expired, proposal/id mismatch |
| Proposal | Missing, not ready, superseded, instrument/direction mismatch, bad entry/SL/TP/qty |
| Owner max | Quantity > **0.01** lots |
| Broker qty | `evaluateBrokerQuantityContract` fails / broker min > owner max |
| Account | Missing/stale equity/balance/margin; insufficient usable margin |
| Controls | Missing; emergency lock ON; masterEnable ON; automaticEntry ON |
| Execution Master | OFF → hard block (`EXECUTION_MASTER_OFF`); ON forbidden in Phase 2 |
| Safety stamps | Must remain false |
| Exposure | Unverified / over max total lots |
| Concurrent | Count unavailable or ≥ maxOpenPositions |
| Duplicate | Suspected or unknown |
| Daily loss / drawdown | Telemetry missing or limit exceeded |
| Market | Unavailable / stale quote |
| Spread | Data missing; **limit not configured** (no invented threshold); or excessive |

---

## 4. Failure codes

See `AtPrecheckReasonCode` in `precheck-types.ts` (e.g. `HANDOFF_MISSING`, `EMERGENCY_LOCK`, `OWNER_MAX_QUANTITY_EXCEEDED`, `SPREAD_LIMIT_NOT_CONFIGURED`, `EXECUTION_MASTER_OFF`, …).

---

## 5. State machine integration

- Reuses Phase 1 allowlist: `IDLE | AUTHORIZATION_REQUIRED | PRECHECK_BLOCKED | SUPERSEDED`.
- Domain hard-fail → `PRECHECK_BLOCKED`.
- Domain OK (Master still OFF) → `AUTHORIZATION_REQUIRED`.
- `READY_TO_SUBMIT` and all submit-adjacent states remain forbidden.

---

## 6. Emergency Lock / proposal gap fix

- `service.generateProposal` now passes **real** `env.controls.masterEnable` / `emergencyEntryLock`.
- Proposal engine **observes** these as notes; does **not** treat them as proposal-construction blockers (analysis-only).
- API returns `proposalOnly`, `executionAuthorized: false`, `controlsObserved`.
- Phase 2 precheck **hard-blocks** when `emergencyEntryLock === true`.

---

## 7. Security boundaries

- No submit routes; path `broker-engine/precheck` avoids `order|submit|execute` regex.
- No DEMO/LIVE mutation; no Execution Master enable; owner max fixed at 0.01.
- Missing/unknown control or risk telemetry → block.

---

## 8. Known limitations

- Live RO open-exposure / day-PnL wiring into `runBrokerPrecheck` still supplies fail-closed nulls until a later RO enrichment (validator already blocks).
- Spread limit must be explicitly configured (`maxSpreadAbsolute`); none is invented.
- `allowed` remains `false` while Execution Master is OFF (hard execution block).
- Slippage has no configured AT limit → `SLIPPAGE_LIMIT_NOT_CONFIGURED` warning/incomplete capability.

---

## 9. Tests

`tests/unit/ai/forex-ai/phase418g4-p2-precheck.test.ts` (+ regression on foundation / order-proposal).

Run (example):

```text
node node_modules/vitest/vitest.mjs run \
  tests/unit/ai/forex-ai/phase418g4-p2-precheck.test.ts \
  tests/unit/ai/forex-ai/phase418g4-broker-execution-foundation.test.ts \
  tests/unit/ai/forex-ai/phase418g2-order-proposal.test.ts
```

Results at implementation time: **81/81 passed**.

---

## 10. Next phase

**Phase 3 — FXCM adapter boundary** (RO vs mutation interfaces; still no submit).
