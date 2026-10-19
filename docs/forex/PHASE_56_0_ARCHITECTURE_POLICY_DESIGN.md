# Phase 56.0 — Architecture & Owner Policy Freeze

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** Design and policy freeze only  
**Status:** DRAFT FOR OWNER REVIEW (v0.2 — shared DEMO/LIVE architecture clarified)  
**Baseline commit referenced:** `2cfa3a50` (repository HEAD at document authoring)  
**Authoring date (UTC):** 2026-10-19  
**Review amendment (UTC):** 2026-10-19  

**This document does not authorize implementation, broker submission, or LIVE trading.**

---

## 1. Executive summary

KWIZERA already implements a **read-only** automated-trading (AT) pipeline:

FXCM ForexConnect session → account/instrument verification (Phase 52) → live Offers quotes with freshness gates → OpenAI multimodal analysis (Phase 53) → persistent monitoring (Phase 53.3) → Phase 54 `ACCEPTED_FOR_REVIEW` decisions.

Execution is intentionally forbidden: master switch OFF, emergency entry lock ON, `placesOrders = false`, `acceptsForExecution = false`, and order-like API paths return `EXECUTION_FORBIDDEN`.

**Phase 56.0 freezes architecture and owner policy** so later phases can add:

1. Simulation-only risk and SL/TP validation.  
2. Durable trade **drafts** (highest permitted outcome in this design era).  
3. Read-only broker-state verification (Orders/Trades tables — not yet in the sidecar).  
4. Only after **separate** approvals: controlled DEMO execution, reconciliation, exit management, and eventual LIVE review.

**Shared-engine rule (owner-confirmed):** Design and implement **one** trading architecture parameterized by environment (`DEMO` | `LIVE`). Do **not** build a DEMO-only engine that must be rewritten for LIVE. Operational authorization remains **DEMO first**; LIVE **execution** stays unauthorized until a separate release gate. Environment isolation (profiles, `environmentEpoch`, per-env state) already exists in AT types and must be preserved on every draft, intent, and audit record.

**Highest permitted operational outcome under this freeze:** a validated draft awaiting separate approval — never broker submission.

---

## 2. Confirmed owner decisions (Phase 56.0)

| ID | Decision | Value |
|----|----------|--------|
| OD-01 | Initial environment | FXCM **DEMO** first |
| OD-02 | Instrument allowlist | **XAU/USD only** |
| OD-03 | Risk configuration | **Simulation first** |
| OD-04 | Risk percentage | **Not decided** — must not be assumed or activated |
| OD-05 | Trade eligibility | Both **SL and TP** must be validated before eligibility |
| OD-06 | Execution mode | **Draft-only** |
| OD-07 | Broker submission | **Forbidden** |
| OD-08 | Exit policy direction | Approved protective SL/TP + broker position checks (design intent) |
| OD-09 | LIVE trading | **Not authorized** |
| OD-10 | Autonomous order place/modify/cancel/close | **Not authorized** in Phase 56.0 |
| OD-11 | Architecture span | **One shared architecture** for DEMO and LIVE (environment as a parameter). No second trading engine for LIVE. LIVE execution still requires a separate owner release. |

These decisions **do not** authorize any broker interaction that changes trading state.

---

## 3. Mandatory safety invariants

Non-negotiable for all subsequent phases unless an **explicit, separate** owner release document supersedes them:

1. Master trading switch remains **OFF**.  
2. Emergency entry lock remains **ON**.  
3. `placesOrders` remains **`false`**.  
4. `acceptsForExecution` remains **`false`**.  
5. Existing execution-forbidden protections remain effective (API path guards, type-level false literals).  
6. No order submission, cancellation, modification, or position-closing request may be issued.  
7. No execution lock, account mode, or broker credential setting may be modified by implementation phases without explicit approval.  
8. Do not place test orders, including DEMO orders, until a separately approved execution phase.  
9. Do not use real account credentials in reports, source code, logs, or generated artifacts.  
10. An AI BUY/SELL decision is **not** authorization to trade.  
11. An `ACCEPTED_FOR_REVIEW` decision is **not** an executable trade.  
12. Valid SL and TP are **necessary but not sufficient** for trade eligibility.  
13. Missing, stale, inconsistent, or unverifiable market/account data must **prevent** eligibility (fail-closed).  
14. No LIVE execution without a separate, explicit owner-approved phase and release gate.  
15. A timeout or missing broker response must **never** be interpreted as proof that an order failed or succeeded.

---

## 4. Current-state evidence and component classification

### 4.1 Evidence sources (read-only inspection)

| Area | Primary paths |
|------|----------------|
| Sidecar | `services/forexconnect-sidecar/server.py`, `README.md`, `requirements.txt` |
| Provision / runtime | `deploy/provision-forexconnect.sh` (pip pin default `1.6.43`, Python 3.7 venv), `deploy/kwizera-forexconnect.service` |
| Node bridge | `ai/market-data/forexconnect/client.ts`, `live-service.ts`, `stream-state.ts` |
| AT core | `ai/forex-ai/automated-trading/**` (service, verification, analysis, monitoring, decision, stores) |
| AT API | `dev/server/forex-automated-trading-api.ts`, `dev/server/forex-admin-auth.ts` |
| Phase 45 sizing (adjacent) | `ai/forex-ai/position-sizing/**` |
| UI | `desktop/forex/ForexAutomatedTradingPage.tsx` |
| Prior docs | `docs/forex-forexconnect-phase33.md` … `phase35.md`, `docs/forex-fxcm-forexconnect-investigation.md` |

### 4.2 Classification legend

- **A — Verified exists** in current source and used by AT (or clearly reusable).  
- **B — Exists but incomplete / not connected** to the AT execution workflow.  
- **C — Missing.**  
- **D — Unverified** (SDK/broker behavior or method contract not confirmed for the installed package).

### 4.3 Component matrix

| Component | Class | Notes |
|-----------|-------|--------|
| ForexConnect sidecar (localhost bind) | A | Connect/disconnect, instruments, accounts, candles, subscribe/quotes/stream |
| Node ForexConnect bridge | A | Mirrors sidecar; status advertises `trading: "DISABLED"` |
| DEMO/LIVE profile vault (Forex Admin) | A | Encrypted credentials; AT selects environment with epoch |
| Account discovery + masked identity | A | Accounts table RO; Phase 52 identity verification |
| Offers instrument metadata | A / B | Catalog + optional TradingSettings fields; quantity/margin soft blockers |
| Market quote freshness (15s policy) | A | Shared Phase 52 / 53.3 / 54 contract |
| OpenAI AT multimodal analysis | A | Chart image required on monitor path; confidence NOT CALIBRATED |
| Phase 54 decision engine | A | `ACCEPTED_FOR_REVIEW` / `REJECTED`; never accepts for execution |
| Monitoring worker + chart evidence | A | Persists `monitoring.json`; analysis blocked on stale quotes |
| Persistence (settings, analysis, decisions, audit) | A | Under `forex-automated-trading/` storage |
| Admin API token gate | A | Production `require-admin-token` |
| Execution path lock | A | Order-like paths → `EXECUTION_FORBIDDEN` |
| Phase 45 position-sizing engine | B | Used by Forex AI Analysis plans; **not** AT draft/risk gate |
| Structural SL/TP candidates (decision risk context) | B | Informational; not AT eligibility validator |
| XAU/USD allowlist enforcement | C | Not a hard AT policy gate today (selection is free within FC catalog) |
| Trade proposal / draft generator | C | No draft schema or store |
| AT simulation risk engine | C | `riskEngineVerified` forced false |
| Durable trade-intent / lifecycle store | C | No order-intent persistence |
| Sidecar Orders / Trades / ClosedTrades readers | C | No routes or table usage |
| Broker execution adapter | C | Forbidden; not present |
| Order/position reconciliation | C | `openPositionsCount` prepared in status but not populated from FC tables |
| Protective-order verification | C | Not implemented |
| Exit management policy engine | C | Not implemented |
| Exact FC 1.6.43 order API method names / params | D | Pip pin known; package method inventory not verified in 56.0 |
| Attached SL/TP / TIF / partial-fill semantics on DEMO | D | Must be proven in a later read-only or separately approved DEMO phase |
| CondDist / min stop distance fields | D | Sidecar deliberately does not map ambiguous distance fields to lot step |

### 4.4 Sidecar HTTP surface (verified)

**Present:** `GET /health|/status|/instruments|/accounts|/candles|/quotes|/quote|/stream/status`; `POST /connect|/disconnect|/subscribe|/unsubscribe`.  

**Absent:** any create/modify/cancel/close order or position endpoint.

### 4.5 Persistence layout (verified)

| File (under storage root `forex-automated-trading/`) | Purpose |
|------------------------------------------------------|---------|
| `settings.json` | Env controls, verification snapshot, audit |
| `monitoring.json` | Worker config + health |
| `openai-analysis-history.json` | AT analyses |
| `trading-decisions.json` | Phase 54 decisions |
| *(future)* `trade-drafts.json` / `trade-intents.json` | Not present — proposed in roadmap |

---

## 5. Target architecture

### 5.1 Design principles

1. **Separation of concerns:** market observation ≠ analysis ≠ review decision ≠ draft ≠ risk simulation ≠ broker I/O.  
2. **Fail-closed:** any unverifiable input blocks eligibility.  
3. **Draft ceiling (56.x until separate approval):** no state may submit to the broker.  
4. **Idempotency-first:** any future submission path must persist intent before network I/O.  
5. **Timeout ≠ outcome:** ambiguous broker I/O requires reconciliation (future phases).  
6. **Reuse before rebuild:** keep Phase 52–54 engines; add adapters rather than duplicating OpenAI or verification.  
7. **Shared DEMO/LIVE engine (OD-11):** one lifecycle, one draft/intent schema, one risk validator, one future execution adapter interface — all keyed by `environment` + `environmentEpoch`. Policy gates (which env may draft / submit) are configuration and release controls, **not** duplicated code paths.  
8. **DEMO/LIVE separation safeguards:** separate credential profiles; never mix DEMO and LIVE session credentials; reject cross-environment evidence (analysis/decision/verification must match draft `environment` and epoch); LIVE submit remains release-gated even when LIVE drafts or RO verification exist.

### 5.2 Logical components (target)

```
┌─────────────────────────────────────────────────────────────────┐
│ Forex Admin / AT UI (read + config; no broker mutate)           │
└────────────────────────────┬────────────────────────────────────┘
                             │ Admin-authenticated API
┌────────────────────────────▼────────────────────────────────────┐
│ Automated Trading Service                                        │
│  · Env / epoch / controls / allowlist (XAU/USD)                  │
│  · Phase 52 verification + freshness                             │
│  · Phase 53.3 monitor worker                                     │
│  · Phase 53 analysis                                             │
│  · Phase 54 decision (ACCEPTED_FOR_REVIEW)                       │
│  · Draft builder (future 56.2+)                                  │
│  · Simulation risk + SL/TP validator (future 56.2+)              │
│  · Intent store + lifecycle (future 56.3+)                       │
│  · Execution adapter (FUTURE — gated; OFF by default)            │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
     ┌──────────▼──────────┐       ┌──────────▼──────────┐
     │ FC Node Bridge      │       │ OpenAI (analysis)   │
     └──────────┬──────────┘       └─────────────────────┘
                │ localhost only
     ┌──────────▼──────────┐
     │ FC Python Sidecar   │  ← market + accounts today;
     │ ForexConnect SDK    │    Orders/Trades RO later (56.1);
     └─────────────────────┘    submit never until 56.4+ approval
```

### 5.3 Data flow (draft-only era)

1. **OBSERVING_MARKET** — Sidecar Offers + AT monitor; freshness evaluated continuously.  
2. **ANALYSIS_READY** — OpenAI analysis `ANALYSIS_VALID` with chart evidence + fingerprint.  
3. **DECISION_ACCEPTED_FOR_REVIEW** — Phase 54 accept; still non-executable.  
4. **DRAFT_CREATED** — Assemble proposed side, instrument (XAU/USD), entry reference, provisional SL/TP candidates, links to analysisId / decisionId / evidence fingerprint / environmentEpoch.  
5. **VALIDATING** — Simulation risk + SL/TP + contract + account + freshness + allowlist + invariants.  
6. Terminal for 56.0 design ceiling:  
   - **REJECTED_LOCAL** — fail-closed with reasons, or  
   - **ELIGIBLE_FOR_SEPARATE_APPROVAL** — draft frozen for human/owner process; **no** transition to submission.

### 5.4 Component responsibilities

| Component | Responsibility | Must not |
|-----------|----------------|----------|
| Sidecar | SDK session, RO market/account (and later RO orders/positions) | Place/modify/cancel/close |
| Bridge | Sanitize, timeout, map errors | Invent quotes or sizes |
| Verification | Account/instrument/market gates | Set `readyForTrading` true |
| Analysis | Directional forecast + evidence | Authorize tickets |
| Decision | Review acceptance | Set `acceptsForExecution` true |
| Draft builder | Snapshot proposal inputs | Call broker |
| Sim risk | Size / exposure / SL-TP checks in simulation | Use undecided risk % as if approved |
| Intent store | Durability + audit | Auto-submit |
| Future adapter | Only after explicit phase approval | Run without locks + human gate |

---

## 6. Trade lifecycle and state-transition rules

### 6.1 Phase 56.0–56.3 permitted states

#### `OBSERVING_MARKET`

| Aspect | Rule |
|--------|------|
| Entry | Monitor enabled; session connected; instrument XAU/USD selected (once allowlist enforced) |
| Evidence | Stream state, last price-change age, verification snapshot age |
| Permitted | Refresh quotes, verify, schedule/run analysis when fresh |
| Forbidden | Draft eligibility claims without analysis; any broker mutate |
| Timeout / recovery | Stale quotes → block analysis; reconnect session; do not fabricate LIVE |
| Audit | Monitor health transitions, verification_completed |

#### `ANALYSIS_READY`

| Aspect | Rule |
|--------|------|
| Entry | `ANALYSIS_VALID`; chart included when required; fingerprint present; instrument/env match |
| Evidence | analysisId, fingerprint, image hash, quote context at analysis time |
| Permitted | Phase 54 validate |
| Forbidden | Treat as trade ticket |
| Timeout / recovery | Superseded by newer analysis → prior not eligible for new drafts |
| Audit | monitor_manual_analysis / scheduled analysis events |

#### `DECISION_ACCEPTED_FOR_REVIEW`

| Aspect | Rule |
|--------|------|
| Entry | Phase 54 all required checks PASS; quote fresh at decision time |
| Evidence | decisionId, checks[], fingerprint, `acceptsForExecution: false` |
| Permitted | Create draft (future), human review UI |
| Forbidden | Submission; implying calibrated win probability |
| Timeout / recovery | Decision ages out per policy (owner undecided — see register); re-validate before draft |
| Audit | `decision_accepted_for_review` |

#### `DRAFT_CREATED`

| Aspect | Rule |
|--------|------|
| Entry | Linked ACCEPTED_FOR_REVIEW + allowlist + draft schema version + **environment tag** matching the decision/verification epoch. **Operational policy (DEMO first):** under this freeze, only `environment=DEMO` drafts may be created until the owner explicitly allows LIVE simulation drafts (URD-20). The **schema and engine** must still accept `DEMO` \| `LIVE` so LIVE does not require a rebuild. |
| Evidence | draftId, analysisId, decisionId, `environment`, `environmentEpoch`, proposed side, SL/TP candidates |
| Permitted | Run validation; display; discard |
| Forbidden | Broker calls; creating a draft whose environment disagrees with session/verification; treating LIVE drafts as executable |
| Timeout / recovery | Persist draft; restart must reload without inventing broker ids |
| Audit | `draft_created` |

#### `VALIDATING`

| Aspect | Rule |
|--------|------|
| Entry | Explicit validate action on draft |
| Evidence | Freshness eval, account snapshot, contract fields, sim risk outputs, SL/TP check results |
| Permitted | Fail-closed reject or mark eligible-for-separate-approval |
| Forbidden | Side effects on broker; mutating locks |
| Timeout / recovery | Incomplete validation → REJECTED_LOCAL or remain draft (prefer reject if ambiguous) |
| Audit | `draft_validation_*` with reason codes |

#### `REJECTED_LOCAL`

| Aspect | Rule |
|--------|------|
| Entry | Any validation failure or invariant breach |
| Evidence | Structured rejectionReasons[] |
| Permitted | Revise inputs / new analysis; archive |
| Forbidden | Retry submission (N/A); silent swallow |
| Audit | Full reason codes |

#### `ELIGIBLE_FOR_SEPARATE_APPROVAL`

| Aspect | Rule |
|--------|------|
| Entry | All validation PASS including SL+TP; simulation risk runnable **only if** owner risk budget is configured — otherwise cannot reach this state |
| Evidence | Validation report hash; still `placesOrders: false` |
| Permitted | Owner/human approval workflow **outside** broker submit |
| Forbidden | **Any** transition to `SUBMISSION_PENDING` under Phase 56.0–56.3 |
| Audit | `draft_eligible_for_separate_approval` |

### 6.2 Future states (only after explicit execution-phase authorization)

Proposed additions (not enabled by this document):

| State | Intent |
|-------|--------|
| `SUBMISSION_PENDING` | Request in flight; intent already durable |
| `SUBMISSION_UNKNOWN` | Timeout/disconnect — **must query broker before retry** |
| `BROKER_ACKNOWLEDGED` | Broker order/request id known |
| `WORKING` | Working/pending at broker |
| `PARTIALLY_FILLED` | Only if SDK/account proven to support |
| `FILLED` | Authoritative fill qty/avg from broker |
| `REJECTED_BY_BROKER` | Terminal reject; new intent required |
| `CANCEL_PENDING` / `CANCELLED` | Cancel path |
| `CLOSE_PENDING` / `CLOSED` | Exit path |
| `PROTECTION_VERIFY_PENDING` / `PROTECTION_ACTIVE` / `PROTECTION_FAILED` | Post-fill SL/TP verification |
| `RECONCILIATION_REQUIRED` | Local ≠ broker or ambiguous |

**Phase 56.0 ceiling:** no transition into any submission or broker-mutate state.

---

## 7. Simulation risk design (simulation first)

### 7.1 Goals

- Compute **hypothetical** position size and exposure for drafts.  
- Fail closed when inputs or **owner-approved risk budget** are missing.  
- **Do not** invent or activate a risk percentage (OD-04).

### 7.2 Intended inputs (future engine)

| Input | Source (target) | If missing |
|-------|-----------------|------------|
| Equity / usable margin | FC Accounts snapshot (RO) | Reject |
| Owner risk budget | Explicit settings (fixed amount or % **only after OD**) | Reject — cannot assume % |
| Side | Draft from analysis/decision | Reject |
| Entry reference | Fresh Bid/Ask + draft policy | Reject if stale/inconsistent |
| Stop loss price | Draft SL (required) | Reject |
| Take profit price | Draft TP (required) | Reject |
| Contract: baseUnitSize, qty min/step, pointSize, margin/lot | Offers + TradingSettings (verified fields only) | Reject if insufficient for sizing |
| Conversion rates | Only if needed and verified | Reject if required and missing |
| Existing exposure | Future broker position RO | Reject or treat as max-conservative per policy (owner) |
| Daily loss / aggregate caps | Owner settings | Reject if policy requires them and unset |

### 7.3 Intended calculation outline (conceptual)

1. Validate side, SL, TP direction and distances (Section 8).  
2. Compute stop distance in instrument price units / points using **verified** pointSize only.  
3. If owner budget is a **fixed account-currency amount**, size ≈ f(budget, stop distance, contract, pip/point value).  
4. If owner later approves a **percentage**, size from equity × pct — **not before**.  
5. Floor to quantity step; enforce min quantity; re-check estimated margin ≤ usable margin × policy headroom.  
6. Apply max position / aggregate / daily-loss caps when configured.  
7. Emit `SIMULATION_ONLY` result: size, estimated risk money, RR, blockers — never a broker ticket.

Reuse candidates: `ai/forex-ai/position-sizing/calculate.ts` patterns — adapted behind AT draft API, with **environment-scoped** Accounts equity/margin (DEMO or LIVE session matching the draft) rather than manual-only settings where possible.

### 7.4 Hypothetical example (not owner settings)

> **Hypothetical only.** Assume equity 10,000 account currency, owner later sets fixed risk 50, stop distance implies 1.0 currency risk per quantity unit, step 1 → simulated size 50.  
> **This is not an approved risk percentage or size.** It must not be copied into production defaults.

### 7.5 Fail-closed rules

- Undecided risk budget → cannot reach `ELIGIBLE_FOR_SEPARATE_APPROVAL`.  
- Unverified contract step/min → reject.  
- Stale quotes → reject.  
- Non–XAU/USD → reject (once allowlist enforced).  
- **Policy gate (not architecture exclusion):** under this freeze, drafts with `environment=LIVE` are rejected for creation/eligibility until URD-20 allows LIVE simulation drafts; LIVE **submission** remains forbidden until a separate LIVE release (OD-09 / URD-18). The shared engine must still model LIVE so enabling it later is a gate change, not a rewrite.

---

## 8. SL/TP validation and exit-policy design

### 8.1 Eligibility requirement (confirmed)

Both SL and TP must **validate** before a draft can become `ELIGIBLE_FOR_SEPARATE_APPROVAL`.

### 8.2 Proposed validation checks

| Check | BUY | SELL |
|-------|-----|------|
| SL direction | SL &lt; entry | SL &gt; entry |
| TP direction | TP &gt; entry | TP &lt; entry |
| Prices finite and &gt; 0 | Required | Required |
| Distinct levels | SL ≠ TP ≠ entry | Same |
| Distance &gt; 0 | Required | Required |
| Tick / point alignment | Only if digits/pointSize **verified** | Same |
| Min stop distance | Only if broker field **verified** (else block or soft-fail per owner — default: **block eligibility** if required and unverified) | Same |
| Reward-to-risk | Compute TP distance / SL distance; enforce owner threshold when set (undecided → compute & display only, do not invent threshold) | Same |
| Quote freshness | Entry consistent with fresh Bid/Ask (side-appropriate) | Same |
| Broker protective capability | **Unverified** until 56.1/56.5 — drafts may mark `protectionCapability: UNVERIFIED` and fail eligibility if owner requires verified attach semantics |

### 8.3 Exit policy direction (confirmed intent; not implemented)

- Protective SL/TP and **broker position checks** are the approved direction.  
- A **reverse AI signal alone must not close** a position.  
- Future exits require: separately approved triggers + verified broker position state + (when required) protective-order verification.  
- If SL/TP placement or verification fails after a future fill → enter protective-failure handling (owner register URD-15); safe default: **halt new entries**, raise `RECONCILIATION_REQUIRED` / `PROTECTION_FAILED`, do not silently leave unprotected exposure without alerting.

### 8.4 Unexpected positions

Future reconciliation must detect positions/orders not linked to local intents (manual or foreign) and mark `RECONCILIATION_REQUIRED` without auto-closing unless a later exit phase explicitly allows it.

---

## 9. Broker reconciliation and protective-order design (future)

### 9.1 Read-only first (Phase 56.1)

- Inventory installed `forexconnect==1.6.43` APIs and table enums on the VPS.  
- If Orders/Trades/ClosedTrades exist: implement **read-only** sidecar endpoints mirroring accounts/instruments patterns.  
- Document field maps; mask identifiers in logs.

### 9.2 After any future DEMO submit (56.4+)

1. Persist intent with idempotency key **before** call.  
2. On timeout → `SUBMISSION_UNKNOWN` → query Orders/Trades → then decide.  
3. Never double-submit the same idempotency key.  
4. On fill → verify protective orders present/active if required.  
5. Continuous poll distinct from Offers quote poller.

### 9.3 SDK honesty rule

No document section may claim a specific FXCM order type, TIF, or attach API is supported until 56.1 (or later) evidence is attached to this design pack.

---

## 10. Unresolved owner decision register

| Decision ID | Policy question | Why it matters | Recommended safe default | Alternatives | Consequence if unresolved | Owner decision required | Status |
|-------------|-----------------|----------------|--------------------------|--------------|---------------------------|-------------------------|--------|
| URD-01 | Maximum risk per trade | Sizing core | Draft-only; **no** numeric default activated | Fixed money; % of equity | Cannot mark ELIGIBLE | Yes | UNDECIDED |
| URD-02 | Max daily loss / loss-streak | Capital protection | Block new drafts when unset | Soft warn only | Unlimited simulated risk framing | Yes | UNDECIDED |
| URD-03 | Max open positions / aggregate exposure | Over-leverage | Max 0 broker positions for eligibility until set | N≥1 | Cannot reconcile exposure | Yes | UNDECIDED |
| URD-04 | Only one XAU/USD position at a time? | Flat-book simplicity | **Yes** (propose) | Allow pyramiding | Ambiguous net exposure | Yes | PROPOSED |
| URD-05 | Approved order types | Adapter design | Unset → no eligibility | Market / limit / stop (if verified) | Cannot build tickets | Yes | UNDECIDED |
| URD-06 | Time-in-force (GTC/GTD/…) | Order validity | Unset → no eligibility | Per verified SDK | Illegal TIF risk | Yes | UNDECIDED |
| URD-07 | Required reward-to-risk threshold | SL/TP quality | Display RR only; no hard min until set | e.g. ≥1.5 | Weak TP discipline | Yes | UNDECIDED |
| URD-08 | Minimum AI confidence | Model NOT CALIBRATED | **No** hard min (align Phase 54 default) | Enable threshold explicitly | False precision if forced | Yes | PROPOSED |
| URD-09 | Human approval per future DEMO order | Safety | **Required** before any submit phase | Batch approve | Unauthorized automation | Yes | PROPOSED |
| URD-10 | Max quote age / price deviation at submit boundary | Slippage | Keep 15s freshness; deviation band unset → reject if unset at submit era | Widen age (discouraged) | Stale fills | Yes | UNDECIDED |
| URD-11 | Unverifiable account/margin/instrument/broker state | Fail-closed | **Reject eligibility** | Degrade to manual | Unsafe drafts | Yes | PROPOSED |
| URD-12 | Retry after ambiguous submission | Duplicate orders | No retry until reconcile; max 0 auto-retries | Bounded retry | Double orders | Yes | PROPOSED |
| URD-13 | Restart: existing positions / pendings | Recovery | Detect & attach/report; do not auto-close | Auto-flatten (dangerous) | Orphan risk | Yes | UNDECIDED |
| URD-14 | Protective-order verify after fill | OD-08 | Required before “healthy filled” | Best-effort warn | Naked positions | Yes | PROPOSED |
| URD-15 | If SL/TP place/verify fails | Protection gap | Halt entries + alert + reconcile | Auto emergency close (needs approval) | Undefined response | Yes | UNDECIDED |
| URD-16 | Permitted future exit triggers | Exit engine | Protective hit / owner command / approved rules only — **not** AI reverse alone | Time stop; news halt | Premature closes | Yes | PROPOSED |
| URD-17 | Authorize DEMO execution in a separate phase? | Roadmap gate | Only via explicit phase approval doc | Never | 56.4 blocked | Yes | UNDECIDED |
| URD-18 | Conditions before LIVE review | Capital risk | DEMO metrics + reconcile + failure tests + legal/EULA review | Skip DEMO (reject) | Premature LIVE | Yes | UNDECIDED |
| URD-19 | Monitoring, notifications, audit retention, escalation | Ops | Retain audits ≥ existing AT audit capacity; escalate protection failures | TBD channels | Silent failures | Yes | UNDECIDED |
| URD-20 | Allow LIVE **simulation drafts** (still non-submitting) before LIVE execution release? | Shared engine vs DEMO-first ops | **No** — DEMO-only draft creation until explicitly allowed; schema still supports LIVE | Yes — LIVE sim drafts for dry-run | If forever DEMO-only in code → forces LIVE rewrite (violates OD-11) | Yes | PROPOSED |

**No row above is owner-approved except by future signature.** Confirmed decisions are only those in Section 2 (`OD-*`). `PROPOSED` / `UNDECIDED` are **not** approvals.

---

## 11. Phased implementation roadmap

> Completing Phase 56.0 **does not** start Phase 56.1. Each phase requires explicit owner approval.

### Phase 56.0 — Architecture & owner-policy design (this document)

| | |
|--|--|
| **Scope** | Design artifact + decision register only |
| **Prerequisites** | Prior AT Phases 51–55.x stable; execution locks intact |
| **Acceptance** | Document reviewed; checklist in §14 completed by owner |
| **Failure** | Ambiguous policy left marked APPROVED without signature |
| **Forbidden** | Code enabling trading; orders; lock changes; deploy-for-trading |

### Phase 56.1 — Read-only ForexConnect capability verification (DEMO-first ops)

| | |
|--|--|
| **Scope** | Inventory SDK 1.6.43 methods/tables; optional RO Orders/Trades readers; XAU/USD metadata matrix. Prefer DEMO session for probes. Interfaces and field maps must be **environment-agnostic** (same code for LIVE RO later). |
| **Prerequisites** | 56.0 owner acknowledge; DEMO credentials via existing vault |
| **Acceptance** | Evidence pack: supported tables/fields; explicit UNVERIFIED list updated; no DEMO-only hardcoding in RO API shapes |
| **Failure** | Any create/modify/cancel/close call |
| **Forbidden** | Order submission; LIVE execution; changing locks; building a DEMO-only sidecar contract |

### Phase 56.2 — Simulation risk + trade-draft validation

| | |
|--|--|
| **Scope** | Draft schema with mandatory `environment` + `environmentEpoch`; XAU/USD allowlist; SL+TP validator; sim risk **without** inventing risk %; wire to Phase 54. Policy may restrict draft **creation** to DEMO (URD-20) while schema supports LIVE. |
| **Prerequisites** | 56.1 evidence for sizing fields; URD-01 still may block ELIGIBLE |
| **Acceptance** | Drafts reach REJECTED_LOCAL or ELIGIBLE_FOR_SEPARATE_APPROVAL; `acceptsForExecution` still false; env mismatch rejects |
| **Failure** | Draft path calls broker; DEMO-only types that cannot represent LIVE |
| **Forbidden** | Submission; activating undecided risk % |

### Phase 56.3 — Durable intents & lifecycle (no submit)

| | |
|--|--|
| **Scope** | Persist drafts/intents; state machine through ELIGIBLE; restart recovery; idempotency keys prepared; per-environment isolation in storage |
| **Prerequisites** | 56.2 acceptance |
| **Acceptance** | Restart preserves drafts; duplicate draft detection; DEMO and LIVE records never cross-attach |
| **Failure** | Transition to SUBMISSION_* |
| **Forbidden** | Broker mutate |

### Phase 56.4 — Separately authorized controlled DEMO execution

| | |
|--|--|
| **Scope** | Narrow **shared** execution adapter behind locks + human approval (URD-09); single instrument; adapter parameterized by environment but **release gate allows DEMO only** |
| **Prerequisites** | Explicit new owner approval document; 56.1–56.3 done; URD-05/06/01 decided |
| **Acceptance** | End-to-end DEMO fill/reject observed with audit; kill-switch works; LIVE submit still impossible without separate gate |
| **Failure** | LIVE leak; auto-trading without human gate; DEMO-only fork of engine |
| **Forbidden** | LIVE submit; autonomous unmanaged submits |

### Phase 56.5 — Reconciliation & protective-order verification

| | |
|--|--|
| **Scope** | Broker poll; SUBMISSION_UNKNOWN handling; protection verify states — same modules for whichever env is authorized |
| **Prerequisites** | 56.4 or RO position APIs proven |
| **Acceptance** | No duplicate orders under reconnect tests; protection failures halt entries |
| **Forbidden** | Ignoring UNKNOWN timeouts |

### Phase 56.6 — Exit management & recovery

| | |
|--|--|
| **Scope** | Approved exit triggers; close/modify paths; restart orphan handling (shared engine; env-gated) |
| **Prerequisites** | URD-16/13/15 decided; 56.5 |
| **Acceptance** | AI reverse alone never closes; exits audited |
| **Forbidden** | Unapproved exit heuristics |

### Phase 56.7 — Failure testing & LIVE-readiness assessment

| | |
|--|--|
| **Scope** | Chaos tests; release review; LIVE checklist only — assesses enabling LIVE **gates** on the **existing** shared engine |
| **Prerequisites** | 56.4–56.6 evidence |
| **Acceptance** | Written LIVE-ready **or** explicit “not ready”; no plan that requires rewriting the trading engine for LIVE |
| **Forbidden** | Enabling LIVE inside this phase without separate release gate |

**Dependency note:** 56.2 can begin skeletal draft UI after 56.0, but must not claim broker-verified min-stop or order-type support until 56.1 evidence exists. Prefer **56.1 before declaring ELIGIBLE** when checks depend on unverified broker constraints. **OD-11 check at every phase exit:** no DEMO-only fork that would force a LIVE rebuild.

---

## 12. Assumptions, unverified SDK details, and risks

### Assumptions

- DEMO ForexConnect session remains available via existing Admin profiles.  
- Phase 52–54 contracts remain the upstream gates for drafts.  
- Storage root remains durable across service restarts.  
- Sidecar continues to bind localhost only.

### Unverified (must not be coded as facts)

- Concrete order-creation / attach-SL-TP method names for installed `forexconnect` 1.6.43.  
- Whether partial fills apply to intended XAU/USD DEMO orders.  
- Exact TIF enumerations and GTD requirements.  
- Minimum stop distance field availability and units.  
- Behavior differences between DEMO and LIVE for the same ticket shape.

### Risks if phases are skipped

| Risk | Mitigation |
|------|------------|
| Double orders on retry | 56.3 idempotency + 56.5 reconcile-before-retry |
| Naked positions | URD-14/15; protection verify |
| False LIVE from heartbeats | Existing 15s price-change policy |
| Invented lot/ounce sizing | Metadata-only sizing; fail closed |
| Premature automation | Draft ceiling + human gate + separate 56.4 approval |

---

## 13. Safety confirmation (document scope)

- This artifact is **documentation only**.  
- It does not change application code, locks, credentials, or runtime configuration.  
- It does not authorize broker orders.  
- Implementation must preserve Section 3 invariants until a later owner-signed release explicitly changes them.

---

## 14. Final owner-review checklist

Owner (or delegate) should confirm:

- [ ] Section 2 confirmed decisions are accurate.  
- [ ] Section 3 invariants are accepted as binding.  
- [ ] Component classification (A/B/C/D) matches understanding.  
- [ ] Lifecycle ceiling (`ELIGIBLE_FOR_SEPARATE_APPROVAL` max) is accepted.  
- [ ] Simulation-first risk (no assumed %) is accepted.  
- [ ] SL+TP both required for eligibility is accepted.  
- [ ] AI reverse alone must not close positions is accepted.  
- [ ] Decision register reviewed; PROPOSED rows accepted or revised.  
- [ ] UNDECIDED rows acknowledged as blockers to ELIGIBLE / 56.4.  
- [ ] Roadmap phase gates understood; **56.1 not auto-started**.  
- [ ] LIVE **execution** remains unauthorized.  
- [ ] OD-11 shared DEMO/LIVE architecture (one engine, env-parameterized) is accepted.  
- [ ] URD-20 understood: DEMO-first draft **policy** vs LIVE-capable **schema**.  

**Owner sign-off (manual):**

| Field | Value |
|-------|--------|
| Name | |
| Date | |
| Decision | ☐ Approve Phase 56.0 design & freeze · ☐ Approve with comments · ☐ Reject |
| Comments | |
| Authorize start of Phase 56.1? | ☐ Yes · ☐ No (default No) |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-10-19 | Initial Phase 56.0 architecture & policy freeze for owner review |
| 0.2 | 2026-10-19 | Review fix: OD-11 shared DEMO/LIVE architecture; DEMO/LIVE separation safeguards; clarify DEMO-first as policy gate not engine fork; URD-20; roadmap env-parameterization |

**End of Phase 56.0 design artifact.**
