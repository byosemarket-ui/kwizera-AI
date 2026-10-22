# Phase 56.4.1 — Live-Quote Simulation Acceptance & Readiness Verification

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading (simulation / verification only)  
**Phase:** 56.4.1  
**This phase does not authorize broker order submission, DEMO execution, or LIVE trading.**

---

## 1. Baseline (verified before edit)

| Item | Observed |
|------|----------|
| Local HEAD (start) | `97e2663c` (Phase 56.4.0 docs) |
| Production `/api/deployment` | `97e2663c…`, `verifiedLive=true`, `result=success` |
| Dirty unrelated files | PMV / typography / video — **preserved, not staged** |
| Stream (start) | `AUTHENTICATED_IDLE`, `subscriptionCount=0`, `lifecycle.intendedCount=0` |
| FC | `CONNECTED`, `trading=DISABLED`, `environment=demo` |
| AT `/api/forex/automated-trading/status` without Admin header | **403** `ADMIN_FORBIDDEN` |

Historical Phase 56.4.0 claims treated as leads; baseline above re-verified.

---

## 2. Root cause of zero-subscription / AUTHENTICATED_IDLE

**Proven:**

1. Durable intended-subscriptions store hydrated **0** entries (`lastHydrateLoaded=0`, `intendedCount=0`).
2. No active client had called subscribe after idle/process quiet period → Offers listener inactive → `AUTHENTICATED_IDLE`.
3. **Defect (narrow fix shipped):** `POST /api/forex/providers/forexconnect/subscribe` previously called **bridge-only** `subscribeQuotes`, which produced LIVE quotes but left `lifecycle.intendedCount=0` (not durable for restore). Charts/AT verify use `live-service.ensure`, which registers intended.

**Fix (56.4.1):** Subscribe/unsubscribe HTTP handlers now route through `getForexConnectLiveCandleService().ensure` / `.unsubscribe` so intended is durable. LIVE still requires genuine Offers Bid/Ask price changes.

---

## 3. Quote subscription and freshness evidence (production)

| Step | Result |
|------|--------|
| `POST …/subscribe` `{symbol:"XAU/USD"}` | `ok=true` |
| Stream after poll | `streamState=LIVE`, `subscriptionCount=1`, `lastQuoteAgeMs≈206` then `≈98` |
| Quotes RO | XAU/USD `bid`/`ask` present and updating (e.g. 4072.5 / 4072.8 → later 4072.92 / 4073.22) |
| `GET …/candles?mode=live` | Registers intended; `intendedCount=1` for `XAU/USD` `1m` |
| XAU metadata RO | `baseUnitSize=1`, `minQuantity=1`, `contractMultiplier=1`, `pointSize=0.01`, `pipCost=0.01`, `condDistStop=0`, `condDistUnit=pips`, `condDistMethod=get_cond_dist_stop_for_trade` |

---

## 4. Per-gate acceptance matrix

| # | Gate | Result | Evidence |
|---|------|--------|----------|
| 1 | Instrument identity / allowlist XAU | **PASS** | Instruments RO + AT UI instrument XAU/USD |
| 2 | Active subscription + genuine bid/ask event | **PASS** | LIVE stream + quotes RO after subscribe |
| 3 | Quote freshness / timestamps | **PASS** (feed) / **PARTIAL** (AT snapshot age) | Feed `lastQuoteAgeMs` low; AT verification can age to `QUOTE_AGE_EXCEEDED` between Verify and draft |
| 4 | Quantity min/step/contract/units | **PASS** | Attested TradingSettings/Offers fields (56.4.0 + RO re-check) |
| 5 | CondDist method / unit / min-stop | **PASS** | CondDist=0 pips via documented method → no positive minimum |
| 6 | FX conversion | **PASS** (USD identity) | DEMO account currency USD on UI; non-USD path fail-closed (56.4.0) |
| 7 | Account equity / currency | **PASS** | AT UI: verified yes, account `***9634`, DEMO |
| 8 | Strategy allocation % / remaining budget | **PASS** (policy) / exercised | UI 1–100%; $100 vs 1% budget correctly rejected |
| 9 | Per-order allocation | **PASS** (input accepted) | Order Allocation USD=100 entered |
| 10 | Margin / free margin | **PASS** (account metadata) | Account metadata PASS on Verify |
| 11 | Entry/SL/TP geometry | **FAIL** (this run) | Draft rejected: SL/TP required when levels not derived under stale quote |
| 12 | 3R TP policy | **UNVERIFIED** this run | Not reached with VALIDATION_PASSED |
| 13 | Est. SL loss ≤ 25% of order allocation | **UNVERIFIED** this run | Not reached with sized quantity |
| 14 | Exposure authoritative | **UNVERIFIED** via public API | Admin-gated RO tables; UI did not surface contradiction |
| 15 | Draft validate / persist / reload | **FAIL** (honest) | Audit: `simulation_draft_validated · DEMO · REJECTED_LOCAL` (not invented PASS) |

---

## 5. Scenario 1 step-by-step

| Step | Result |
|------|--------|
| Instrument selection (XAU/USD) | **PASS** (AT DEMO instrument) |
| Fresh live quote (provider) | **PASS** after authorized subscribe |
| Validated instrument metadata | **PASS** |
| Market/plan input | **PASS** (analysis present; confidence NOT CALIBRATED) |
| Entry / required SL / TP @ 3R | **FAIL** — draft could not derive levels while quote snapshot aged |
| Verified quantity sizing | **FAIL** — blocked by upstream quote/geometry |
| Allocation / remaining budget | **PASS** (fail-closed): `$100` rejected when exceeding 1% strategy budget |
| Margin / SL-loss / exposure | Not fully exercised under VALIDATION_PASSED |
| Draft validation | **REJECTED_LOCAL** (fail-closed) |
| Persistence / reload | Audit persisted rejection; **no** VALIDATION_PASSED draft to reload |

**Scenario 1 overall: not PASS.** Live-quote prerequisite closed; full VALIDATION_PASSED under sustained fresh AT verification snapshot was **not** demonstrated this session.

---

## 6. UI / responsive verification

| Surface | Result |
|---------|--------|
| `/forex/automated-trading` | Banner PHASE 54; Master OFF; Emergency ON; `placesOrders=false`; `acceptsForExecution=false`; Market data PASS after Verify under LIVE; draft fail-closed |
| Admin token field | Present; fetch without header still 403 — UI “Authorized (session)” reflects session UX, not tokenless public API |
| `/forex/ai-analysis`, `/forex/charts` | Not fully re-walked this session after AT focus |
| Responsive 390 / 768 / 1024 / 1440 | **PARTIAL** — Emulation set to 390 once; no dedicated responsive lab facility. Layout remained usable on AT page; full matrix not claimed |

---

## 7. Safety invariants

| Invariant | Evidence |
|-----------|----------|
| `masterTradingEnabled=false` / Master OFF | AT UI checkbox **Master enable OFF** (readonly) |
| `emergencyEntryLock=true` | AT UI **Emergency entry lock ON** (checked, readonly) |
| `placesOrders=false` | UI + lifecycle + API literals |
| `acceptsForExecution=false` | UI simulation draft strip |
| `EXECUTION_FORBIDDEN` | AT API order-path gate unchanged |
| ForexConnect `trading=DISABLED` | Status RO |
| LIVE trading unauthorized | DEMO selected; LIVE switch not activated for execution |
| Allowlist XAU-only | Unchanged |
| Public AT status without Admin | **403** — token required for machine clients |

---

## 8. Tests

| Suite | Result |
|-------|--------|
| `phase56-4-1-live-quote-simulation-acceptance.test.ts` (9) | **PASS** |
| `phase56-4-0-simulation-data-gates.test.ts` (16) | **PASS** |
| **Total lightweight** | **25 / 25 PASS** |

Synthetic unit tests cover fresh/stale/future timestamps, readiness LIVE vs idle, draft safety literals, and subscribe→live-service source wiring. Production acceptance is separate (this document).

---

## 9. Implementation change (narrow)

- `dev/server/forexconnect-api.ts` — subscribe/unsubscribe via live-service so intended subscriptions persist.

---

## 10. CI / deployment

| Step | Result |
|------|--------|
| Starting commit | `97e2663c` |
| Feature commit | `dca07592` — durable subscribe + tests + report |
| CI run | [Production deploy #39781838114](https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39781838114) — **success** |
| Deployed SHA | `dca07592fe05ed23db7d6de36a22ad8924986526` — `verifiedLive=true` |
| Post-deploy subscribe | `intendedRegistered=true`, `streamState=LIVE`, `intendedCount=1` |
| Public URL | `http://162.35.114.19:5173` |

---

## 11. Remaining blockers / next actions

1. **Scenario 1 VALIDATION_PASSED** — needs Verify→Validate within freshness window with strategy budget ≥ order allocation and successful Entry/SL/TP derivation (or explicit overrides via Admin API).
2. **AT verification snapshot aging** — feed can be LIVE while lastVerification ages to `QUOTE_AGE_EXCEEDED`; operator must re-Verify immediately before draft.
3. **Selected market banner** still “No market selected” while AT instrument is XAU/USD — UX inconsistency (market-data selection ≠ AT instrument); not execution-related.
4. **Admin machine clients** still need API token header (403 without it).
5. **Phase 56.4.2** disconnect/restart — still owner-authorized only.
6. No DEMO/LIVE broker execution without separate written approval.

---

## 12. Final verdict

**`PASS_WITH_KNOWN_BLOCKERS`**

Live-quote subscription path proven; zero-subscription root cause proven and narrowly fixed; safety locks verified in UI; quantity/CondDist/FX remain attested. Full Scenario 1 **VALIDATION_PASSED** under sustained fresh AT verification was **not** achieved — draft correctly **REJECTED_LOCAL** (stale snapshot / budget / missing SL-TP). Gates were not weakened.

**STOP.** Do not start Phase 56.4.2, DEMO order execution, or LIVE execution without explicit owner approval.
