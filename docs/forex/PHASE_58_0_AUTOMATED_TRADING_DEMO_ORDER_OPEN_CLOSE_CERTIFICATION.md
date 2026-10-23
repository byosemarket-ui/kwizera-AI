# Phase 58.0 — Automated Trading DEMO Order Open/Close Lifecycle Certification

**Project:** KWIZERA AI STUDIO  
**Module:** Automated Trading — DEMO broker order open/close lifecycle  
**Phase:** 58.0  

**Final verdict:** `BLOCKED`

> **No DEMO broker order was submitted, filled, or closed.**  
> **No LIVE broker order was submitted.**  
> Live mutation remains inaccessible. Global Master Trading remains OFF (policy). Emergency Entry Lock remains ON (policy). General automatic entry/re-entry remain disabled.

This phase prioritized Automated Trading DEMO execution readiness over further chart/AI certification. Chart/AI work from Phase 57.7 remains available; it was deferred for *this* phase’s focus only.

---

## 1. SHAs

| Item | SHA |
|------|-----|
| Baseline (Phase 57.7 docs tip) | `6cdb2009` |
| Baseline (Phase 57.7 feature) | `f0b3d5c5` |
| Repo HEAD at inspection | `6cdb2009` |
| Deployed at live checks | `6cdb2009` (`verifiedLive=true`) |
| Phase 58.0 readiness tests + documentation | _(fill on commit)_ |

Unrelated dirty PMV/typography files preserved, not committed.

---

## 2. Mission vs reality

| Owner objective | Result |
|-----------------|--------|
| Prepare valid order from AT workflow | Intent/preflight **architecture** exists; cannot reach broker submit |
| Send order through DEMO adapter | **BLOCKED** — mutation adapter is disabled stub; no FC submit route |
| Receive broker response / order ID | **NOT_VERIFIED** — no submission performed |
| Confirm accept/reject/fill | **NOT_VERIFIED** |
| Verify position via RO broker state | RO path exists; no test position created |
| Close via DEMO adapter | **BLOCKED** — close is stub → `EXECUTION_FORBIDDEN` |
| Reconcile without fabricating success | RO reconcile helpers exist; unused for open/close this phase |

---

## 3. Stage A — Execution readiness matrix

| Capability | Classification | Evidence |
|------------|----------------|----------|
| Verified DEMO account identity (session Demo/Real stamp) | `IMPLEMENTED_BUT_UNVERIFIED` (this window) | FC connect stamps environment; AT maps session — not re-probed for mutation |
| Broker session health (RO) | `IMPLEMENTED_AND_VERIFIED` (prior phases) | Sidecar GET status/orders/trades |
| Environment / adapter routing for **mutation** | `DISABLED_BY_POLICY` / `NOT_IMPLEMENTED` | No mutation routes |
| Submit order | `DISABLED_BY_POLICY` + `NOT_IMPLEMENTED` | `DisabledBrokerMutationAdapter.submit`; API regex → 403 |
| Modify / cancel | `DISABLED_BY_POLICY` + `NOT_IMPLEMENTED` | Stub only |
| Close position | `DISABLED_BY_POLICY` + `NOT_IMPLEMENTED` | Stub `closePosition` |
| Protective SL/TP **broker-attached** | `NOT_IMPLEMENTED` | Local geometry only (`LOCAL_CALCULATED_ONLY`) |
| Broker order ID ingestion | `NOT_IMPLEMENTED` for app-owned submits | RO listOrders exists |
| Fill / partial-fill ingestion | `NOT_IMPLEMENTED` for app-owned submits | |
| Position reconciliation (RO) | `IMPLEMENTED_BUT_UNVERIFIED` for open/close lifecycle | `reconciliation.ts` + RO tables |
| Idempotency for intents | `IMPLEMENTED_AND_VERIFIED` (unit) | Intent store key dedupe |
| Authorization for DEMO mutation | `NOT_IMPLEMENTED` | `ownerExecutionAuthorized` forced `false` |
| LIVE routing | `DISABLED_BY_POLICY` | Preflight + API + FC `trading: DISABLED` |

**Exact reason `EXECUTION_FORBIDDEN` remains:**

1. API hard gate: path matching `order|position/close|submit|execute` → HTTP 403.  
2. Preflight always appends `EXECUTION_FORBIDDEN`; `maySubmitToBroker: false`.  
3. `DisabledBrokerMutationAdapter` returns `EXECUTION_FORBIDDEN` for all ops.  
4. Automation store coerces `placesOrders=false`, `acceptsForExecution=false`, `brokerExecution=DISABLED`.  
5. ForexConnect Node bridge + Python sidecar expose **GET** `/orders` / `/trades` only — no create/close POST.  
6. No time-bound, DEMO-scoped owner authorization module.

---

## 4. Call path (where submission stops)

```text
AT UI — no broker-order submit control
  → (optional) POST …/broker-intent/validate
  → ownerExecutionAuthorized forced false
  → evaluateBrokerIntentPreflight → EXECUTION_FORBIDDEN, maySubmitToBroker=false
  → DisabledBrokerMutationAdapter.submit → EXECUTION_FORBIDDEN
  → persist intent only — NO sidecar mutation HTTP

Any …/order|submit|execute|position/close…
  → 403 EXECUTION_FORBIDDEN immediately
```

Simulation open (`simulation-lifecycle/open`) remains **simulation-only** and is **not** DEMO broker execution.

---

## 5. Stage B — Why implementation was not started

Per phase rules:

- Do **not** change `placesOrders` / `acceptsForExecution` **globally**.  
- Do **not** globally enable Master Trading or disable Emergency Entry Lock.  
- If architecture cannot support a separately authorized DEMO-only path without violating the global safety contract → **stop** and report the blocker.

Missing prerequisites for a safe DEMO-only path (owner architecture phase required before coding):

1. **Time-bound DEMO authorization grant** (server-enforced, fail-closed, never LIVE).  
2. **Real ForexConnect mutation surface** in sidecar + Node bridge (SDK methods confirmed against installed FC docs — currently unwired).  
3. **Isolated adapter** that cannot route to LIVE credentials/endpoints.  
4. **Protective-order broker attachment** verification before unprotected open (if required by policy).  
5. Explicit product decision that a narrow DEMO path does not imply lifting global `placesOrders` for automation/re-entry.

Inventing SDK methods or fabricating broker responses is prohibited. Therefore **no broker mutation code was added** this phase.

---

## 6. Stages C–F — Controlled DEMO open/close

| Stage | Status |
|-------|--------|
| C Risk preflight for DEMO test order | **NOT performed** — blocked upstream |
| D Controlled DEMO open | **NOT performed** — no adapter / no DEMO auth |
| E Protective-order broker verification | **NOT performed** — broker attach `NOT_IMPLEMENTED` |
| F Controlled DEMO close | **NOT performed** |

Classification for open/close lifecycle: **`NOT_VERIFIED`** (not executed) under overall verdict **`BLOCKED`**.

---

## 7. Stage G — Tests (mock / architectural only)

```text
node ./node_modules/vitest/vitest.mjs run \
  tests/unit/ai/forex-ai/phase58-0-demo-order-lifecycle-readiness.test.ts \
  tests/unit/ai/forex-ai/phase57-0-broker-intent-architecture.test.ts \
  --reporter=dot
→ 2 files / 23 tests passed; exit 0
```

These tests **do not** contact the DEMO broker for mutation. They prove gates remain closed.

---

## 8. Stage H — UI / audit

AT UI already distinguishes broker execution as **Forbidden** / `EXECUTION_FORBIDDEN` separately from monitoring. States such as `FILLED`, `POSITION_OPEN`, `CLOSED` for **broker** lifecycle are **not** reachable until a DEMO mutation path exists.

Simulation positions must not be labeled as broker fills (existing invariant; preserved).

---

## 9. Safety invariants

Policy / code (preserved; not flipped for this test):

```text
LIVE execution = UNAUTHORIZED
placesOrders = false
acceptsForExecution = false
EXECUTION_FORBIDDEN = enforced
ForexConnect trading stamp = DISABLED
automatic broker entry = DISABLED
automatic broker re-entry = DISABLED
emergencyEntryLock = true (policy / readiness)
masterEnable must remain false for broker-safety readiness
```

**Note (from Phase 57.7 prod SPA):** Master enable **config** was observed ON in one read with product warning — broker mutation still blocked. Phase 58.0 does **not** enable Master Trading for execution and does **not** submit orders. Owner should confirm Master enable config OFF without authorizing LIVE.

---

## 10. Distinction: mock vs DEMO broker evidence

| Evidence class | This phase |
|----------------|------------|
| Unit / architecture tests | Yes |
| Production RO session / status (prior) | Referenced; not used for mutation |
| Actual DEMO order submit response / order ID | **None** |
| Actual DEMO fill / position / close | **None** |

---

## 11. Remaining blockers (owner decisions)

1. Design and approve a **narrow, time-bound DEMO authorization** that does not globally set `placesOrders=true` for automation.  
2. Audit installed ForexConnect SDK for supported open/close APIs; wire **read-only-safe** then **DEMO-only** mutation in sidecar.  
3. Define protective-order policy for first DEMO open (broker-attached vs refuse open).  
4. Only then schedule a controlled DEMO open/close certification under explicit owner authorization.

---

## 12. Next recommended step

Owner-approved **architecture** phase for DEMO-only authorization + FC mutation adapter design — **not** an automatic enablement of Master Trading or LIVE. Do not begin DEMO order submission without that design and explicit grant.
