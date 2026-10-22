# Automated Trading LIVE Readiness — Master Audit & Roadmap

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** READ-ONLY audit and dependency-ordered roadmap  
**Audit date (UTC):** 2026-10-22  
**Classification:** `AUDIT_COMPLETE — READY_FOR_NEXT_PHASE`  
**This audit does not authorize execution, DEMO orders, or LIVE trading.**

---

## 1. Executive summary and verdict

### Verdict

**`AUDIT_COMPLETE — READY_FOR_NEXT_PHASE`**

Automatic Trading is a mature **simulation / verification / market-data** stack with hard execution locks. It is **not** LIVE-ready and **not** DEMO-execution-ready. The correct next dependency is completing **simulation-data gates that still fail closed in production** (quantity constraints, CondDist/min-stop attestation, and non-USD conversion edge cases), then a full interactive simulation draft acceptance under LIVE quotes — **before** any broker order-lifecycle work.

### Headline findings

1. **Safety locks are closed** on production RO paths inspected this audit (`placesOrders=false`, `acceptsForExecution=false`, `EXECUTION_FORBIDDEN`, ForexConnect `trading=DISABLED`). AT `/status` is admin-gated (403 without token); master/emergency not re-read via API this session.
2. **Market-data lifecycle through Phase 56.3.5 is implemented** with production persistence and controlled-environment reconnect/restart acceptance; **production** disconnect and process-restart cycles remain **BLOCKED** (not authorized).
3. **Simulation risk engine and AI analysis exist** and fail closed; production draft Scenario 1 has historically been blocked by quantity / CondDist / feed gates.
4. **Broker order submission is intentionally unimplemented** (`AUTOMATED EXECUTION NOT IMPLEMENTED — PHASE 54`). Orders/Trades RO tables exist; ClosedTrades and order mutation lifecycle are missing or forbidden.
5. **Allowlist remains XAU/USD only** for AT drafts; market-data LIVE ≠ execution eligibility.

### What “next phase” means

Recommended: **Phase 56.4.0 — Simulation Data Gates Closure (quantity, CondDist, currency)** — DEMO-only, still `placesOrders=false`, no broker mutations. See §9.

---

## 2. Actual repository and production baseline

| Item | Observed this audit |
|------|---------------------|
| Branch | `main` tracking `origin/main` |
| Local HEAD | `fd7f00e14b3498b8190842c004fd6ee95fbf17a3` |
| Production `/api/deployment` | `deployedCommit=fd7f00e1…`, `verifiedLive=true`, `result=success`, `status=live` |
| Health | `healthy` |
| Unrelated dirty files | PMV/typography/video — present, **not modified by this audit** |
| Latest AT-relevant commits | `fca6ba46` / `fd7f00e1` Phase 56.3.5; prior `42732f6f` / `d04a7c78` Phase 56.3.4 |

Historical SHAs (`5c3a6d6c`, `3b24a427`, `daf27d19`, `d04a7c78`) were **prior** phase endpoints; **current** production matches HEAD `fd7f00e1`.

### Phase 56.3.5 status (explicit)

| Question | Answer |
|----------|--------|
| Implemented? | **Yes** — feature `fca6ba46`, docs `fd7f00e1` |
| Report exists? | `docs/forex/PHASE_56_3_5_CONTROLLED_RECOVERY_ACCEPTANCE.md` |
| Verdict | `PASS_WITH_KNOWN_BLOCKERS` |
| Controlled disconnect/reconnect/restart hydrate | **PASS** (vitest / in-process) |
| Production disconnect / service restart | **BLOCKED** (not authorized) |

---

## 3. Architecture and module inventory

### 3.1 Policy / design docs

| Path | Role |
|------|------|
| `docs/forex/PHASE_56_0_ARCHITECTURE_POLICY_DESIGN.md` | Architecture + owner policy freeze |
| `docs/forex/PHASE_56_1_FOREXCONNECT_CAPABILITY_AUDIT.md` | FC capability baseline |
| `docs/forex/PHASE_56_2_*.md` | Simulation risk, capital, quantity, CondDist, readiness, E2E sim |
| `docs/forex/PHASE_56_3_*.md` | Live data diagnostics → multi-instrument → reconnect → persistence → controlled recovery |

### 3.2 Core AT backend (`ai/forex-ai/automated-trading/`)

| Area | Paths | Role |
|------|-------|------|
| Service / store | `service.ts`, `store.ts`, `types.ts` | Controls, verify, status; `placesOrders: false` literals |
| Verification | `verification-engine.ts`, `verification-gates.ts` | Account/instrument/market verification |
| Analysis | `analysis/*` | OpenAI multimodal BUY/SELL; NOT CALIBRATED confidence |
| Decision | `decision/*` | `ACCEPTED_FOR_REVIEW` — not execution |
| Monitoring | `monitoring/*` | Server-side worker, chart render, schedule |
| Simulation risk | `simulation-risk/*` | Draft validation, allocation, quantity, CondDist, FX, exposure, readiness gates |
| Allowlist | `simulation-risk/allowlist.ts` | **XAU/USD / XAUUSD only** |

### 3.3 Market data (`ai/market-data/`)

| Area | Paths | Role |
|------|-------|------|
| ForexConnect live | `forexconnect/live-service.ts`, `session.ts`, `provider.ts`, `instrument-classify.ts` | Live candles, lifecycle, classification |
| Persistence | `forexconnect/intended-subscriptions-store.ts` | Durable intended subscriptions |
| Readiness | `instrument-readiness/*` | Per-instrument LIVE vs blocked |
| MDS API | `dev/server/forex-market-data-api.ts` | Instruments, candles, readiness |
| FC API | `dev/server/forexconnect-api.ts` | Status, stream/lifecycle, admin connect/disconnect |
| AT API | `dev/server/forex-automated-trading-api.ts` | AT routes; `EXECUTION_FORBIDDEN` gate |

### 3.4 Frontend

| Path | Role |
|------|------|
| `desktop/forex/ForexAutomatedTradingPage.tsx` | AT operator UI (verify, monitor, decision, simulation draft, controls) |
| Related | `/forex/ai-analysis`, `/forex/charts`, `/admin/forex` |

### 3.5 Sidecar / broker bridge

| Path | Role |
|------|------|
| `services/forexconnect-sidecar/` (referenced in phase docs) | Offers, RO tables, CondDist probes; trading disabled |
| `ai/market-data/forexconnect/client.ts` | Node bridge to sidecar |

**Distinction:** Presence of SDK/bridge methods ≠ verified safe broker mutation support. No mutation paths are authorized.

---

## 4. Capability matrix (evidence-based)

Status legend:  
`IMPLEMENTED_AND_PRODUCTION_VERIFIED` | `IMPLEMENTED_AND_TESTED` | `PARTIALLY_IMPLEMENTED` | `MOCK_OR_STUB_ONLY` | `BLOCKED` | `MISSING` | `NOT_VERIFIED`

### A. Market data and instrument handling

| Capability | Status | Evidence / limitation | Next action |
|------------|--------|----------------------|-------------|
| Provider session connect (DEMO) | IMPLEMENTED_AND_PRODUCTION_VERIFIED | Prod stream `CONNECTED`, trading DISABLED | Maintain |
| Instrument discovery | IMPLEMENTED_AND_PRODUCTION_VERIFIED | MDS listInstruments; FAKE undiscovered | Maintain |
| Per-instrument live subscribe | IMPLEMENTED_AND_PRODUCTION_VERIFIED | 56.3.1–56.3.2; this audit LIVE via subscribeLive | Maintain |
| Bid/ask freshness / LIVE gate | IMPLEMENTED_AND_PRODUCTION_VERIFIED | Genuine Offers event + price change ≤15s | Maintain |
| Reconnect + intended restore | IMPLEMENTED_AND_TESTED | 56.3.3–56.3.5 synthetic; prod hooks live | Optional authorized prod disconnect demo |
| Durable persistence + restart hydrate | PARTIALLY_IMPLEMENTED | Store enabled on VPS (56.3.4/5); **prod process restart BLOCKED** | Authorized restart under maintenance window |
| Metadata classification | IMPLEMENTED_AND_PRODUCTION_VERIFIED | XAU→COMMODITY, US30→INDEX despite raw FOREX | Maintain |
| Per-instrument isolation | IMPLEMENTED_AND_PRODUCTION_VERIFIED | Peers LIVE ≠ XAG/FAKE LIVE | Maintain |
| Phase 56.3.5 controlled acceptance | IMPLEMENTED_AND_TESTED | Report + tests; prod ops cycles BLOCKED | Owner ops decision |

### B. AI analysis and strategy

| Capability | Status | Evidence / limitation | Next action |
|------------|--------|----------------------|-------------|
| OpenAI AT analysis engine | IMPLEMENTED_AND_PRODUCTION_VERIFIED | AT page history; NOT CALIBRATED | Maintain; never treat as order |
| Structured evidence / chart image | IMPLEMENTED_AND_TESTED | monitoring chart-render | Maintain |
| BUY/SELL binary + horizon | IMPLEMENTED_AND_TESTED | analysis validate/direction | Maintain |
| Multi-timeframe (general forex AI) | PARTIALLY_IMPLEMENTED | Separate `/forex/ai-analysis` MTF exists; AT monitor TF selectable | Clarify AT vs studio AI surfaces |
| Entry/SL/TP from analysis | PARTIALLY_IMPLEMENTED | Levels proposed in simulation assemble; often incomplete without LIVE quote | Depends on data gates |
| Prediction journal / learning loop | MISSING / NOT_VERIFIED | No durable outcome-learning module found under AT | Future phase if owner wants |
| Decision `ACCEPTED_FOR_REVIEW` | IMPLEMENTED_AND_TESTED | decision engine; not execution | Maintain |

### C. Trade-plan validation and risk controls

| Capability | Status | Evidence / limitation | Next action |
|------------|--------|----------------------|-------------|
| Strategy allocation 1–100% | IMPLEMENTED_AND_TESTED | capital-budget / UI; policy docs 56.2.2–56.2.3 | Prod interactive under LIVE quote |
| Per-order ≤25% SL of allocation | IMPLEMENTED_AND_TESTED | allocation-3r / engine | Same |
| Quantity sizing / min-step | PARTIALLY_IMPLEMENTED | Code + gates; **prod gate historically BLOCKED** (56.2.5–56.2.7) | **Priority next phase** |
| CondDist / min-stop | PARTIALLY_IMPLEMENTED | Pip semantics coded; **prod UNVERIFIED/BLOCKED** without attested settings | **Priority next phase** |
| Currency conversion | PARTIALLY_IMPLEMENTED | USD path OK; non-USD fail-closed | Close remaining gaps |
| Exposure reconciliation | PARTIALLY_IMPLEMENTED | Orders/Trades RO available; sim fail-closed until wired | Wire + verify |
| Draft persistence / invalidation | IMPLEMENTED_AND_TESTED | simulation-risk store | Prod draft under LIVE |
| Fail-closed on stale/unknown | IMPLEMENTED_AND_PRODUCTION_VERIFIED | FEED_NOT_LIVE; readiness BLOCKED | Maintain |
| Protective SL/TP broker attach | MISSING | Design intent only; no verified broker attach | After DEMO execution phase |

### D. Broker integration and execution lifecycle

| Capability | Status | Evidence / limitation | Next action |
|------------|--------|----------------------|-------------|
| Account / margin RO | IMPLEMENTED_AND_PRODUCTION_VERIFIED | Verify gates; broker-ro-tables (admin) | Maintain |
| Orders / Trades RO | IMPLEMENTED_AND_TESTED | 56.2.3 AVAILABLE; empty NO_ORDERS/NO_TRADES | Maintain |
| ClosedTrades history | MISSING | Explicit in 56.2.3 | Implement RO if needed for accounting |
| Order construction / validation (draft) | IMPLEMENTED_AND_TESTED | Simulation only | Not broker submit |
| Broker order submission | MISSING / forbidden | PHASE 54 banner; EXECUTION_FORBIDDEN | Separate owner phase |
| Fill / ack / reject / reconcile | MISSING | No execution path | After DEMO execution design |
| Idempotency / duplicate prevention | PARTIALLY_IMPLEMENTED | Policy/types; untested for real orders | With execution design |
| DEMO vs LIVE identity | IMPLEMENTED_AND_PRODUCTION_VERIFIED | Profiles, env toggle; LIVE unauthorized | Maintain |

### E. Operational readiness

| Capability | Status | Evidence / limitation | Next action |
|------------|--------|----------------------|-------------|
| Secrets vault / profiles | IMPLEMENTED_AND_PRODUCTION_VERIFIED | Encrypted vault pattern; demo restore | Maintain |
| CI/CD + deployed SHA verify | IMPLEMENTED_AND_PRODUCTION_VERIFIED | `/api/deployment` verifiedLive | Maintain |
| Persistence intended subscriptions | IMPLEMENTED_AND_PRODUCTION_VERIFIED | VPS store path enabled | Prod restart still BLOCKED |
| Observability / alerting | PARTIALLY_IMPLEMENTED | Diagnostics APIs; no full alerting audit | Ops phase |
| Incident / emergency stop | IMPLEMENTED_AND_TESTED | emergencyEntryLock + master OFF | Keep ON/OFF invariants |

### F. UI / operator workflow

| Capability | Status | Evidence / limitation | Next action |
|------------|--------|----------------------|-------------|
| AT page load | IMPLEMENTED_AND_PRODUCTION_VERIFIED | HTTP 200; PHASE 54 banner historically | Maintain |
| Live/freshness messaging | IMPLEMENTED_AND_PRODUCTION_VERIFIED | FEED_NOT_LIVE / verify gates | Maintain |
| Simulation draft UI | IMPLEMENTED_AND_TESTED | Allocation + validate; fail-closed | Needs LIVE quote + gate closure |
| Responsive AT | IMPLEMENTED_AND_TESTED | 56.2.9 interactive matrix | Re-check after UI changes |
| Buttons vs real behavior | PARTIALLY_IMPLEMENTED | Verify/monitor/decision/sim real; execution stub | Never imply place-order |

---

## 5. End-to-end readiness chain

```
Provider Offers
  → instrument metadata (classified)
  → subscribe + genuine tick → LIVE readiness
  → AI analysis (NOT CALIBRATED)
  → decision ACCEPTED_FOR_REVIEW
  → simulation draft (allocation, qty, SL/TP, 3R)
  → simulationDataReadiness gates
  → [GAP] verified quantity + CondDist + FX
  → [GAP] interactive Scenario 1 PASS under LIVE quote
  → [GAP] DEMO order lifecycle (not authorized)
  → [GAP] protective SL/TP broker verification
  → [GAP] ops recovery with open risk
  → [SEPARATE OWNER GATE] LIVE execution authorization
```

| Transition | Fail-closed today? | Gap |
|------------|-------------------|-----|
| Data → LIVE | Yes | Prod reconnect/restart ops evidence |
| LIVE → AI | Yes (stale blocks verify) | — |
| AI → draft | Yes | Incomplete levels without LIVE |
| Draft → readyForSimulation | Yes | Quantity / CondDist / FX gates |
| Draft → broker order | Hard forbidden | Entire execution stack |
| DEMO → LIVE exec | Hard forbidden | Separate owner release |

**Never equate:** simulation draft PASS ≠ broker order; DEMO test ≠ LIVE authorization.

---

## 6. Confirmed blockers and unverified assumptions

### Confirmed (evidence)

| ID | Title | Severity |
|----|-------|----------|
| B-01 | Quantity min/step gate BLOCKED or incomplete for production draft sizing | CRITICAL (for sim readiness) |
| B-02 | CondDist / min-stop UNVERIFIED without attested TradingSettings | CRITICAL (for sim readiness) |
| B-03 | Broker order submission unimplemented / EXECUTION_FORBIDDEN | CRITICAL (expected; blocks execution) |
| B-04 | Production disconnect→reconnect→LIVE cycle not demonstrated | HIGH (ops evidence) |
| B-05 | Production process-restart hydration not demonstrated | HIGH (ops evidence) |
| B-06 | ClosedTrades RO missing | MEDIUM |
| B-07 | Interactive full Scenario 1 draft under LIVE historically BLOCKED | HIGH |
| B-08 | Non-USD currency conversion paths fail-closed / incomplete attestation | MEDIUM–HIGH |
| B-09 | Prediction outcome journal / learning not implemented | LOW–MEDIUM (optional) |
| B-10 | AT `/status` admin-gated — master/emergency not RO-verified this audit | MEDIUM (evidence gap) |

### Unverified assumptions (do not treat as true)

- That CondDist=0 always means “no min stop” for all accounts/instruments.  
- That BaseUnitSize / lotStep semantics are fully attested for all XAU account settings.  
- That Orders/Trades RO empty state always means zero exposure.  
- That AI confidence is calibrated (explicitly NOT CALIBRATED).  
- That production restart will always restore intended subscriptions (synthetic only).

---

## 7. Safety and authorization assessment

### Observed this audit (RO)

| Invariant | Required | Observed |
|-----------|----------|----------|
| `placesOrders` | false | **false** (stream lifecycle, readiness, EXEC response) |
| `acceptsForExecution` | false | **false** (stream lifecycle, readiness) |
| `EXECUTION_FORBIDDEN` | yes | **403** on `POST …/place-order` |
| ForexConnect trading | DISABLED | **DISABLED** |
| LIVE trading | unauthorized | DEMO persistence env; no LIVE auth |
| Allowlist | XAU-only | Source `allowlist.ts` unchanged |
| `masterTradingEnabled` | false | **NOT_VERIFIED via API this audit** (`/status` → 403 ADMIN_FORBIDDEN); last UI evidence OFF |
| `emergencyEntryLock` | true | **NOT_VERIFIED via API this audit**; last UI evidence ON |

**No CRITICAL safety divergence detected** on mutation-capable signals. Admin-only controls not re-read without token (not bypassed).

**Audit did not:** change controls, disconnect, restart, or place orders.

---

## 8. Ranked blocker register

| ID | Title | Sev | Confirmed? | Consequence | Remediation | Depends on | Acceptance | Phase |
|----|-------|-----|------------|-------------|-------------|------------|------------|-------|
| B-03 | No broker submission path | CRITICAL | Yes | Cannot execute (by design) | Separate execution design after sim gates | Owner approval | Explicit DEMO execution phase | Future |
| B-01 | Quantity constraints gate | CRITICAL | Yes (56.2.5–7) | Draft cannot size safely | Attest BaseUnitSize/min/step; close gate | LIVE quote + TradingSettings | Gate READY on DEMO XAU | **56.4.0** |
| B-02 | CondDist/min-stop | CRITICAL | Yes | Min-stop geometry blocked | Account-scoped CondDist attestation | TradingSettings RO | Gate READY or explicit no-minimum | **56.4.0** |
| B-07 | Interactive Scenario 1 | HIGH | Yes | No end-to-end sim PASS | After B-01/B-02 + LIVE feed | 56.3.x data | Scenario 1 PASS prod | **56.4.1** |
| B-08 | FX conversion gaps | HIGH | Partial | Non-USD accounts blocked | Complete conversion attestation | Account currency | Gate READY or fail-closed labeled | **56.4.0** |
| B-04 | Prod disconnect cycle | HIGH | Yes | Ops recovery unproven on VPS | Authorized controlled disconnect | Owner ops | Documented LIVE restore | **56.4.2** (ops) |
| B-05 | Prod restart hydrate | HIGH | Yes | Restart recovery unproven | Authorized maintenance restart | Owner ops | Intent restored; no false LIVE | **56.4.2** |
| B-06 | ClosedTrades missing | MEDIUM | Yes | Accounting incomplete | RO ClosedTrades if required | Sidecar | RO AVAILABLE | Later |
| B-09 | Outcome journal | LOW | Yes | No learning loop | Optional design | Owner want | Spec + store | Optional |
| B-10 | Admin status RO gap | MEDIUM | Yes | Can't cite master/emergency from API without token | Document; optional public safe summary | Policy | Safe RO fields | Ops |

All of B-01–B-02–B-07–B-08 can proceed **without enabling execution**.

---

## 9. Dependency-ordered implementation roadmap

### A. Existing work to verify/complete

| Phase | Objective | Resolves | Prerequisites | Exclusions |
|-------|-----------|----------|---------------|------------|
| **56.4.0 Simulation Data Gates Closure** | Make quantity, CondDist/min-stop, and FX gates READY or explicitly attested fail-closed with operator-visible reasons on DEMO XAU | B-01, B-02, B-08 | 56.3.5 baseline; LIVE quotes available via subscribe | No orders; no LIVE exec; allowlist unchanged |
| **56.4.1 Interactive Simulation Acceptance** | Full Scenario 1 draft PASS under genuine LIVE XAU quote | B-07 | 56.4.0 | No broker submit |
| **56.4.2 Ops Recovery Evidence** | Authorized prod disconnect + optional process restart | B-04, B-05 | Owner maintenance window | No trading enable |

### B. Missing capabilities (later)

| Phase | Objective | Resolves |
|-------|-----------|----------|
| **56.5.x Broker RO completion** | ClosedTrades if needed; deeper exposure | B-06 |
| **56.6.x DEMO execution design** | Order construct/submit/ack/reconcile (still DEMO-only, separate approval) | B-03 start |
| **56.7.x Protective SL/TP + exits** | Attached protection verification | After 56.6 |
| **56.8.x Outcome journal (optional)** | Prediction vs outcome | B-09 |

### C. DEMO-only validation

All of 56.4.x–56.7.x remain DEMO-first per Phase 56.0 OD-01.

### D. Operational hardening

Alerting, runbooks, rate limits — after or parallel to 56.4.2.

### E. Future LIVE authorization (separate owner decision)

**Not a coding phase.** Requires explicit owner release superseding Phase 56.0 OD-09/OD-10. Shared architecture already parameterized by environment; **do not** build a second engine.

### Why 56.4.0 is the correct next dependency

The readiness chain stops at **simulationDataReadiness** for honest production drafts. Market data and reconnect work (56.3.x) removed the prior “no LIVE quotes / no restore” blockers for data. Remaining CRITICAL sim blockers are **quantity and CondDist attestation**. Execution work before those gates would invent false readiness.

---

## 10. Acceptance criteria (proposed next phases)

### Phase 56.4.0

- [ ] XAU DEMO: `quantity_constraints` gate READY with attested min/step/unit  
- [ ] XAU DEMO: `min_stop` READY or explicit verified no-positive-minimum  
- [ ] Currency conversion: USD READY; non-USD fail-closed with precise reason  
- [ ] `readyForSimulationDraft` can become true **only** when all required gates READY  
- [ ] `placesOrders=false`, `acceptsForExecution=false`, master OFF, emergency ON  
- [ ] No broker mutations; allowlist still XAU-only  

### Phase 56.4.1

- [ ] Interactive Scenario 1 PASS on production under genuine LIVE XAU quote  
- [ ] Stale quote still rejects draft  
- [ ] Responsive AT UI re-checked  

### Phase 56.4.2

- [ ] Authorized disconnect → stale → restore → fresh LIVE for intended symbols  
- [ ] Optional authorized restart → hydrate → no false LIVE before tick  

---

## 11. Explicit exclusions and owner decisions still required

**Excluded from next work unless owner says otherwise:**

- Broker order place/modify/cancel/close  
- Enabling `masterTradingEnabled` or clearing emergency lock  
- Expanding allowlist beyond XAU/USD  
- LIVE execution  
- Autonomous trading  

**Owner decisions still required:**

1. Authorize Phase 56.4.0 scope (sim gates only).  
2. Whether to schedule authorized prod disconnect/restart (56.4.2).  
3. Whether ClosedTrades RO is required before DEMO execution design.  
4. Whether outcome journal is in scope.  
5. Any future DEMO execution phase — **separate** written approval.  
6. Any future LIVE release — **separate** written approval.

---

## 12. Final readiness classification

| Question | Answer |
|----------|--------|
| Is Automatic Trading LIVE-ready? | **No** |
| Is DEMO broker execution ready? | **No** |
| Is simulation draft ready for reliable production Scenario 1? | **Not yet** — blocked primarily by quantity/CondDist gates (+ interactive LIVE acceptance) |
| Is market-data foundation adequate to proceed on sim gates? | **Yes**, with known ops evidence gaps (prod disconnect/restart) |
| Audit classification | **`AUDIT_COMPLETE — READY_FOR_NEXT_PHASE`** |
| Proposed next phase | **56.4.0 — Simulation Data Gates Closure** |

---

*End of master audit. STOP — await explicit owner approval before any implementation phase.*
