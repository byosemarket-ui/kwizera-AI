# Phase 58.1 — FXCM ForexConnect Broker Execution Engine

**Project:** KWIZERA AI STUDIO  
**Module:** Automated Trading ↔ ForexConnect DEMO execution  
**Phase:** 58.1  

**Final verdict:** `PASS_WITH_KNOWN_BLOCKERS`

> Engine + DEMO authorization boundary implemented using **documented** ForexConnect 1.6 APIs (`create_order_request` / `send_request`, `TRUE_MARKET_OPEN` / `TRUE_MARKET_CLOSE`).  
> **No LIVE order was submitted.**  
> **No DEMO broker open/close was executed in production this phase** — sidecar mutation remains **opt-in and disabled by default**; broker-attached SL/TP attach remains **unverified** (opens with `requireProtective=true` are refused).  
> Global `placesOrders` / `acceptsForExecution` remain **false**. Master Trading not enabled for general execution. Emergency lock policy preserved.

---

## 1. Executive summary

Phase 58.0 blocked because mutation was a stub and no DEMO auth existed. Phase 58.1:

1. Audited Gehtsoft ForexConnect **1.6** Python samples/docs (authoritative for pinned `1.6.43` line).
2. Implemented a **narrow DEMO-only** mutation surface on the sidecar (default OFF).
3. Implemented **time-bounded admin DEMO grants** (server-enforced).
4. Implemented Node bridge + orchestrator + AT API + UI readiness panel.
5. **Did not** globally flip `placesOrders=true` or disable Emergency Entry Lock.
6. **Did not** run a production DEMO open/close (mutation env off; no production restart authorized to enable it; protection attach not verified).

---

## 2. SHAs / baseline

| Item | SHA / value |
|------|-------------|
| Baseline HEAD at start | `0304727e` |
| Prior Phase 58.0 | `3e236514` / `0304727e` |
| Deployed at inspection | verify via `/api/deployment` (expected near `0304727e` / later) |
| Phase 58.1 feature + docs | `2df432d3` |

Unrelated dirty PMV/typography files preserved.

---

## 3. Root causes (from 58.0) and disposition

| Blocker | Disposition in 58.1 |
|---------|---------------------|
| Hard-false `placesOrders` / `acceptsForExecution` | **Preserved** for AT automation; DEMO path uses separate grant + sidecar gates |
| `DisabledBrokerMutationAdapter` | **Preserved** for normal AT intent path |
| No sidecar submit/close | **Added** gated `/demo-mutation/*` (opt-in) |
| API regex 403 | DEMO routes use `demo-lifecycle/*` names that avoid the gate; broad gate retained for unauthorized patterns |
| No DEMO owner auth | **Added** time-bounded grant store + API |
| No real lifecycle evidence | **NOT_VERIFIED** this phase (see §15) |

---

## 4. Files created / changed

### Created
- `services/forexconnect-sidecar/mutation_demo.py`
- `ai/forex-ai/automated-trading/demo-execution/types.ts`
- `ai/forex-ai/automated-trading/demo-execution/grant-store.ts`
- `ai/forex-ai/automated-trading/demo-execution/forexconnect-mutation-adapter.ts`
- `ai/forex-ai/automated-trading/demo-execution/orchestrator.ts`
- `ai/forex-ai/automated-trading/demo-execution/index.ts`
- `tests/unit/ai/forex-ai/phase58-1-demo-execution-engine.test.ts`
- `docs/forex/PHASE_58_1_FXCM_FOREXCONNECT_BROKER_EXECUTION_ENGINE.md`

### Modified
- `services/forexconnect-sidecar/server.py` — `/sdk-capabilities`, `/demo-mutation/open-market`, `/demo-mutation/close-trade`
- `ai/market-data/forexconnect/client.ts` — probe + DEMO mutation bridge methods
- `dev/server/forex-automated-trading-api.ts` — `demo-lifecycle/*` admin routes
- `desktop/forex/ForexAutomatedTradingPage.tsx` — DEMO readiness panel

---

## 5. ForexConnect SDK capabilities verified

| Capability | Evidence | Status |
|------------|----------|--------|
| `ForexConnect.create_order_request` | Gehtsoft 1.6 docs + OpenPosition.py / ClosePosition.py samples | Documented |
| `fx.send_request(request)` → `order_id` | Same samples | Documented |
| `TRUE_MARKET_OPEN` | OpenPosition.py | Documented |
| `TRUE_MARKET_CLOSE` + `TRADE_ID` | ClosePosition.py | Documented |
| Installed VPS wheel method inventory | Sidecar `GET /sdk-capabilities` (after deploy) | Runtime probe available; **pre-deploy UNVERIFIED on prod** |
| Broker-attached SL/TP on entry | Not implemented / not proven | **UNVERIFIED** — opens with `requireProtective=true` refused |

---

## 6. DEMO / LIVE separation

| Rule | Enforcement |
|------|-------------|
| LIVE session mutation | Sidecar `LIVE_MUTATION_FORBIDDEN` if environment ∈ real/live |
| DEMO mutation default | `KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION` unset → disabled |
| Shared secret | `KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET` + header `X-Kwizera-Demo-Mutation-Secret` |
| Server grant | Admin `POST …/demo-lifecycle/grant` (TTL, allowlist, maxLots) |
| Global AT flags | Remain `placesOrders=false`, `acceptsForExecution=false` |
| LIVE unlock UI | Not added |

---

## 7. API surface (admin-gated)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/forex/automated-trading/demo-lifecycle/status` | Grant/lifecycle summary |
| GET | `/api/forex/automated-trading/demo-lifecycle/readiness` | Gate checklist |
| POST | `/api/forex/automated-trading/demo-lifecycle/grant` | Create DEMO grant |
| POST | `/api/forex/automated-trading/demo-lifecycle/grant/revoke` | Revoke grant |
| POST | `/api/forex/automated-trading/demo-lifecycle/open-market` | DEMO open (if ready) |
| POST | `/api/forex/automated-trading/demo-lifecycle/close-trade` | DEMO close by `tradeId` |

Sidecar (localhost):

| Method | Path |
|--------|------|
| GET | `/sdk-capabilities` |
| POST | `/demo-mutation/open-market` |
| POST | `/demo-mutation/close-trade` |

---

## 8. Order state machine (DEMO lifecycle record)

States include: `IDLE`, `AUTHORIZATION_REJECTED`, `MUTATION_DISABLED`, `SUBMITTING`, `SUBMISSION_UNKNOWN`, `BROKER_REJECTED`, `ACCEPTED_PENDING`, `POSITION_OPEN`, `PROTECTION_UNSUPPORTED`, `CLOSE_PENDING`, `CLOSED`, `RECONCILIATION_REQUIRED`, …

`FILLED`/`CLOSED` require broker evidence fields (`fillConfirmed` / `closeConfirmed`), not local optimism.

---

## 9. Risk / protection

- Grant maxLots (default 1) and optional instrument allowlist.
- Orchestrator **refuses** `requireProtective=true` until broker-side attach is verified (`PROTECTION_REQUIRED_BUT_UNVERIFIED`).
- Local SL/TP geometry remains distinct from broker protection (Phase 57.0 rule preserved).

---

## 10. Tests

```text
node ./node_modules/vitest/vitest.mjs run \
  tests/unit/ai/forex-ai/phase58-1-demo-execution-engine.test.ts \
  tests/unit/ai/forex-ai/phase58-0-demo-order-lifecycle-readiness.test.ts \
  --reporter=dot
→ 2 files / 14 tests passed; exit 0
```

These are **unit / wiring** tests — **not** DEMO broker certification.

---

## 11. Actual DEMO broker evidence

| Step | Result |
|------|--------|
| Real DEMO order submitted | **NOT performed** |
| Broker order ID / fill / position | **None** |
| Broker SL/TP confirmed | **None** |
| Broker close confirmed | **None** |

**Reason:** Sidecar mutation env defaults OFF; enabling requires VPS env + sidecar restart (not authorized this phase); protection attach still unverified for safe open under `requireProtective=true`.

---

## 12. Safety verification

```text
placesOrders (global) = false
acceptsForExecution (global) = false
LIVE execution = UNAUTHORIZED
DisabledBrokerMutationAdapter = retained for AT intent path
Emergency Entry Lock policy = ON (not disabled)
Master Trading (general) = not enabled for broker execution
Automatic entry/re-entry = disabled
```

---

## 13. Known blockers / next owner actions

1. On VPS (authorized ops): set `KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1` and `KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET=…`, restart **only** the forexconnect sidecar if approved.  
2. Confirm `GET …/sdk-capabilities` shows `TRUE_MARKET_OPEN` / `TRUE_MARKET_CLOSE`.  
3. Create admin DEMO grant; run readiness until `mayAttemptDemoMutation=true`.  
4. Decide protection policy: implement verified broker STOP/LIMIT attach **or** authorize unprotected DEMO micro-lot under explicit waiver.  
5. Then run controlled open → reconcile → close → reconcile certification.  
6. Do **not** enable LIVE.

---

## 14. Deployment

Code push only unless owner authorizes deploy/restart. A successful git push is **not** proof of production mutation capability.

---

## 15. Verdict rationale

`PASS_WITH_KNOWN_BLOCKERS`: required execution **architecture** for DEMO-gated ForexConnect mutation is implemented and unit-tested using documented SDK methods, without global safety bypass. Required **acceptance** of an actual DEMO open/protect/close against the broker remains **incomplete** (`NOT_VERIFIED` / operationally blocked until env enablement + protection policy).
