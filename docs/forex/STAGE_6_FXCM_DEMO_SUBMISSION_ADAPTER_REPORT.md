# Stage 6 — FXCM DEMO-Only Order Submission Adapter

**Status:** Implemented (non-submitting / dry-run only)  
**Module:** `ai/forex-ai/automated-trading/demo-submission-adapter/`  
**Stage id:** `STAGE_6_FXCM_DEMO_SUBMISSION_ADAPTER`  
**Schema:** `at-fxcm-demo-adapter-v1`

---

## 1. Architecture audit

| Component | Location | Stage 6 use |
|-----------|----------|-------------|
| ForexConnect sidecar mutation | `services/forexconnect-sidecar/mutation_demo.py` | **Reference only** — TRUE_MARKET_OPEN + RATE_STOP/RATE_LIMIT via `create_order_request` / `send_request` |
| Node mutation adapter | `demo-execution/forexconnect-mutation-adapter.ts` | **Not called** by Stage 6 dry-run |
| DEMO lifecycle (grant-scoped) | `demo-execution/orchestrator.ts` + `/demo-lifecycle/*` | Separate path; Stage 6 does not reuse open-market |
| Broker execution foundation | `broker-execution/` | Reuse Execution Master OFF / authorization blockers concept |
| Stage 5 proposals | `order-proposal/` + `per-order-risk/` | Canonical input |
| Stage 1 precheck | `broker-execution/precheck.ts` | Final precheck remains separate; dry-run records requirement |
| Path gate | `forex-automated-trading-api.ts` `/order\|submit\|execute/` | Stage 6 routes under `/demo-adapter/*` |

**Verdict:** Existing DEMO mutation is grant + env-secret gated and must not be treated as Stage 5 proposal submission. Stage 6 adds a dedicated proposal-bound adapter boundary that stays DISABLED.

---

## 2. Modules created

- `demo-submission-adapter/types.ts`
- `demo-submission-adapter/mutation-port.ts` (Noop / AssertNeverCalled)
- `demo-submission-adapter/demo-environment.ts`
- `demo-submission-adapter/fxcm-payload.ts`
- `demo-submission-adapter/proposal-integrity.ts`
- `demo-submission-adapter/authorization.ts`
- `demo-submission-adapter/acknowledgement.ts`
- `demo-submission-adapter/store.ts`
- `demo-submission-adapter/dry-run.ts`
- `demo-submission-adapter/index.ts`
- Admin panel + tests + this report

---

## 3. Safety

`placesOrders=false`, `acceptsForExecution=false`, `mutatesBroker=false`, `executionAuthorized=false`, `submissionMode=DISABLED`, `brokerSubmissionImplemented=false`, `mutationInvoked=false`.  
Mutation port is never invoked on dry-run.

---

## 4. API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/forex/automated-trading/demo-adapter/status` | Adapter readiness |
| GET | `/api/forex/automated-trading/demo-adapter/history` | Attempt history |
| POST | `/api/forex/automated-trading/demo-adapter/dry-run` | Non-submitting payload construction |

---

## 5. FXCM payload

Verified against `mutation_demo.py`:

- `order_type = TRUE_MARKET_OPEN`
- `ACCOUNT_ID`, `BUY_SELL`, `AMOUNT` (= round(baseUnitSize × lots)), `SYMBOL`
- Optional attached `RATE_STOP` / `RATE_LIMIT`
- OM default TIF documented as IOC; GTD fail-closed until modelled
- Planned entry ≠ fill price (market order)

---

## 6. Remaining limitations

No live DEMO submission; no LIVE path; attached protection assumed only when both SL and TP present on constructed payload; post-fill attach path documented in sidecar but not exercised; reconciliation for unknown broker results designed but not live-submitted.

Await owner authorization before any actual DEMO submission (Stage 7+).
