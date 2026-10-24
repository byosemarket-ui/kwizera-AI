# Phase 58.2 — Automated Trading Full Integration and DEMO Certification

**Date:** 2026-10-23  
**Module:** `/forex/automated-trading`  
**Broker:** FXCM ForexConnect  
**Verdict:** `PASS_WITH_KNOWN_BLOCKERS`

---

## 1. Executive summary

Phase 58.2 repairs the root cause that blocked `requireProtective=true` in Phase 58.1 and completes the DEMO-gated execution path for attached Stop Loss / Take Profit using documented ForexConnect APIs (`RATE_STOP` / `RATE_LIMIT` on open; post-fill `STOP` / `LIMIT` + `TRADE_ID`; broker trade-row reconciliation).

Local focused tests: **18 passed**.

Actual DEMO open → protect → close lifecycle against FXCM: **NOT_VERIFIED**. Production remains on Phase 58.1 documentation SHA; sidecar mutation remains disabled; production restart/deploy was **not** authorized; no DEMO order was submitted.

Global safety unchanged: `placesOrders=false`, `acceptsForExecution=false`, Master Trading OFF, Emergency Entry Lock ON, LIVE credentials unconfigured, `trading=DISABLED` on the live ForexConnect session.

---

## 2. Initial baseline and deployed revision

| Item | Value |
|------|-------|
| Local HEAD at audit start | `203599c1` (Phase 58.1 docs) |
| Phase 58.1 feature SHA | `2df432d3` |
| Phase 58.0 baseline | `6cdb2009` / docs `3e236514` |
| Deployed production SHA (verified) | `203599c194f258681c70764b045d6de62de3e007` (`203599c1`) |
| Deployed == local HEAD (pre-58.2 edits) | Yes at audit; **Phase 58.2 code not deployed** |
| Working tree | Unrelated AI/video edits preserved; Phase 58.2 files modified/added |
| FC session (online RO) | `CONNECTED`, environment `demo`, `trading=DISABLED` |
| Sidecar Python / SDK (runtime probe) | Python 3.7.17 · forexconnect 1.6.43 requested/import OK |

---

## 3. Root causes discovered

1. **Protective attach unimplemented** — Orchestrator hard-failed `requireProtective` with `PROTECTION_REQUIRED_BUT_UNVERIFIED` even though FXCM docs support `RATE_STOP`/`RATE_LIMIT` on opening orders and post-fill `STOP`/`LIMIT` + `TRADE_ID`.
2. **Open path had no protective parameters** — `open_true_market` only sent `TRUE_MARKET_OPEN` without stop/limit fields.
3. **No post-fill attach / reconcile helpers** — Could not confirm broker-side protection from trade `stop`/`limit` or Orders table.
4. **Unprotected-fill fail-safe missing on DEMO path** — No authorized close-after-protection-failure procedure for the grant-scoped DEMO lifecycle.
5. **Deployed runtime still Phase 58.1** — New code cannot reach the broker until deploy + sidecar restart + mutation flag + grant.
6. **Mutation still default-off** — Correct safety posture; blocks actual certification until owner enables it intentionally.

---

## 4. Meaningful code defects corrected

| Defect | Fix |
|--------|-----|
| `requireProtective` hard-refuse | Orchestrator now requires absolute `stopLoss`/`takeProfit`, validates optional `entryHint` geometry, submits protective rates, reconciles broker state |
| No attached SL/TP on open | `mutation_demo.open_true_market` accepts `rate_stop`/`rate_limit` → `RATE_STOP`/`RATE_LIMIT` |
| No post-fill attach | New `attach_protective_orders` using `Orders.STOP` / `Orders.LIMIT` + `TRADE_ID` |
| No protection reconcile | New `reconcile_trade_protection` reading trade stop/limit + matching orders |
| Missing sidecar routes | `/demo-mutation/attach-protective`, `/demo-mutation/reconcile-protection`; open-market accepts rates |
| Node bridge incomplete | `demoMutationAttachProtective`, `demoMutationReconcileProtection`; open forwards rates |
| Unprotected fill after DEMO fill | If `requireProtective` and broker protection not confirmed, close exact trade (`closeIfUnprotected` default true) |
| UI still labeled 58.1 | DEMO readiness panel updated to Phase 58.2 + protective surface line |

**Preserved (intentionally not bypassed):**

- `DisabledBrokerMutationAdapter` / `EXECUTION_FORBIDDEN` for ordinary AT
- Global `placesOrders=false` coercion
- LIVE mutation forbidden at sidecar gate
- Default-off `KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION`

---

## 5. Files changed and architectural integration

**Sidecar**

- `services/forexconnect-sidecar/mutation_demo.py`
- `services/forexconnect-sidecar/server.py`

**Node execution path**

- `ai/forex-ai/automated-trading/demo-execution/types.ts`
- `ai/forex-ai/automated-trading/demo-execution/grant-store.ts`
- `ai/forex-ai/automated-trading/demo-execution/forexconnect-mutation-adapter.ts`
- `ai/forex-ai/automated-trading/demo-execution/orchestrator.ts`
- `ai/market-data/forexconnect/client.ts`
- `dev/server/forex-automated-trading-api.ts`

**UI**

- `desktop/forex/ForexAutomatedTradingPage.tsx`

**Tests**

- `tests/unit/ai/forex-ai/phase58-2-demo-protection-and-lifecycle.test.ts` (new)
- `tests/unit/ai/forex-ai/phase58-1-demo-execution-engine.test.ts` (updated assertion)

**Contract (unchanged shape):**

`Approved DEMO grant → readiness → orchestrator → ForexConnect DEMO adapter → sidecar (secret + DEMO env) → create_order_request/send_request → broker response → record/reconcile → UI`

Ordinary strategy worker still cannot place orders.

---

## 6. ForexConnect capabilities verified

| Capability | Evidence basis | Status |
|------------|----------------|--------|
| `create_order_request` / `send_request` | Phase 58.1 + docs; capability probe fields | Documented / prior RO |
| `TRUE_MARKET_OPEN` / `TRUE_MARKET_CLOSE` | Gehtsoft samples; existing helpers | Documented |
| `RATE_STOP` / `RATE_LIMIT` on open | FXCM TradingCommandsCreateOrder_A | Documented; implemented locally |
| Post-fill `STOP` / `LIMIT` + `TRADE_ID` | FXCM order-parameter docs / trade row `stop`/`limit` | Documented; implemented locally |
| Trade protection readback | Trade table `stop`/`limit`; Orders by `trade_id` | Implemented locally |
| LIVE mutation reject | `gate_demo_mutation` | Code + prior tests |
| Installed SDK on VPS | runtime probe: forexconnect 1.6.43, Python 3.7.17 | Online RO |
| Actual broker attach/fill confirmation | Requires mutation | **NOT_VERIFIED** |

---

## 7. API and sidecar integration results

| Layer | Result |
|-------|--------|
| Sidecar routes (code) | open-market (+rates), close-trade, attach-protective, reconcile-protection, sdk-capabilities |
| Node bridge | Forwards rates + new routes |
| AT API `demo-lifecycle/*` | Accepts `stopLoss`/`takeProfit`/`entryHint`/`closeIfUnprotected`; still `placesOrders: false` |
| Deployed API | Still Phase 58.1 revision — new fields/routes **not live** until deploy |
| Admin-gated readiness online | HTTP 403 without admin token (expected) |

---

## 8. DEMO authorization and LIVE separation

- Grants remain time-bounded, revocable, `environment: "DEMO"` only (purpose `PHASE_58_2_DEMO_LIFECYCLE`).
- Sidecar rejects non-demo / live session environments and invalid secrets.
- LIVE profile online: `usernameConfigured=false`, `passwordConfigured=false`.
- No LIVE credentials used. No LIVE order submitted.
- Ordinary AT mutation adapter remains disabled.

---

## 9. Risk-management behavior

- DEMO path continues to use grant `maxLots` + instrument allowlist (minimum lots for certification).
- Adapter does not invent sizes; lots come from authorized request after grant check.
- Geometry validation via existing `evaluateProtectiveGeometry` when `entryHint` provided.
- Global Master Trading / placesOrders / automatic entry remain OFF — DEMO lifecycle is isolated.

---

## 10. Stop Loss / Take Profit results

| Step | Result |
|------|--------|
| Root-cause identification | Hard-refuse replaced with documented attach path |
| Attached open (`RATE_STOP`/`RATE_LIMIT`) | Implemented in sidecar |
| Post-fill STOP/LIMIT | Implemented |
| Broker reconcile | Implemented (`brokerProtected` requires both stop and limit) |
| Fail-safe close if unprotected | Implemented for grant-scoped DEMO (`closeIfUnprotected`) |
| Actual broker confirmation | **NOT_VERIFIED** (mutation off / not deployed) |

---

## 11–14. Order / fill / close evidence

| Question | Answer |
|----------|--------|
| Did a real DEMO order reach FXCM? | **No** (not attempted — blocked by deploy + mutation gates) |
| Did FXCM acknowledge it? | N/A |
| Was it filled? | N/A |
| Real broker trade/position ID? | N/A |
| Required protection confirmed? | **Not against broker** (code path ready locally) |
| Close request reach broker? | N/A |
| Broker confirm closure? | N/A |
| Final broker state closed? | N/A |
| Internal reconcile with broker? | N/A |

---

## 15. Local lightweight test results

```text
Command: .\node_modules\.bin\vitest.cmd run
  tests/unit/ai/forex-ai/phase58-2-demo-protection-and-lifecycle.test.ts
  tests/unit/ai/forex-ai/phase58-1-demo-execution-engine.test.ts
  --pool=forks --maxWorkers=1 --reporter=verbose
Exit: 0
Result: 2 files, 18 tests passed
Environment: local Windows
Revision: working tree (uncommitted Phase 58.2 changes)
Type: unit / static wiring / orchestrator validation (no broker mutation)
```

Python AST parse on local Windows: interpreter not available (`python`/`py` missing) — Python syntax verified by review; sidecar runtime remains on VPS Python 3.7.17.

---

## 16. Online read-only test results

| Test | Result | Evidence |
|------|--------|----------|
| Deployment API | `verifiedLive=true`, commit `203599c1` | HTTP 200 |
| FC status | CONNECTED, demo, trading DISABLED, sdkAvailable | HTTP 200 |
| Runtime probe | Python 3.7.17, forexconnect 1.6.43, import OK | Nested in FC status |
| LIVE credentials | Not configured | FC profiles |
| DEMO readiness (no admin token) | HTTP 403 | Expected |
| AT status (no admin token) | HTTP 403 | Expected |
| Public sdk-capabilities/trades/orders paths tried | 404 | Different route layout; RO via status OK |

No broker orders submitted during RO checks.

---

## 17. Mock / fault-injection results

| Case | Result |
|------|--------|
| `requireProtective` without SL/TP | `VALIDATION_FAILED` / `PROTECTION_LEVELS_REQUIRED` (unit) |
| Invalid BUY geometry with entryHint | `VALIDATION_FAILED` (unit) |
| Expired/revoked grant | Covered by Phase 58.1 grant tests (still passing) |
| LIVE mutation | Code gate retained; not online-mutated |

---

## 18. Actual DEMO broker test results

**Not run.** Preconditions unmet:

1. Phase 58.2 code not deployed / sidecar not restarted.
2. `KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION` remains disabled (online `trading=DISABLED`).
3. No owner-authorized time-bounded DEMO grant for mutation during this session.
4. Production restart/deploy not authorized by the owner for this phase.

---

## 19. UI and worker integration

- DEMO readiness panel updated to Phase 58.2 and shows protective surface status.
- Worker / Master Trading / placesOrders paths unchanged and remain disabled for ordinary execution.
- DEMO lifecycle remains a separate grant-scoped API surface.

---

## 20. Safety verification

| Control | Status |
|---------|--------|
| No LIVE order | Confirmed (none submitted) |
| LIVE mutation unauthorized | Code + LIVE profile empty online |
| Global `placesOrders` not enabled | Code coerce + tests |
| Global `acceptsForExecution` not enabled | Code / API flags |
| Master Trading OFF | Policy preserved in orchestrator status |
| Emergency Entry Lock ON | Policy preserved |
| Automatic entry/re-entry disabled | Policy preserved |
| Unrelated positions modified | None |
| Credentials exposed | No |
| Unrelated working-tree changes | Preserved (AI/video files untouched by this phase’s intent) |

---

## 21. Known blockers

1. **Deploy + sidecar restart not authorized** — production still `203599c1`.
2. **`KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION` off** — correct default; required for cert.
3. **Mutation secret must be configured on app + sidecar** without browser exposure.
4. **Owner DEMO grant** required immediately before any mutation.
5. **Broker-confirmed SL/TP** cannot be certified until (1)–(4) are satisfied with one controlled lifecycle.
6. Local Windows lacks Python for sidecar parse-check (non-blocking; VPS has 3.7.17).

---

## 22. Relevant commit SHAs

| SHA | Role |
|-----|------|
| `203599c1` | Current origin/main docs pointer; **deployed** |
| `2df432d3` | Phase 58.1 feature |
| *(pending)* | Phase 58.2 feature — **uncommitted** at report time |

---

## 23. Deployment status

- **Deployed revision:** `203599c1` (verified live).
- **Phase 58.2 code:** local working tree only.
- **Production restart/deploy:** **not performed** (authorization missing).
- **Sidecar mutation:** remains disabled online.

---

## 24. Exact next action needed from the owner

1. Review and approve commit of Phase 58.2 files only (exclude unrelated AI/video edits).
2. Explicitly authorize production deploy of that commit **and** ForexConnect sidecar restart.
3. On VPS only: set `KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1` and shared `KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET` for app + sidecar (not in browser).
4. Create a short-TTL DEMO grant (`maxLots=1`, allowlisted instrument).
5. Authorize **one** controlled DEMO lifecycle: open with `requireProtective=true` + absolute SL/TP → reconcile protection → close exact `tradeId` → revoke grant → disable mutation flag.
6. Confirm no LIVE credentials are present before mutation.

Until those steps complete, treat actual broker certification as **NOT_VERIFIED**.

---

## Explicit certification answers

| Question | Answer |
|----------|--------|
| Real DEMO order reach FXCM? | **No** |
| FXCM acknowledge? | N/A |
| Filled? | N/A |
| Broker trade/position ID? | N/A |
| Required protection confirmed? | Code ready; **broker NOT_VERIFIED** |
| Close reached broker? | N/A |
| Broker confirmed close? | N/A |
| Final broker position closed? | N/A |
| Internal state reconciled? | N/A |
| Tests skipped/blocked? | Actual broker mutation **blocked** pending deploy/auth; admin RO endpoints 403 without token |
| Production restart skipped for missing auth? | **Yes** |

---

## Final stop

Phase 58.2 **stops here**.

- LIVE remains locked.  
- Master Trading remains OFF.  
- Emergency Entry Lock remains ON per policy.  
- Automatic entry/re-entry remains disabled.  
- No LIVE order was submitted.  
- Remaining blocker: owner-authorized deploy + DEMO mutation enablement + one controlled lifecycle.

**Verdict: `PASS_WITH_KNOWN_BLOCKERS`** — integration and SL/TP root-cause repair completed and locally tested; actual DEMO open/protect/close certification remains blocked pending owner authorization.
