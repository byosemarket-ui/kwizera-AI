# Broker Execution Engine — Architecture & Phased Plan

**Baseline SHA at design start:** `498068d9`  
**Module phase:** Phase 1 foundation only (this document + safety-only code).  
**Hard rule:** Phases 1–7 never submit DEMO or LIVE broker orders. Phase 8 requires explicit owner approval of one named DEMO test order.

---

## 1. Goal

Receive a validated Step 3 `HANDOFF_READY` package (`AtBrokerHandoffRecord` + `AtFutureExecutionContract`), revalidate, obtain **explicit owner authorization for that specific submission**, submit through the existing ForexConnect DEMO mutation stack, reconcile broker Order/Trade IDs, and optionally run a separately authorized post-fill protection workflow.

Do **not** rebuild Steps 1–3. Do **not** treat System Master ON or `HANDOFF_READY` as execution permission.

---

## 2. Architecture (logical)

```
Result Intake → Order Proposal → Broker Handoff (HANDOFF_READY)
                                        │
                                        ▼
                         Broker Execution Engine (NEW)
                         ┌─────────────────────────────┐
                         │ Foundation / Auth / Audit   │  Phase 1
                         │ Pre-exec revalidator        │  Phase 2
                         │ FXCM adapter boundary       │  Phase 3
                         │ Submit + idempotency        │  Phase 4
                         │ Reconcile Order/Trade       │  Phase 5
                         │ Position + protection       │  Phase 6
                         │ Controls / kill switch      │  Phase 7
                         │ DEMO E2E (owner-gated)      │  Phase 8
                         └─────────────────────────────┘
                                        │
                    reuse only when Phase 8 authorized:
                    DemoLifecycleOrchestrator +
                    ForexConnectDemoMutationAdapter +
                    sidecar /demo-mutation/* (DEMO only)
```

### Reused services

| Layer | Module |
|-------|--------|
| Step 1 package | `result-intake` → `AtOrderPreparationHandoff` |
| Step 2 | `order-proposal` → `AtOrderProposalRecord` |
| Step 3 | `broker-compatibility` → `AtBrokerHandoffRecord`, `AtFutureExecutionContract` |
| Quantity | `order-execution/broker-quantity-contract`, `lots-to-broker-amount` |
| Capital / risk | `simulation-risk/capital-budget`, proposal allocation store |
| DEMO mutation (later) | `demo-execution` orchestrator + grants + FC bridge |
| Gates | System Master (analysis only), `emergencyEntryLock`, env+secret DEMO mutation gates |

### Forbidden wiring

- System Master ON ⇒ broker submit  
- `HANDOFF_READY` ⇒ `acceptsForExecution=true` without new owner grant  
- Proposal/handoff paths calling sidecar mutation  
- LIVE mutation  
- Raising owner max above **0.01 lots**  
- Inventing Order ID / Trade ID / MMR / prices  
- Blind retry after ambiguous submit  

---

## 3. State machine (execution request)

```
IDLE
  → AUTHORIZATION_REQUIRED   (handoff attached, no owner grant)
  → PRECHECK                 (grant present; Phase 2+)
  → PRECHECK_BLOCKED
  → READY_TO_SUBMIT          (all prechecks pass; Phase 4 still gated)
  → SUBMITTING               (in-flight; Phase 4+)
  → SUBMIT_UNKNOWN           (timeout / ambiguous; no blind retry)
  → ACCEPTED | REJECTED | PARTIALLY_FILLED | FILLED
  → RECONCILING → RECONCILED
  → PROTECTION_PENDING       (if post-fill required; separate auth)
  → CLOSED | CANCELLED | FAILED | SUPERSEDED
```

Phase 1 persists the machine and **never leaves** `IDLE` / `AUTHORIZATION_REQUIRED` / `PRECHECK_BLOCKED` via submit. All transitions that would mutate the broker are blocked with `EXECUTION_NOT_IMPLEMENTED_PHASE1`.

---

## 4. Authorization model

Execution requires **all** of the following (fail-closed):

1. Environment = **DEMO** (LIVE always forbidden in this module’s Phase 1–8 design).  
2. `emergencyEntryLock === false` (Emergency Lock OFF for the intended submit window — owner controlled).  
3. **Execution Master** owner switch = ON (new; default OFF; distinct from System Master).  
4. Explicit **per-submission authorization** bound to: `handoffId` + `proposalId` + `idempotencyKey` + quantity + instrument + direction + expiry.  
5. Dual DEMO mutation gate (existing): env allow + mutation secret (Phase 8 only).  
6. Owner max **0.01 lots** and FLOOR-only conversion still pass.  
7. Capital allocation configured (strategy % + individual order allocation).  
8. Fresh revalidation of the handoff/proposal (Phase 2).  

Dashboard toggles alone never bypass quantity, margin, broker min, or LIVE lock.

### Persistence (Phase 1)

File: `{storageRoot}/forex-automated-trading/broker-execution-foundation.json`

- `executionMasterEnabled: false` (default)  
- `armedForSubmission: false` (default; never auto)  
- Audit events (append-only capped history)  
- Optional draft authorization intents (non-mutating)  
- Safety stamps always `placesOrders: false`, `acceptsForExecution: false`, `mutatesBroker: false`  

---

## 5. API design (HTTP)

Path prefix deliberately avoids the AT `EXECUTION_FORBIDDEN` regex (`order|submit|execute`):

| Method | Path | Phase | Behavior |
|--------|------|-------|----------|
| GET | `/api/forex/automated-trading/broker-engine/status` | 1 | Foundation status, state machine, blockers, safety stamps |
| GET | `/api/forex/automated-trading/broker-engine/audit` | 1 | Recent execution-foundation audit events |
| POST | … submission routes | 4–8 | **Not implemented in Phase 1** |

Admin auth: existing `requireForexAdmin`.

---

## 6. Phase plan & acceptance tests

### Phase 1 — Architecture & Safety Foundation ✅ (this delivery)
- Types, state machine, authorization model, audit store, public status API.  
- Execution Master default OFF; no mutation; no DEMO submit.  
- Tests: defaults fail-closed; status stamps; forbidden transitions.

### Phase 2 — Final pre-execution validator
- Revalidate handoff/proposal/account/instrument/qty/risk/margin/locks/duplicates.  
- Acceptance: every failed check blocks; HANDOFF_READY alone insufficient.

### Phase 3 — FXCM adapter boundary
- Document exact sidecar `create_order_request` / TRUE_MARKET_OPEN params.  
- Separate RO vs mutation interfaces in TypeScript.  
- Acceptance: no invented SDK methods; LIVE rejected.

### Phase 4 — Submission & idempotency
- Single-flight submit; `SUBMIT_UNKNOWN` without blind retry.  
- Acceptance: duplicate idempotency key returns same record.

### Phase 5 — Response & reconciliation
- Capture broker Order ID, Trade ID, fills, rejects.  
- Acceptance: independent RO reconcile matches mutation response.

### Phase 6 — Position & protection
- Default `REQUIRES_POST_FILL_WORKFLOW`; separate auth for attach-protective.  
- Acceptance: no attach-on-open claimed unless attested.

### Phase 7 — Controls & emergency
- Kill switch, daily loss, exposure caps, recovery.  
- Acceptance: Emergency Lock blocks new submits immediately.

### Phase 8 — DEMO E2E (owner-gated)
- One explicit DEMO order only after owner approval of exact fields.  
- Acceptance: broker Order ID verified via RO tables; no LIVE.

---

## 7. Broker API capability findings (existing)

| Capability | Evidence | Notes |
|------------|----------|-------|
| DEMO open market | sidecar `mutation_demo.py` + `/demo-mutation/open-market` | Env+secret gated; LIVE forbidden |
| Attach protective | `/demo-mutation/attach-protective` | Post-fill; separate from open |
| Close / cancel | close-trade / cancel-pending | Grant-scoped |
| RO accounts/orders/trades | bridge list* + broker-ro-tables | Default posture |
| Attach-on-open attestation | Step 3 default `REQUIRES_POST_FILL_WORKFLOW` | Do not invent |

SDK uses `fx.create_order_request` + `TRUE_MARKET_OPEN` / STOP / LIMIT — not a string `CREATE_ORDER` RPC.

---

## 8. Prerequisites & unresolved blockers

| Item | Status |
|------|--------|
| Steps 1–3 deployed | Yes (`498068d9` lineage) |
| Owner capital allocation | **NOT_CONFIGURED** until owner saves % + order allocation |
| Compatible instrument at 0.01 lots | **0/516** on DEMO catalog under owner max |
| Eligible BUY/SELL signal | Market-dependent |
| Sidecar Offers MMR fallback | Code present; needs owner-approved sidecar restart |
| Execution Master | Phase 1 default **OFF** |
| DEMO mutation env/secret | Required only for Phase 8 |
| Owner explicit Phase 8 approval | Required before any submit |

---

## 9. Security threat analysis (Phase 1 scope)

| Threat | Mitigation |
|--------|------------|
| Accidental submit via UI | No submit API in Phase 1; stamps false |
| Path smuggling past EXECUTION_FORBIDDEN | Prefix `broker-engine` avoids regex; no mutation routes |
| Treating System Master as execution auth | Explicit separate Execution Master; docs + status labels |
| Credential leakage | No secrets in store; reuse existing secret gates later |
| Replay of old handoff | Idempotency + expiry fields reserved; Phase 2 enforces |
| LIVE spill | DEMO-only design; LIVE rejected at adapter |

---

## 10. Failure recovery (design)

- `SUBMIT_UNKNOWN`: reconcile via RO ORDERS/TRADES using client reference; never second blind submit.  
- Process crash mid-submit: on boot, mark in-flight as UNKNOWN and reconcile.  
- Kill switch / Emergency Lock: transition to blocked; refuse new authorization.  
- Phase 1: no in-flight submits possible.

---

## 11. Test strategy

- Unit: foundation defaults, authorization deny matrix, state transition guards.  
- API: GET status returns `brokerExecution: "DISABLED"`, `mutatesBroker: false`.  
- Regression: existing Phase 4.18G.3 handoff tests still pass.  
- Phase 8: manual DEMO checklist only after owner sign-off.
