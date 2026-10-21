# Phase 56.2.6 — CondDist, Minimum-Stop Verification & Currency Conversion

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading  
**Document type:** CondDist / min-stop / FX conversion evidence record  
**Starting HEAD:** `606350b1a289107cab87eeae788cd0bb876b2358`  
**Production baseline at start:** `deployedCommit=606350b1…`, `verifiedLive=true` (Phase 56.2.5 docs)  
**Feature baseline:** `6c855d7dcd1d638113023ac8aa582ae241a9ab61`  
**Ending HEAD / deployed:** feature `1a7ce3b349faa8715645db6bbe9a00641fb29a04`; docs evidence `bc719fba083a9e17c94e72c8614e086850f317ff`  
**Installed SDK pin:** ForexConnect pip `1.6.43` (`deploy/provision-forexconnect.sh`)  
**Scope:** Read-only broker + simulation-only sizing. **No execution. LIVE unauthorized. Do not start 56.2.7 / 56.3.**

---

## 1. Inspected sources

| Source | Role |
|--------|------|
| ForexConnect `O2GTradingSettingsProvider.getCondDistStopForTrade` docs (1.6.x) | Unit = **pips** |
| FXCM Markets XAU help (Enhanced Execution) | Public claim only — not account attestation |
| `services/forexconnect-sidecar/server.py` | RO CondDist probes; never lotStep |
| `ai/forex-ai/automated-trading/simulation-risk/conddist-semantics.ts` | Pips → price conversion |
| `currency-conversion.ts` | Verified rate snapshots only |
| Phase 56.2.4 / 56.2.5 docs | Prior blockers |

---

## 2. CondDist semantics

| Question | Verdict |
|----------|---------|
| What CondDist represents | Minimum allowed **distance** between stop (or associated stop) and market / entry, per SDK brief |
| Unit | **pips** when value comes from documented `getCondDist*ForTrade` / Entry* methods |
| Price distance | `priceDistance = condDistPips × PointSize` (Offers) |
| Quantity increment? | **Never** — CondDist must not map to lotStep / quantityStep |
| Local fallback unit? | Sidecar sets `condDistUnit=pips` only after a documented method returns a value; otherwise `unknown` |

**Code fix:** Prior phases could treat raw CondDist as a price distance. This phase converts pips → price before min-stop checks.

---

## 3. Minimum-stop / Enhanced Execution

| Claim layer | Status |
|-------------|--------|
| Public FXCM “no minimum stop under Enhanced Execution” | **PARTIALLY_VERIFIED** marketing — **not** account proof |
| SDK CondDistStop returned for instrument | Account-scoped when available |
| CondDistStop = 0 pips + unit=pips | **VERIFIED** no positive minimum for that instrument/account (`minStopNoPositiveMinimum`) |
| CondDistStop > 0 pips + PointSize | **VERIFIED** min price distance |
| CondDist missing / unit unknown | **UNVERIFIED** — draft min-stop gate **BLOCKED** |
| LIVE parity | **UNVERIFIED** |

No test orders used.

---

## 4. Currency conversion

| Rule | Implementation |
|------|----------------|
| Same currency | Identity (`rate=1`, source=`IDENTITY`) |
| Different currency | Requires `ConversionRateSnapshot` with from/to, rate, **direction** (`MULTIPLY`/`DIVIDE`), source, `observedAtUtc`, `maxAgeMs` |
| Inverse | **Not invented** — mismatched snapshot pair → `FX_RATE_PAIR_MISMATCH` |
| Stale | `FX_RATE_STALE` when age > maxAgeMs |
| Missing | `FX_RATE_UNAVAILABLE` — amount not shown as zero |
| Hardcoded rates | **Forbidden** |
| USD DEMO accounts | Proceed with identity when allocation currency = account currency |
| Non-USD | Fail closed until an authoritative fresh rate is supplied |

Note: Offers `PipCost` / `MMR` are already account-currency when verified by FXCM; separate conversion is for allocation amounts labeled in another currency.

---

## 5. Quote freshness & exposure

Unchanged fail-closed policy from 56.2.4/56.2.5:

- Stale quote → `QUOTE_STALE` BLOCKED  
- Failed Orders/Trades query ≠ confirmed empty  
- Authoritative empty → `confirmedZeroExposure` only when capability AVAILABLE + NO_ORDERS/NO_TRADES  

UI surfaces Quote / Exposure, Min-Stop / CondDist, and Currency Conversion on the Simulation Draft grid.

---

## 6. Preserved policies

- Quantity constraints from Phase 56.2.5 intact  
- `strategyAllocationBudget = equity × pct / 100`  
- `maxPermittedOrderLoss = orderAllocation × 25 / 100`  
- 3R TP + mandatory SL/TP  
- Floor-only quantity rounding  

---

## 7. Tests

`tests/unit/ai/forex-ai/phase56-2-6-conddist-currency.test.ts` (+ updated 56.2.4 CondDist price expectation)

---

## 8. Safety locks

| Lock | State |
|------|-------|
| `masterTradingEnabled` | `false` |
| `emergencyEntryLock` | `true` |
| `placesOrders` | `false` |
| `acceptsForExecution` | `false` |
| ForexConnect trading | DISABLED |
| LIVE | unauthorized |

---

## 9. Remaining blockers

1. LIVE CondDist / Enhanced Execution attestation  
2. Authoritative non-USD FX rate feed wired from Offers (module ready; production rate source still required)  
3. CondDist method alias on some SDK wrappers may still yield `unit=unknown` until documented method name is present  

---

## 10. CI/CD / production

| Item | Evidence |
|------|----------|
| Feature commit | `1a7ce3b349faa8715645db6bbe9a00641fb29a04` — `feat(forex): Phase 56.2.6 CondDist pips semantics, min-stop attestation, FX conversion` |
| Docs follow-up | `bc719fba083a9e17c94e72c8614e086850f317ff` — this evidence fill |
| CI/CD (feature) | Production deploy #389 / run `39571010719` — **success** on `1a7ce3b3` |
| CI/CD (docs) | Production deploy #390 / run `39573514461` — **success** on `bc719fba` |
| Production `/api/deployment` (feature) | `deployedCommit=1a7ce3b349faa8715645db6bbe9a00641fb29a04`, `verifiedLive=true`, timestamp `2026-10-21T08:43:29.405Z` |
| Production `/api/deployment` (docs) | `deployedCommit=bc719fba083a9e17c94e72c8614e086850f317ff`, `verifiedLive=true`, `result=success`, timestamp `2026-10-21T09:03:07.203Z` |
| Production `/api/health` | `ok=true`, `status=healthy`, `runtimeReady=true` |
| Public AT URL | `http://162.35.114.19:5173/forex/automated-trading` |
| Vite bundle string check | `ForexApp-OR9X-acn.js` contains `Order Allocation (USD)`, `Quote Freshness`, `Min-Stop / CondDist`, `Currency Conversion`, `placesOrders` |
| Online UI shell | Execution banner present; admin session missing → Simulation Draft cells not interactively exercised (token required) |
| Responsive draft grid | Bundle + source present; interactive 390/768/1024/1440 draft verification **deferred** until admin token available |

**Verdict:** `PASS_WITH_KNOWN_BLOCKERS` — feature deployed and verifiedLive; CondDist pips path + FX conversion module shipped; remaining blockers in §9.

*End of Phase 56.2.6 record.*
