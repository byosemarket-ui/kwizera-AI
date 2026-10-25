# Phase 59.0.3 — ForexConnect Quote Subscription and Readiness Repair

**Date:** 2026-10-25  
**Prior VPS:** `919649ed` (Phase 59.0)  
**Verdict:** Local blocker fixes complete · **not pushed / not deployed** · live broker quotes **not** observed in this phase

---

## 1. Root cause (original)

`intendedCount=0` / `AUTHENTICATED_IDLE` while DEMO **CONNECTED** was empty durable Offers intent — AT config never seeded; bridge-only subscribe; idle forgot intended.

## 2. Blocker fixes (post-review)

| Blocker | Fix |
|---------|-----|
| 1 Instrument validation | `validateAtQuoteInstrumentForSubscribe` — allowlist + FC catalog before seed/`ensureValidatedAtInstrument` |
| 2 Execution gate | `readiness()` pushes quote readiness code into `blockers`; `mayAttemptDemoMutation` requires `readyForExecutionQuote` |
| 3 Freshness | `evaluateExecutionQuoteEvidence` — age required; stale/future/unknown age fail closed (`MARKET_QUOTE_STALE_MS` = 15s) |
| 4 Quote evidence | Orchestrator passes offer `bid`/`ask`/`offerTime`/`instrument` into readiness + preflight |

### Diagnostic codes

`INSTRUMENT_NOT_CONFIGURED` · `INSTRUMENT_NOT_PERMITTED` · `SUBSCRIPTION_NOT_INITIALIZED` · `QUOTE_NOT_RECEIVED` · `QUOTE_INVALID` · `QUOTE_STALE` · `QUOTE_READY`

---

## 3. Files

| File | Change |
|------|--------|
| `validate-at-quote-instrument.ts` | **New** — permit + catalog gate |
| `quote-subscription-readiness.ts` | Evidence evaluator + codes |
| `demo-execution/preflight.ts` | Freshness + instrument match required |
| `demo-execution/orchestrator.ts` | Real quote evidence; blockers; validated ensure |
| `live-service.ts` | Seed validates; `ensureValidatedAtInstrument` |
| `seed-at-quote-instruments.ts` | AT config collect (no invent) |
| tests phase59-0-3 / phase41 / phase58-3 | Coverage |

---

## 4. Tests

| Suite | Exit | Result |
|-------|------|--------|
| phase59-0-3 | 0 | **12/12** |
| phase59-0 | 0 | **11/11** |
| phase41 | 0 | **5/5** |
| phase58-2/3/5 | 0 | **24/24** |

`--pool=forks --maxWorkers=1`. Mocks ≠ live Offers evidence.

---

## 5. Safety

`placesOrders=false` · `acceptsForExecution=false` · Master OFF · Emergency ON · `DisabledBrokerMutationAdapter` unchanged · prepare remains non-mutating.

---

## 6. Next step

Owner authorize **commit + push** (aware `main` auto-deploys) → authenticated RO quote-probe for real `offerTime`/bid/ask. No mutation/grant/order unless separately authorized.
