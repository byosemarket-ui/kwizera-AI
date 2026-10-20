# Phase 56.1 — FXCM ForexConnect Capability Verification Audit

**Project:** KWIZERA AI STUDIO
**Module:** FXCM ForexConnect Automated Trading
**Document type:** Read-only capability audit (documentation only)
**Status:** COMPLETE FOR OWNER REVIEW
**Baseline repository HEAD at authoring:** `4961961689b725f82d966054f30202e9003e24e0` (`main`)
**Authoring date (UTC):** 2026-10-20
**Public production host probed:** `http://162.35.114.19:5173`

**This phase does not authorize broker execution, LIVE trading, SDK changes, or application source changes.**

---

## 1. Executive summary

Phase 56.1 audited the **installed ForexConnect runtime path as exposed through production**, the **repository sidecar/Node/AT integration**, and the **gap between read-only market/account capabilities and future order lifecycle requirements**.

### Verdict (evidence-labeled)

| Area | Verdict |
|------|---------|
| Sidecar read-only market + account surface | **PASS** for Offers instruments, accounts table mapping, candles/quotes/stream contracts in **source**; DEMO instruments + session status **PASS** via production GET |
| Trading / order submission in sidecar | **PASS (absent by design)** — no create/modify/cancel/close routes |
| Orders / Trades / ClosedTrades table readers | **MISSING** in application |
| Exact installed SDK trading method inventory | **UNVERIFIED** (no package introspection / VPS `pip show` in this phase; probe reports version string `"installed"`, not semver) |
| DEMO session environment label | **PASS** on production status (`environment=demo`, `environmentLabel=FXCM DEMO`, `connectionLabel` path present) |
| LIVE session / LIVE metadata | **UNVERIFIED** — LIVE profile not configured on production; LIVE execution unauthorized |
| XAU/USD instrument identity + Offers sizing fields (DEMO) | **PARTIAL PASS** — symbol, status, bid/ask, pointSize, baseUnitSize, lotStep, mmrPerLot observed; ounce semantics and min-stop distance **not** proven |
| Shared DEMO/LIVE architecture readiness (design) | **ALIGNED** with Phase 56.0 OD-11; implementation gaps remain (draft/risk/orders RO) |
| Safe to begin automated broker submission | **NOT READY** — blocking gaps remain |

**Operational ceiling remains draft-only.** Master trading OFF, emergency entry lock ON, `placesOrders=false`, `acceptsForExecution=false` are preserved by source defaults and API contracts. This audit did not mutate broker state.

### Evidence label legend (used throughout)

| Label | Meaning |
|-------|---------|
| `VERIFIED_INSTALLED_RUNTIME` | Observed via production HTTP against the live VPS-backed app |
| `VERIFIED_SOURCE_CODE` | Observed in repository source inspected for this audit |
| `VERIFIED_AUTHORITATIVE_DOCUMENTATION` | Official/repo docs or provision scripts that define intended behavior |
| `INFERRED_NOT_RUNTIME_VERIFIED` | Reasonable inference from source/docs without matching runtime proof |
| `UNVERIFIED` | Not proven; may require a future authorized phase |

Capability status: `PASS` | `PARTIAL` | `MISSING` | `UNVERIFIED`.
Severity if missing: `BLOCKING` | `HIGH` | `MEDIUM` | `LOW`.

---

## 2. Exact SDK and runtime evidence

### 2.1 Repository pins and provision intent

| Item | Value | Evidence |
|------|-------|----------|
| Provision pip pin default | `1.6.43` (`KWIZERA_FOREXCONNECT_PIP_VERSION`) | `VERIFIED_SOURCE_CODE` — `deploy/provision-forexconnect.sh` L19, L122 (`forexconnect==${FC_VERSION}`) |
| Sidecar `requirements.txt` | `forexconnect>=1.6.43` | `VERIFIED_SOURCE_CODE` — looser than provision `==` pin (**mismatch**) |
| Python target | Python 3.7 venv (cp35–cp37 wheels) | `VERIFIED_AUTHORITATIVE_DOCUMENTATION` / source — provision script |
| Import version print | `getattr(forexconnect, '__version__', 'installed')` | `VERIFIED_SOURCE_CODE` — provision L156; if `__version__` missing, probe stores `"installed"` |

### 2.2 Production runtime probe (read-only HTTP)

Probed via `GET /api/forex/providers/forexconnect/status` (safe fields only; no secrets).

| Field | Observed | Label |
|-------|----------|-------|
| Session status | `CONNECTED` | `VERIFIED_INSTALLED_RUNTIME` |
| Environment | `demo` / `FXCM DEMO` | `VERIFIED_INSTALLED_RUNTIME` |
| `sdkAvailable` | `true` | `VERIFIED_INSTALLED_RUNTIME` |
| `trading` | `DISABLED` | `VERIFIED_INSTALLED_RUNTIME` |
| `instrumentCount` | `516` | `VERIFIED_INSTALLED_RUNTIME` |
| `historicalCapable` / `streamingCapable` | `true` (while CONNECTED) | `VERIFIED_INSTALLED_RUNTIME` |
| `runtimeProbe.sdkVersionRequested` | `1.6.43` | `VERIFIED_INSTALLED_RUNTIME` |
| `runtimeProbe.sdkVersionInstalled` | `"installed"` (not a semver) | `VERIFIED_INSTALLED_RUNTIME` — **exact package semver not exposed** |
| `runtimeProbe.sdkImportOk` | `true` | `VERIFIED_INSTALLED_RUNTIME` |
| `runtimeProbe.sidecarPython` | `Python 3.7.17` | `VERIFIED_INSTALLED_RUNTIME` |
| `runtimeProbe.venvPython` | path under `…/services/forexconnect-sidecar/.venv/bin/python` | `VERIFIED_INSTALLED_RUNTIME` |
| `runtimeProbe.runtimeReady` / `enableAllowed` | `true` | `VERIFIED_INSTALLED_RUNTIME` |
| OS / arch | Ubuntu 26.04-class host, `x86_64` | `VERIFIED_INSTALLED_RUNTIME` |
| LIVE profile configured | `liveConfigured: false` (profiles public state, prior probe) | `VERIFIED_INSTALLED_RUNTIME` / prior phase continuity |

**Limitation:** This phase did **not** run VPS `pip show forexconnect` or introspect installed SDK classes/methods. Match between installed wheel and `1.6.43` is **requested** by provision and **import-ok**, but **semver equality is UNVERIFIED** because the probe string is the fallback `"installed"`.

### 2.3 Sidecar process and bind

| Item | Value | Label |
|------|-------|-------|
| Bind | `127.0.0.1:5179` (public bind rejected) | `VERIFIED_SOURCE_CODE` — `server.py` `main()` |
| Trading flag in every safe status | `"DISABLED"` | `VERIFIED_SOURCE_CODE` + runtime |
| Node bridge | Localhost sidecar fetch; status advertises trading disabled | `VERIFIED_SOURCE_CODE` — `ai/market-data/forexconnect/client.ts` |

---

## 3. Existing sidecar and Node bridge capability inventory

### 3.1 Sidecar HTTP surface (`services/forexconnect-sidecar/server.py`)

| Method | Path | Purpose | App uses it | Status |
|--------|------|---------|-------------|--------|
| GET | `/health` | Liveness | Yes (ops) | `PASS` source |
| GET | `/status` | Safe session status; `trading: DISABLED` | Yes | `PASS` source + DEMO runtime |
| GET | `/instruments` | Offers + TradingSettings sizing probes | Yes | `PASS` DEMO runtime (516 rows; XAU present) |
| GET | `/accounts` | Accounts table RO snapshot | Yes via **sidecar + Node client bridge**; **no** public `GET /api/forex/providers/forexconnect/accounts` route in `forexconnect-api.ts` | `PASS` sidecar source; public HTTP `NOT_FOUND` on production (`VERIFIED_INSTALLED_RUNTIME`) — see §4.1 |
| GET | `/candles` | `get_history` bid OHLC | Yes | `PASS` source; DEMO candles — prior phases / capable flag |
| GET | `/quote`, `/quotes` | Cached/stream quotes | Yes | `PASS` source |
| GET | `/stream/status` | Stream diagnostics | Yes | `PASS` DEMO runtime (`AUTHENTICATED_IDLE`, `trading: DISABLED`) |
| POST | `/connect` | Authenticate (profile overrides) | Yes | `PASS` source (not re-exercised with credential mutation this phase) |
| POST | `/disconnect` | Disconnect | Yes | `PASS` source |
| POST | `/subscribe` / `/unsubscribe` | Offers subscriptions | Yes | `PASS` source |
| *any* | order/trade mutate | — | — | **Absent** — `PASS` (forbidden by design) |
| *any* | `/orders`, `/trades`, ClosedTrades | — | — | **MISSING** |

### 3.2 SDK tables / helpers used by sidecar today

| Capability | SDK / API | Used by app | Label |
|------------|-----------|-------------|-------|
| Offers table | `fx.get_table(ForexConnect.OFFERS)` | Yes | `VERIFIED_SOURCE_CODE` + DEMO instruments |
| Accounts table | `fx.get_table(ForexConnect.ACCOUNTS)` | Yes | `VERIFIED_SOURCE_CODE` |
| TradingSettingsProvider | `login_rules.trading_settings_provider` → `get_base_unit_size` / `get_mmr` / optional min quantity | Yes (instrument enrichment) | `VERIFIED_SOURCE_CODE` + DEMO fields on XAU |
| History | `get_history` (bid OHLC) | Yes | `VERIFIED_SOURCE_CODE` |
| Stream | `Common.subscribe_table_updates` + Offers poll | Yes | `VERIFIED_SOURCE_CODE` |
| Orders table | — | No | `MISSING` |
| Trades / ClosedTrades | — | No | `MISSING` |
| Create/modify/cancel order | — | No | `MISSING` (intentionally) |

### 3.3 Automated Trading stack (Phase 52–54)

| Component | Path | Role | Execution |
|-----------|------|------|-----------|
| Types / defaults | `ai/forex-ai/automated-trading/types.ts` | DEMO/LIVE state; defaults `masterEnable=false`, `emergencyEntryLock=true`; `placesOrders: false` | Forbidden |
| Service | `…/service.ts` | Status, verification, monitoring, analysis, decisions | Forces blockers; LIVE blocked |
| Verification | `verification-engine.ts` | `riskEngineVerified: false`, `readyForTrading: false` | Fail-closed |
| Decision | `decision/engine.ts` | `ACCEPTED_FOR_REVIEW` only; rejects `readyForTrading` leak | Non-executable |
| API | `dev/server/forex-automated-trading-api.ts` | Order-like paths → `EXECUTION_FORBIDDEN`; always `placesOrders: false`, `acceptsForExecution: false` | Forbidden |
| Position sizing (adjacent) | `ai/forex-ai/position-sizing/contract-spec.ts` | Does not invent ounces; used by analysis plans, **not** AT eligibility | N/A |

---

## 4. Read-only broker-data capability matrix

Columns: **SDK/route** · **In installed SDK (as used)** · **App uses** · **RO verified** · **DEMO** · **LIVE** · **Status** · **Severity if gap**

### 4.1 Session and account

| Capability | Exact hook | In SDK path | App | RO verified | DEMO | LIVE | Status | Sev |
|------------|------------|-------------|-----|-------------|------|------|--------|-----|
| Session health | `/status` → `status` | Yes | Yes | Yes | Yes | No | `PASS` | — |
| Session environment | `_normalize_environment` + login connection Demo/Real; status `environment` | Yes (connection string) | Yes | Yes (label) | Yes | No | `PARTIAL` — UI/session label ≠ independent broker “account type” certificate | `HIGH` for LIVE |
| Account identity | Accounts `AccountID` masked | Yes | Yes | Source + prior AT verify | DEMO path exists | No | `PARTIAL` | `HIGH` |
| Equity / balance | Sidecar `/accounts` + Node `getAccounts()`; **no** public provider HTTP route | Yes | Yes (bridge/AT) | Sidecar source; public `GET …/forexconnect/accounts` → `NOT_FOUND` | Bridge not re-probed this phase | No | `PARTIAL` | `BLOCKING` for risk |
| Used / usable margin | UsedMargin / UsableMargin | Yes | Yes (bridge/AT) | Same as equity | Same | No | `PARTIAL` | `BLOCKING` for risk |
| Margin requirements | TradingSettings `get_mmr` (absolute per lot) | Yes | Yes (mmrPerLot on instruments) | DEMO XAU `mmrPerLot=4.79` | Yes | No | `PARTIAL` — absolute MMR ≠ rate; semantics must stay explicit | `HIGH` |
| Account trading eligibility | Not a dedicated field in sidecar | Unknown | No | No | No | No | `UNVERIFIED` | `MEDIUM` |

### 4.2 Instrument and market data

| Capability | Exact hook | In SDK path | App | RO verified | DEMO | LIVE | Status | Sev |
|------------|------------|-------------|-----|-------------|------|------|--------|-----|
| Offer metadata | Offers normalize | Yes | Yes | Yes | Yes | No | `PASS` | — |
| XAU/USD id | `providerSymbol=XAU/USD`, `canonicalSymbol=XAUUSD` | Yes | Yes | Yes | Yes | No | `PASS` | — |
| Trading status | Offers `TradingStatus` (`O` open observed) | Yes | Yes | Yes | Yes | No | `PASS` (point-in-time) | — |
| Bid / Ask | Offers | Yes | Yes | Yes (e.g. bid 4131.72 / ask 4132.02) | Yes | No | `PASS` | — |
| Spread | Derived bid/ask | Derived | Can derive | Yes | Yes | No | `PASS` (computed) | — |
| Price-change timestamps | Sidecar stream `lastQuoteAt` / receipt ages | App-side | Yes | Stream idle: `lastQuoteAgeMs=null` without subscription | Partial | No | `PARTIAL` — no distinct broker event TS on Offers path (sidecar note) | `HIGH` for freshness |
| Quote freshness policy | AT `MARKET_QUOTE_STALE_MS` (15s) | App | Yes | Source | Policy exists | — | `PASS` policy / `PARTIAL` feed when unsubscribed | `HIGH` |
| Historical candles | `/candles` → `get_history` | Yes | Yes | Capable flag true | Prior | No | `PARTIAL` this phase (not re-fetched) | `MEDIUM` |
| Contract-size / base unit | `baseUnitSize` via TradingSettings | Yes | Yes | DEMO XAU `baseUnitSize=1` | Yes | No | `PARTIAL` — unit meaning (oz vs lot) **not** proven | `BLOCKING` |
| Min qty / step | `lotStep` / min quantity methods | Probed | Yes | DEMO XAU `lotStep=1` | Yes | No | `PARTIAL` | `BLOCKING` |
| Price precision | `digits`, `pointSize` | Yes | Yes | DEMO XAU `digits=2`, `pointSize=0.01` | Yes | No | `PASS` | — |
| Min stop distance | CondDist* deliberately **not** mapped | Unknown exposure | No | No | No | No | `UNVERIFIED` / `MISSING` in app | `BLOCKING` for SL eligibility |

### 4.3 Broker trading state

| Capability | Exact hook | In SDK path | App | RO verified | DEMO | LIVE | Status | Sev |
|------------|------------|-------------|-----|-------------|------|------|--------|-----|
| Open / pending orders | Orders table | Unknown installed | **No** | No | No | No | `MISSING` | `BLOCKING` |
| Open trades / positions | Trades table | Unknown | **No** (`openPositionsCount` prepared, not populated from FC) | No | No | No | `MISSING` | `BLOCKING` |
| Closed trades / history | ClosedTrades | Unknown | No | No | No | No | `MISSING` | `HIGH` |
| Broker order/trade IDs | — | Unknown | No | No | No | No | `UNVERIFIED` | `BLOCKING` |
| Fill qty / avg price / partial fills | — | Unknown | No | No | No | No | `UNVERIFIED` | `HIGH` |
| Existing SL/TP state | — | Unknown | No | No | No | No | `UNVERIFIED` | `BLOCKING` |
| Broker rejection details | — | Unknown | No | No | No | No | `UNVERIFIED` | `HIGH` |

**Rule applied:** order/position capabilities that would require mutation to “prove” are classified `UNVERIFIED` with a future safe plan — this phase performed **zero** mutations.

---

## 5. DEMO/LIVE separation assessment

### 5.1 What exists today

| Control | Mechanism | Label |
|---------|-----------|-------|
| Connection environment | Sidecar `_normalize_environment` → Demo/Real login connection | `VERIFIED_SOURCE_CODE` |
| Profile vault | Encrypted DEMO/LIVE credentials; active environment | `VERIFIED_SOURCE_CODE` |
| AT environment model | `AutomatedTradingEnvironment = "DEMO" \| "LIVE"` + per-env controls | `VERIFIED_SOURCE_CODE` |
| Epoch isolation | `environmentEpoch` bumps on switch; clients must match | `VERIFIED_SOURCE_CODE` |
| LIVE operational block | Status forces LIVE blockers; module never execution-ready | `VERIFIED_SOURCE_CODE` |
| Production LIVE config | `liveConfigured: false` | `VERIFIED_INSTALLED_RUNTIME` |
| Execution locks | Defaults OFF/ON; API `placesOrders`/`acceptsForExecution` false literals | `VERIFIED_SOURCE_CODE` |

### 5.2 Gaps (fail-closed requirements for future LIVE)

1. **Environment identity contract incomplete** — session reports intended Demo/Real connection label; there is no verified broker-side “account environment certificate” independent of login URL/connection string.
2. **Reconnect / stale evidence** — epoch helps AT clients; must also bind drafts/intents to verified account fingerprint + env + config version.
3. **Ambiguous environment must not unlock execution** — today execution is globally forbidden; future submit must require `expectedEnv == actualEnv == authorizedEnv`.
4. **UI DEMO label alone is insufficient** — owner requirement confirmed; architecture must treat labels as claims until verified.
5. **LIVE execution release** must be a separate gate from “LIVE profile exists” and from “shared engine supports LIVE”.

### 5.3 Recommended environment identity contract (design-only)

Persist and compare on every privileged AT action:

- `expectedEnvironment` / `actualEnvironment`
- `expectedAccountFingerprint` / `actualAccountFingerprint` (masked; never raw secrets)
- `sessionState`, `verifiedAtUtc`
- `accountEligible`, `instrumentEligible`
- Independent `executionPermission` (always false until separate release)
- `configVersion` + `environmentEpoch` + sidecar/runtime probe fingerprint
- Fail-closed `reasonCode` when any mismatch

If SDK cannot prove environment beyond connection string, document residual risk and require dual attestation (connection + owner-approved account allowlist).

---

## 6. XAU/USD contract and instrument metadata assessment

### 6.1 DEMO observations (production instruments GET)

| Field | Value | Label |
|-------|-------|-------|
| `providerSymbol` | `XAU/USD` | `VERIFIED_INSTALLED_RUNTIME` |
| `canonicalSymbol` | `XAUUSD` | `VERIFIED_INSTALLED_RUNTIME` |
| `instrumentType` / label | `5` / `Bullion` | `VERIFIED_INSTALLED_RUNTIME` |
| `tradingStatus` | `O` | `VERIFIED_INSTALLED_RUNTIME` (point-in-time) |
| `pointSize` / `digits` | `0.01` / `2` | `VERIFIED_INSTALLED_RUNTIME` |
| `pipCost` | `0.01` | `VERIFIED_INSTALLED_RUNTIME` |
| `contractMultiplier` | `1` | `VERIFIED_INSTALLED_RUNTIME` — **does not prove ounces** |
| `baseUnitSize` | `1` | `VERIFIED_INSTALLED_RUNTIME` — **unit semantics UNVERIFIED** |
| `lotStep` | `1` | `VERIFIED_INSTALLED_RUNTIME` |
| `mmrPerLot` | `4.79` | `VERIFIED_INSTALLED_RUNTIME` (absolute margin for 1 lot per sidecar comment) |
| `contractCurrency` | `USD` | `VERIFIED_INSTALLED_RUNTIME` |
| Bid / Ask | Present | `VERIFIED_INSTALLED_RUNTIME` |

### 6.2 Eligibility conclusion for future execution

**XAU/USD is not eligible for future automated execution yet.** Missing/ambiguous:

- Quantity unit meaning (ounces vs contracts vs broker “lots”) — must not invent ounces.
- Minimum stop distance / CondDist — not exposed by app; UNVERIFIED.
- LIVE metadata parity — UNVERIFIED.
- Hard AT allowlist enforcement for XAU/USD only — **MISSING** in AT policy (Phase 56.0 class C).
- Owner risk % — undecided (OD-04).

Position-sizing helper correctly refuses invented ounce multipliers (`contract-spec.ts`).

---

## 7. Orders, trades, positions, fills, and protective-order assessment

### 7.1 Current state

- Sidecar: **no** Orders/Trades readers; **no** order APIs.
- AT: `openPositionsCount` field exists but is **not** fed from ForexConnect tables.
- Protective SL/TP verification: **MISSING**.
- Installed SDK order API signatures: **UNVERIFIED** (do not use other SDK-version examples as proof).

### 7.2 Future lifecycle (design-only; operational ceiling = draft)

```
DRAFT
 → VALIDATING
 → ELIGIBLE_FOR_SEPARATE_APPROVAL
 → SUBMISSION_PENDING          [future authorized phase only]
 → SUBMISSION_UNKNOWN | BROKER_ACKNOWLEDGED
 → WORKING
 → PARTIALLY_FILLED            [only if SDK/broker proven]
 → FILLED | REJECTED_BY_BROKER
```

Plus future: cancel, close, protective-order verify, reconcile, recover — **only where SDK support is proven**.

### 7.3 Implementation requirements (not built in 56.1)

| Requirement | Why |
|-------------|-----|
| Persist intent **before** any network submit | Idempotency / crash safety |
| Enforce idempotency key | Avoid duplicate tickets after timeout |
| Map intentId ↔ broker orderId ↔ tradeId | Reconciliation |
| Distinguish pending orders vs open positions | Correct state machine |
| Represent partial fills only if verified | Do not invent PARTIALLY_FILLED |
| Reconcile broker vs local; detect orphans | Safety |
| Timeout → `SUBMISSION_UNKNOWN`, never success/fail guess | Owner invariant |
| No blind retry after ambiguous submit | Safety |
| Detect missing/inactive protective SL/TP after fill | OD-05 / OD-08 |

---

## 8. Risk-engine prerequisites

Before a future risk engine may mark an XAU/USD draft **eligible**, the following must be available and verified (simulation-first; risk % undecided):

| Prerequisite | Available now? | Notes |
|--------------|----------------|-------|
| Account equity | Partial (Accounts RO exists) | Must be fresh + env-bound |
| Available / used margin | Partial | Same |
| Owner-approved risk budget | **No** | OD-04 undecided — do not invent |
| Entry price (fresh) | Partial | Requires active subscription + freshness PASS |
| SL distance + TP direction / R:R | Structural candidates only | Both SL and TP mandatory for eligibility; not validated as AT gate yet |
| Contract size / quantity unit | Partial / ambiguous | Do not invent ounces |
| Min qty / step | Partial (`lotStep`) | Confirm meaning |
| Price precision / tick | Yes (DEMO Offers) | — |
| Min stop distance | **No** | BLOCKING |
| Session / instrument availability | Partial (`tradingStatus`) | Point-in-time |
| Open positions / pending orders | **No** | BLOCKING |
| Supported order types / TIF | **UNVERIFIED** | Do not invent GTC/GTD |
| Attached vs separate SL/TP | **UNVERIFIED** | — |
| Post-fill protective visibility | **UNVERIFIED** | — |

`riskEngineVerified` remains forced `false` in verification types.

---

## 9. Severity-ranked gaps

### BLOCKING (before any DEMO submission phase)

1. No Orders/Trades RO readers → cannot reconcile or detect orphans.
2. Quantity unit / contract semantics for XAU/USD unresolved.
3. Min stop distance unverified / unmapped.
4. Owner risk percentage undecided.
5. No AT hard allowlist for XAU/USD.
6. No draft/intent store or eligibility validator.
7. Exact SDK order/protective-order APIs for installed package unverified.
8. Exact installed package semver not confirmed (`"installed"` probe).

### HIGH

9. Environment identity lacks broker-independent attestation.
10. LIVE metadata and LIVE RO behavior unverified (and LIVE not configured).
11. Quote freshness depends on subscription; idle stream ≠ fresh prices.
12. Fill/partial-fill/rejection detail contracts unknown.
13. `requirements.txt` `>=1.6.43` vs provision `==1.6.43` pin drift risk.
13b. Public Node HTTP route for accounts missing (sidecar RO exists; external RO probe blocked).

### MEDIUM

14. Account trading-eligibility field not exposed.
15. Closed trade history reader absent.
16. Candle/timestamp conventions not re-verified in this phase.

### LOW

17. Catalog type-label map incomplete for rare instrument types.
18. Documentation-only deploy may not change runtime behavior (expected).

---

## 10. Recommended shared DEMO/LIVE architecture

**One engine, environment as a parameter (OD-11).** Do **not** fork a DEMO-only trading engine.

### Shared components

- Market-data collection + freshness validation
- AI analysis + decision review
- Instrument allowlisting
- Simulation risk + SL/TP validation
- Draft / intent persistence + lifecycle
- Future execution adapter **interface**
- Reconciliation, monitoring, audit, restart recovery
- Emergency locks + independent execution permissions

### Environment-specific (configuration + gates, not duplicate engines)

- Credential profiles (DEMO vs LIVE vaults)
- Expected account fingerprint allowlist
- Connection Demo/Real
- Release gates (`executionPermission` independently false for LIVE until owner release)
- Per-env persisted state + `environmentEpoch`
- Separate monitoring/audit streams keyed by environment

Supporting LIVE in architecture **does not** authorize LIVE execution.

---

## 11. Explicit owner decisions that remain unresolved

| ID | Topic | Status |
|----|-------|--------|
| OD-04 | Risk percentage | **Undecided** — must not invent |
| — | Max daily loss / exposure caps | Not decided |
| — | Order type / TIF for first DEMO tickets | Not decided; must be SDK-verified first |
| — | Whether SL/TP attach on entry vs separate orders | Not decided; must be SDK-verified |
| — | Account fingerprint allowlist for DEMO (and later LIVE) | Not decided |
| — | Exact installed SDK semver acceptance if probe stays `"installed"` | Needs owner-approved RO VPS introspection plan |
| OD-01…03, 05–11 | Confirmed in Phase 56.0 | Remains binding |

Do **not** treat proposed engineering defaults as approved.

---

## 12. Safe verification plans for unverified capabilities

All plans are **future, separately authorized**. None are executed in 56.1.

| Capability | Safe plan |
|------------|-----------|
| Exact `forexconnect` semver + package path | VPS RO: `pip show` / `pip freeze` in sidecar venv; no upgrade |
| SDK class/method inventory | VPS RO: `inspect` / `dir` on `ForexConnect`, table constants, order helpers; capture signatures only |
| Orders/Trades table RO | Implement sidecar GET readers; DEMO connect; read empty/non-empty without mutate |
| Min stop distance | Inspect TradingSettings / offer fields; map only named stop-distance APIs; never reuse CondDist as lotStep |
| Partial fills / TIF / attached SLTP | Authoritative Gehtsoft docs for **1.6.43** + DEMO RO observation after a **separately approved** demo order phase |
| LIVE parity | Only after LIVE credentials authorized for **read-only**; compare metadata; still no LIVE submit |
| Environment attestation | Capture connection label + account id fingerprint + login URL host; define mismatch fail-closed rules |

---

## 13. Phase 56.2 prerequisites and acceptance criteria

Phase 56.2 must **not** start automatically. Recommended scope (owner may revise): documentation/design → **simulation draft builder** only, still no broker submit.

### Prerequisites before 56.2 coding authorization

1. Owner review of this audit.
2. Confirm OD-04 remains undecided (simulation uses placeholders marked non-approved).
3. Agree XAU/USD quantity semantics investigation is in-scope for 56.2 **read-only** research, not invented constants.
4. Agree hard allowlist XAU/USD for drafts.
5. Agree no Orders mutate; optional RO Orders/Trades readers only if explicitly authorized.

### Suggested 56.2 acceptance criteria (draft-only)

- Draft schema + store with `environment`, `environmentEpoch`, analysis/decision links
- Simulation risk validator fail-closed when risk % undecided / contract unverified / SL or TP missing
- AT allowlist enforces XAU/USD
- Safety locks unchanged; still `placesOrders=false`
- Tests for fail-closed paths
- No broker order APIs added for submit

**Recommendation after this audit:** `READY_FOR_OWNER_REVIEW` (not `READY` to auto-start 56.2).

---

## 14. Limitations of the evidence collected

1. No interactive VPS shell package introspection this phase (semver string `"installed"`).
2. Public `GET /api/forex/providers/forexconnect/accounts` returns `NOT_FOUND` on production (`VERIFIED_INSTALLED_RUNTIME`) — route absent from `dev/server/forexconnect-api.ts` header inventory. Sidecar `/accounts` and Node client `getAccounts()` exist (`VERIFIED_SOURCE_CODE`). AT verification consumes accounts via the bridge, not the missing public route. Fresh DEMO balance/equity values were therefore not dumped via public HTTP in this phase. AT `/api/forex/automated-trading/status` requires admin auth (`httpOk: false` without token).
3. LIVE never probed (not configured; not authorized).
4. No SDK examples from other versions used as proof.
5. Heartbeat/CONNECTED ≠ fresh subscribed quotes (stream was `AUTHENTICATED_IDLE`, `subscriptionCount=0`).
6. Documentation-only change does not alter trading runtime behavior.

---

## 15. Actions intentionally not performed

- No FXCM DEMO or LIVE order create/modify/cancel/close
- No test orders
- No changes to master trading switch, emergency lock, `placesOrders`, `acceptsForExecution`
- No credential / account mode / env config changes
- No ForexConnect SDK install/upgrade/downgrade
- No application source code changes for this audit
- No database / broker state alterations
- No Phase 56.2 implementation
- No secrets printed

---

## 16. Final safety invariants checklist

| # | Invariant | Status |
|---|-----------|--------|
| 1 | No broker orders submitted | Confirmed — not attempted |
| 2 | No order/position mutations | Confirmed |
| 3 | No test orders | Confirmed |
| 4–5 | Master trading / emergency lock not changed by this phase | Confirmed (no config writes) |
| 6–9 | `placesOrders` / `acceptsForExecution` / execution-forbidden controls preserved | Confirmed in source; not altered |
| 10 | No credential/mode changes | Confirmed |
| 11 | No SDK install/upgrade | Confirmed |
| 12 | No app source changes for audit success | Confirmed — docs only |
| 13 | No DB/broker persistent trading state changes | Confirmed |
| 14 | No secrets in this report | Confirmed |
| 15 | No PASS without evidence | Applied via labels |
| 16 | Heartbeat ≠ fresh prices | Explicitly distinguished |
| 17 | AI / `ACCEPTED_FOR_REVIEW` ≠ execute | Affirmed |
| 18 | Timeout ≠ success/fail | Affirmed for future lifecycle |
| 19 | Phase 56.2 not started | Confirmed |
| 20 | No CI/CD / protection bypass | Confirmed |

---

## Appendix A — Key source paths

- `services/forexconnect-sidecar/server.py`
- `services/forexconnect-sidecar/requirements.txt`
- `deploy/provision-forexconnect.sh`
- `ai/market-data/forexconnect/client.ts`
- `ai/market-data/forexconnect/live-service.ts`
- `ai/market-data/forexconnect/session.ts` / `profiles.ts`
- `ai/forex-ai/automated-trading/**`
- `dev/server/forex-automated-trading-api.ts`
- `ai/forex-ai/position-sizing/contract-spec.ts`
- `docs/forex/PHASE_56_0_ARCHITECTURE_POLICY_DESIGN.md`
- `.github/workflows/production-deploy.yml`

## Appendix B — Production RO samples (sanitized)

**Instruments (DEMO):** count 516; metals category includes XAU/USD as above.
**Stream:** `streamState=AUTHENTICATED_IDLE`, `sessionStatus=CONNECTED`, `subscriptionCount=0`, `trading=DISABLED`.
**Status/probe:** CONNECTED, demo, trading DISABLED, sdkImportOk true, sdkVersionInstalled `"installed"`, Python 3.7.17.

---

*End of Phase 56.1 audit report.*
