# Phase 56.4.6 — Controlled SL Acceptance, Market-Data Recovery, Idempotency & Automated Trading Live-Readiness Audit

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading (simulation / verification only)  
**Phase:** 56.4.6  
**This phase does not authorize broker order submission, DEMO broker execution, or LIVE trading.**

**Final verdict:** `PASS_WITH_KNOWN_BLOCKERS`

---

## 1. SHAs

| Item | SHA |
|------|-----|
| Phase 56.4.4 feature baseline | `0e042426` |
| Phase 56.4.5 feature baseline | `02c029af` |
| Phase 56.4.5 documentation / pre-edit HEAD | `8369c0b6` |
| Feature commit (this phase) | `af2d1765fb1224b58b717b1c898d7eff0d0ec15f` |
| Documentation commit | _(this document)_ |
| Deployed production | `af2d1765…` (`verifiedLive=true`, `result=success`, timestamp `2026-10-22T21:28:12.063Z`) |

Production URL: `http://162.35.114.19:5173`  
Route: `/forex/automated-trading`

---

## 2. Mission outcomes

### Workstream A — Simulation acceptance gaps

| Gap | Result |
|-----|--------|
| Controlled automatic simulated Stop Loss | **VERIFIED** in unit fixtures + production Admin controlled-inject (BUY + SELL) |
| Stale quote / reconnect behavior | **VERIFIED** — stale inject → `STALE_INTERRUPTED` (no fill); fresh approach resumes `MONITORING`; then SL cross closes once |
| Exactly-once close / no duplicate P/L | **VERIFIED** — duplicate inject after close → `SIM_INJECT_INVALID_STATE`; duplicate manual close after SL → idempotent, exit reason preserved |
| Exit audit + quote reference + persistence | **VERIFIED** — audit `CONTROLLED_INJECT … STOP_LOSS_HIT … R=… q=dq_…` before upsert; `exitQuoteSnapshotId` set |
| Safety-state re-verify | **VERIFIED** (see §7) |

### Workstream B — Live-readiness audit

Evidence-based matrix in §8. **Simulation GO** (with known blockers). **DEMO broker execution NO-GO.** **LIVE NO-GO / BLOCKED.** Audit did **not** authorize or enable real trades.

---

## 3. Confirmed defects / capabilities delivered

| Item | Change |
|------|--------|
| Production automatic SL was unobservable without waiting for adverse market move | Admin-gated, simulation-only `POST …/simulation-lifecycle/controlled-inject` (`sl_cross` \| `sl_approach` \| `stale`) |
| No deterministic SL acceptance path in UI | UI buttons **Controlled SL (sim)** / **Controlled stale** — never broker |
| Gap-fill / approach helpers undocumented in fixtures | `proposeControlledSlCrossingLevels` / `proposeControlledSlApproachLevels` |
| Audit for controlled path | Close audit before upsert with `CONTROLLED_INJECT`; approach/stale write `simulation_controlled_inject` |

Unrelated PMV/typography/video dirty files were **not** staged.

---

## 4. Files changed (feature)

| File | Why |
|------|-----|
| `simulation-lifecycle.ts` | Controlled SL level helpers |
| `service.ts` | `injectControlledSimMonitorTick` (audit-before-upsert) |
| `forex-automated-trading-api.ts` | Admin-gated controlled-inject route |
| `ForexAutomatedTradingPage.tsx` | Controlled inject UI |
| `phase56-4-6-controlled-sl-and-readiness.test.ts` | Focused acceptance fixtures |

---

## 5. Tests

### 5.1 Unit / synthetic (lightweight)

```text
vitest phase56-4-6-controlled-sl-and-readiness.test.ts
→ 12 passed (12)
```

Coverage: BUY/SELL controlled cross → `STOP_LOSS_HIT` at mark; approach does not close; gap fill ≠ exact SL; stale fixture cannot invent fill; FEED_NOT_LIVE then fresh cross once; duplicate manual close after SL idempotent; same-tick SL preference; re-entry disabled; wiring asserts for inject/API/UI/safety.

Regression retained from Phase 56.4.5 suite (not re-run in this session’s final pass; 56.4.6 suite embeds the critical SL/stale/idempotency cases).

### 5.2 Broker-execution tests

**Not performed** (out of scope; mutation paths absent / forbidden).

---

## 6. Production evidence (authorized Admin, simulation-only)

### 6.1 Deployed SHA

`/api/deployment`: `deployedCommit=af2d1765…`, `verifiedLive=true`, `result=success`.

### 6.2 Controlled BUY SL sequence (`sim_mvk3jbgt_4bq6qr`)

| Step | Result |
|------|--------|
| Draft `VALIDATION_PASSED` + open | `MONITORING`, `placesOrders=false` |
| `mode=stale` | `STALE_INTERRUPTED`, `exitReason=null` |
| `mode=sl_approach` | `MONITORING`, `exitReason=null` |
| `mode=sl_cross` | `SIMULATED_CLOSED`, `STOP_LOSS_HIT`, `exitQuoteSnapshotId=dq_24fdc24be9f5ac77`, `achievedR≈-1.014`, `realizedPnl=null` |
| Duplicate `sl_cross` | `SIM_INJECT_INVALID_STATE` |

### 6.3 Controlled SELL SL (`sim_mvk3jve3_taw308`)

| Step | Result |
|------|--------|
| `sl_cross` | `STOP_LOSS_HIT`, `exitQuoteSnapshotId=dq_0689eb5bc36e340c`, `achievedR≈-1.026` |
| Manual close after SL | `ok`, **idempotent**, exit reason remains `STOP_LOSS_HIT` |

### 6.4 Audit trail (excerpt)

- `simulation_controlled_inject` / `CONTROLLED_STALE`
- `simulation_controlled_inject` / `CONTROLLED_SL_APPROACH`
- `simulation_position_closed` / `STOP_LOSS_HIT` detail includes `CONTROLLED_INJECT … R=… q=dq_…`

### 6.5 Simultaneous SL/TP policy

Documented and tested: **Stop Loss wins** over Take Profit on the same evaluation tick (conservative; never prefer profitable TP). Gap fill = executable mark (BUY=bid, SELL=ask), not necessarily exact SL/TP.

---

## 7. Current safety-state evidence

| Check | Value | Evidence |
|-------|-------|----------|
| ForexConnect trading | **DISABLED** | Market-data status: `capabilities.trading=false`, `tradingEnabled=false`, notes include `Trading: DISABLED` |
| `placesOrders` | **false** | Status + lifecycle + inject responses |
| `acceptsForExecution` | **false** | Lifecycle status + inject responses |
| `EXECUTION_FORBIDDEN` | **403** | `POST /api/forex/automated-trading/order/submit` |
| Master Trading | **OFF** (`masterEnable=false`) | Status controls |
| Emergency Entry Lock | **ON** | Status controls |
| Automatic entry | **DISABLED** | Status controls |
| Automatic re-entry | **DISABLED** | Lifecycle `autoReentryEnabled=false` |
| Module status | **BLOCKED** | Status |
| `readyForTrading` | **false** | Readiness |
| Broker open positions (RO) | **0** | `broker.openPositionsCount` |
| Banner | `AUTOMATED EXECUTION NOT IMPLEMENTED — PHASE 54` | Status |

No broker order endpoint was called to “test” a lock beyond the deliberate `EXECUTION_FORBIDDEN` path probe (returns 403 without mutation).

---

## 8. Automated Trading readiness matrix

Status legend: `VERIFIED` | `PARTIALLY_VERIFIED` | `NOT_IMPLEMENTED` | `BLOCKED` | `UNVERIFIED`

| # | Capability | Status | Evidence | Missing / root cause | Next action | DEMO blocker | LIVE blocker |
|---|------------|--------|----------|----------------------|-------------|--------------|--------------|
| 1 | Live market data | VERIFIED | FC Offers LIVE; verify/subscribe path; Phase 56.4.1–5 | Ops disconnect soak incomplete | Optional ops soak | N | N (≠ trading) |
| 2 | Quote freshness & recovery | VERIFIED | Freshness gates; stale→`STALE_INTERRUPTED`; controlled stale + resume | — | Preserve thresholds | N | N |
| 3 | Instrument & contract metadata | PARTIALLY_VERIFIED | XAU DEMO CondDist/qty attested | Non-XAU; LIVE metadata | Expand only with evidence | Y if non-XAU | Y |
| 4 | Scenario analysis | VERIFIED | Analysis/decision engines; not executable | Confidence not calibrated | Keep analysis≠orders | N | N |
| 5 | Draft create/persist | VERIFIED | Validate/persist; Phase 56.4.2+ | — | — | N | N |
| 6 | Final risk validation | VERIFIED (sim) | Allocation/3R/margin gates | Broker risk engine not verified | Keep fail-closed | N sim / Y broker | Y |
| 7 | Simulated entry & monitoring | VERIFIED | Open/monitor APIs + prod | — | — | N | N |
| 8 | Simulated automatic SL | VERIFIED | Unit matrix + **prod controlled inject** BUY/SELL | Natural-market SL soak still optional | Optional natural soak | N | N |
| 9 | Simulated automatic TP | VERIFIED | Prod TP exits Phase 56.4.5 | — | — | N | N |
| 10 | Exit audit & P/L accounting | VERIFIED (sim) | Audit-before-upsert; R + quote id; monetary P/L null without pip meta | Broker ClosedTrades RO incomplete | Keep UNKNOWN when meta missing | N sim / Y broker | Y |
| 11 | Duplicate protection / idempotency | PARTIALLY_VERIFIED | Sim duplicate open/close/inject | No broker client-order-id | Required before broker exec | N sim / Y broker | Y |
| 12 | Broker order submission | NOT_IMPLEMENTED / BLOCKED | No FC submit adapter; `EXECUTION_FORBIDDEN` | Entire execution stack | Separate owner phase | **Y** | **Y** |
| 13 | Broker modify/cancel | NOT_IMPLEMENTED | RO `listOrders` only | Mutation adapter | Separate phase | **Y** | **Y** |
| 14 | Broker position closing | NOT_IMPLEMENTED | RO `listTrades` only | Close adapter | Separate phase | **Y** | **Y** |
| 15 | Broker fill/reconcile | PARTIALLY_VERIFIED (RO) | Exposure RO empty/auth | Full fill lifecycle | Before DEMO exec | **Y** | **Y** |
| 16 | Broker-side protective SL/TP | NOT_IMPLEMENTED | Sim SL/TP only | Attached SLTP path | Before DEMO exec | **Y** | **Y** |
| 17 | Account-mode / trading permission | PARTIALLY_VERIFIED | DEMO env match; no canTrade probe | Explicit trading-permission attestation | Before LIVE | Soft Y | **Y** |
| 18 | Emergency stop | VERIFIED (entry lock) | Lock ON blocks entries | Does not flatten broker risk | Flatten kill-switch if broker risk exists | N today | Y if open risk |
| 19 | Restart recovery | PARTIALLY_VERIFIED | Persistence designed; controlled tests | **Production restart NOT_VERIFIED** | Authorized restart test | Soft | **Y** ops |
| 20 | Alerts / logs / ops monitoring | PARTIALLY_VERIFIED | Audit events + diagnostics | No pager/webhook plane | Before LIVE ops | Soft | Soft Y |
| 21 | Admin authorization | VERIFIED | `requireForexAdmin`; unauth 403 | — | — | N | N |
| 22 | E2E DEMO acceptance | PARTIALLY_VERIFIED | DEMO **simulation** E2E closed | DEMO **broker** E2E absent | Owner DEMO exec phase | **Y** broker | — |
| 23 | E2E LIVE readiness | BLOCKED | Policy + no exec path + LIVE unauthorized | Full lifecycle + owner LIVE review | Do not enable | — | **Y** |

---

## 9. Go / No-Go decisions

### Simulation readiness — **GO** (known blockers)

Can reliably create, monitor, close (manual + automatic TP + **controlled automatic SL**), audit, and persist simulated positions on DEMO-connected LIVE quotes for XAU.

**Remaining soft blockers:** production process-restart recovery `NOT_VERIFIED`; multi-hour soak not required this phase; natural-market automatic SL (without inject) still optional; XAU-only metadata scope.

### DEMO broker-execution readiness — **NO-GO**

Hard blockers: rows **12–16** (no submit/modify/cancel/close/protective-order/fill lifecycle), `EXECUTION_FORBIDDEN`, FC `trading: DISABLED`, `placesOrders=false`, `acceptsForExecution=false`, Master OFF, Emergency lock ON. Requires a **separate owner-approved** execution implementation phase — not this phase.

### LIVE broker-execution readiness — **NO-GO / BLOCKED**

All DEMO-exec blockers **plus** LIVE unauthorized by policy, LIVE metadata/ops unverified for execution, row **23**. Simulation success is **not** LIVE readiness.

---

## 10. Root causes of hard blockers (broker)

1. **Deliberate absence** of ForexConnect mutation APIs in the application (RO listOrders/listTrades only).  
2. **Hard API gate** `EXECUTION_FORBIDDEN` on order-like paths.  
3. **Type/runtime invariants** force `placesOrders=false` / `acceptsForExecution=false`.  
4. **Policy locks** Master OFF + Emergency Entry Lock ON + auto entry/re-entry DISABLED.  
5. **No** broker-side SL/TP attach, fill reconciliation, or client-order idempotency stack.

These are correct safety posture for this phase — not defects to “fix” by enabling trading.

---

## 11. Tests and checks not performed

- Heavy local build / local server / local browser (by design).  
- Production process restart / induced disconnect.  
- Multi-hour continuous soak.  
- Natural-market (non-inject) automatic SL wait.  
- Any broker submit / amend / cancel / close.  
- Master ON or Emergency lock OFF.  
- Automatic re-entry.  
- LIVE environment trading attempts.

---

## 12. Recommended next phase

**Phase 56.4.7 (proposed) — Simulation ops certification only** (still no broker execution): authorized production restart recovery for sim lifecycle + subscription restore; optional multi-hour soak; document natural SL if observed.

**Broker DEMO execution** remains a **separate, explicitly owner-authorized** phase after implementation of mutation adapters, protective orders, reconciliation, and idempotency — and must not start from this audit alone.

---

## 13. STOP

Phase 56.4.6 complete. Safety locks retained. No broker-execution phase started.
