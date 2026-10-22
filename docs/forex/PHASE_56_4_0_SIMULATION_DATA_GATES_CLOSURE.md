# Phase 56.4.0 — Simulation Data Gates Closure

**Project:** KWIZERA AI STUDIO  
**Module:** FXCM ForexConnect Automated Trading (simulation / verification only)  
**Phase:** 56.4.0  
**Classification:** implementation + production verification  
**This phase does not authorize broker order submission, DEMO execution, or LIVE trading.**

---

## 1. Baseline (verified before edit)

| Item | Observed |
|------|----------|
| Local HEAD (pre-commit) | `f2e0f801` — master audit docs (ahead of `origin/main` by 1) |
| Prior production SHA | `fd7f00e1` (`verifiedLive=true`, Phase 56.3.5) |
| Unrelated dirty tree | PMV / typography / video files — **preserved, not staged** |
| Prod MDS XAU RO probe | `baseUnitSize=1`, `contractMultiplier=1`, `pointSize=0.01`, `pipCost=0.01`, `minQuantity=1`, `lotStep=1`, `condDistStop=0`, `condDistUnit=pips`, `condDistMethod=get_cond_dist_stop_for_trade` |
| AT `/status` without Admin | historically **403** → `masterTradingEnabled` / `emergencyEntryLock` **UNVERIFIED** via public API this phase unless Admin token available |

Historical audit leads (`quantity_constraints` BLOCKED, `min_stop` UNVERIFIED, FX gaps) treated as leads and closed in code against the attested MDS shape above.

---

## 2. Evidence sources

| Gate | Source | Notes |
|------|--------|-------|
| Quantity unit / min / step | ForexConnect Offers + TradingSettings (`BaseUnitSize`, `MinQuantity`, `ContractMultiplier`, `PointSize`, `PipCost`) | Increment = BaseUnitSize; min ≠ step; floor-only sizing preserved |
| CondDist unit | O2GTradingSettingsProvider `getCondDistStopForTrade` (docs: **pips**) × Offers `PointSize` | Sidecar `condDistMethod` + `condDistUnit=pips`; zero = no positive minimum when attested |
| FX conversion | Offers bid/ask mid → `ConversionRateSnapshot` | Direct / inverse DIVIDE / USD cross; identity for USD accounts; no hardcoded rates |
| Safety locks | Code literals + readiness gate | `placesOrders=false`, `acceptsForExecution=false`; master/emergency from store when status readable |

---

## 3. Implementation details

### Quantity / contract units

- `verification-engine`: pass through `minQuantity` / `lotStep` / `condDistMethod`; do not force `quantityStep=null` before contract-spec.
- `contract-spec`: for XAU only, when Offers omit `ContractMultiplier` but `BaseUnitSize===1` and PointSize+PipCost are attested, resolve multiplier `1` (FXCM 1 contract = 1 oz binding). Non-XAU unchanged / fail-closed.
- `resolveXauQuantityConstraints` unchanged policy: BaseUnitSize = step; discard invented `0.01` lots mins; floor-only via `floorQuantityToStep`.

### CondDist / minimum-stop

- New `isDocumentedCondDistMethod()` accepts snake_case / camelCase documented getters.
- `resolveCondDistMinStop` / `resolveXauQuantitySemantics` accept `condDistMethod`.
- **Bugfix:** `simulateDraft` no longer hardcodes `condDistStopUnit: "pips_or_points_unverified"`. Uses verification instrument unit + method.
- `assembleSimDraftInput` falls back to instrument CondDist fields when overrides omitted.
- CondDist=0 with unit=pips / documented method → `minStopNoPositiveMinimum` READY. No manufactured positive minimum.

### Currency conversion

- New `buildOffersConversionRateSnapshot()`: IDENTITY / DIRECT (MULTIPLY) / INVERSE (DIVIDE) / CROSS_USD; freshness + source + direction required.
- Status path: USD account → identity READY; non-USD → attempt Offers snapshot when Connected + env match; else fail-closed with reason.
- Public readiness summary includes quantity / CondDist / conversion **evidence** (rate value omitted from public status).

### Safety preserved

- No broker submit/cancel/modify/position APIs added.
- `EXECUTION_FORBIDDEN` / ForexConnect `trading: DISABLED` / allowlist XAU-only unchanged.
- Readiness still reports `placesOrders: false`, `acceptsForExecution: false`.

---

## 4. Tests

| Suite | Result |
|-------|--------|
| `tests/unit/ai/forex-ai/phase56-4-0-simulation-data-gates.test.ts` (16) | **PASS** |
| `phase56-2-6-conddist-currency.test.ts` (16) | **PASS** |
| `phase56-2-7-simulation-data-readiness.test.ts` (12) | **PASS** |
| **Total** | **44 / 44 PASS** |

Categories covered: CondDist method provenance; XAU verification metadata; ContractMultiplier omission binding; non-XAU reject; Offers FX direct/inverse/stale/missing; Scenario 1 synthetic readiness READY; assemble+validate draft without legacy unverified unit; source safety scan.

Heavy suites deferred to remote CI/CD per phase workflow.

---

## 5. CI / deployment / production

| Step | Result |
|------|--------|
| Scoped commit | *(filled after commit)* |
| GitHub push | *(filled after push)* |
| CI/CD | *(filled after Actions)* |
| Deployed SHA / VPS | *(filled after `/api/deployment`)* |
| Public prod URL | `http://162.35.114.19:5173` |

---

## 6. Scenario 1 result

**Path:** fresh live quote → validated instrument metadata → Entry/SL/TP → 3R → quantity → allocation/budget → SL loss → margin → exposure → draft validate → persist/reload.

| Environment | Result |
|-------------|--------|
| Synthetic unit (attested XAU + CondDist=0 + USD) | Gates **READY**; draft path exercises attested CondDist (not legacy unverified label) |
| Production interactive Scenario 1 | *(filled after deploy + RO verification)* |

If production quote is STALE, exposure UNAVAILABLE, Admin locks UNVERIFIED, or Offers metadata incomplete → Scenario 1 reported **BLOCKED** without weakening gates.

---

## 7. Unresolved blockers (honest)

1. **Production disconnect / process restart** — still not authorized (carry-forward from 56.3.5).
2. **Admin-gated AT status** — without Admin auth, `masterTradingEnabled` / `emergencyEntryLock` remain **UNVERIFIED** via API (do not infer from old screenshots).
3. **Non-USD FX** — READY only when Connected Offers supply a fresh direct/inverse/cross path; otherwise BLOCKED (by design).
4. **Broker order lifecycle** — intentionally unimplemented (`EXECUTION_FORBIDDEN`).
5. **LIVE execution** — unauthorized.

---

## 8. Safety-invariant evidence

| Invariant | Evidence |
|-----------|----------|
| `placesOrders=false` | Code literals in service + readiness + draft results; unit test source scan |
| `acceptsForExecution=false` | Same |
| `EXECUTION_FORBIDDEN` / trading DISABLED | Unchanged ForexConnect bridge status typing `trading: "DISABLED"` |
| Allowlist XAU-only | Unchanged `AT_INSTRUMENT_ALLOWLIST` |
| No order submission methods | Unit test asserts no `createOrder`/`submitOrder`/`placeOrder(` in AT service |
| `masterTradingEnabled` / `emergencyEntryLock` | **UNVERIFIED** without Admin token on public AT status |

---

## 9. Final verdict

**`PASS_WITH_KNOWN_BLOCKERS`** *(provisional until post-deploy production Scenario 1 fill-in)*

Gates closed in code against attested provider semantics. Production Scenario 1 and Admin lock re-read remain environment-dependent; do not weaken gates for a green result.

**STOP.** Do not start Phase 56.4.1, Phase 57, DEMO order execution, or LIVE execution without explicit owner approval.
