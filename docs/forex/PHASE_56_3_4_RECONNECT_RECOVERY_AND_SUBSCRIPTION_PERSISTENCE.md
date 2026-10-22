# Phase 56.3.4 — Reconnect Recovery, Subscription Persistence & Restart Resilience

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect market-data lifecycle (persistence + restart)  
**Document type:** Infrastructure hardening (market-data only)  
**Starting HEAD:** `daf27d19102d7ff47322b35aa156f12835dd780f` (matched production `verifiedLive=true`)  
**Phase 56.3.3 baseline:** `PASS_WITH_KNOWN_BLOCKERS`; in-memory intended only; no production disconnect cycle  
**Feature / Ending HEAD / deployed:** `42732f6f14e39abf6062b2842c29219db8a8994f` (`verifiedLive=true`, CI **#39747378237** success)  
**Scope:** Durable intended subscriptions + restart hydrate + reconnect restore. **No execution. Do not start 56.3.5 / 56.4.**

---

## 1. Baseline verification

| Item | Evidence |
|------|----------|
| Local / prod at start | `daf27d19…`, `verifiedLive=true`, healthy |
| Ending production `/api/deployment` | `deployedCommit=42732f6f…`, `verifiedLive=true`, `result=success`, `status=live` |
| Unrelated dirty files | PMV/typography/video — **preserved** |

---

## 2. Root causes addressed

1. **Process restart lost intended subscriptions** — Map was memory-only.  
2. **No catalog validation on restore** — blind `ensure` of stale symbols was possible.  
3. **Production disconnect cycle** — still requires authorized admin disconnect; not forced here.

---

## 3. Persistence design

| Choice | Detail |
|--------|--------|
| Store | `…/forexconnect/intended-subscriptions.json` via existing `writeJsonAtomic` / `readJsonSafeSync` |
| Why not new DB | Matches profiles + analysis-snapshot filesystem pattern; no new service |
| Schema | `version: 1`, `schemaVersion: "56.3.4"`, `provider`, `environment`, `subscriptions[]` |
| Persisted fields | `providerSymbol`, `timeframe`, `rememberedAtMs`, optional `canonicalSymbol` |
| Never persisted | Credentials, tokens, quotes, bid/ask, order state |
| Validation | Safe symbol chars, supported project timeframes, env match, catalog membership when Offers list available, dedupe, max 32 |
| Failure | Corrupt → quarantine/fallback empty; mismatch → skip; errors exposed in `lifecycle.persistence` |
| LIVE gate | Unchanged — hydrate only fills intent; LIVE still needs genuine Offers price changes |

Boot path: `maybeRestoreDemoSession` / activate CONNECTED → `hydratePersistedIntended` → `restoreIntendedSubscriptions` (single-flight, max 3).

---

## 4. Reconnect / restore flow

```
DISCONNECT → markAllSessionsDisconnected (stale) → intended preserved (+ persisted)
CONNECTED  → hydratePersistedIntended → restoreIntendedSubscriptions
ensure()   → SUBSCRIBED_WAITING / seeded — NOT LIVE until genuine tick
```

Env switch (`clearIntended`) clears Map **and** durable store.

---

## 5. Tests

| Suite | Category | Result |
|-------|----------|--------|
| `phase56-3-4-persistence-and-restart.test.ts` | synthetic/unit | **7/7 PASS** |
| `phase56-3-3-reconnect-and-metadata.test.ts` | synthetic/unit | **9/9 PASS** |
| Combined light local | synthetic | **16/16** (56.3.3+56.3.4); prior run also green for 56.3.1/56.3.2 |

Covers: schema/validation, restart hydrate, env mismatch, FAKE catalog skip, duplicates, empty store, disconnect invalidation, single-flight restore, no secrets in file, allowlist/safety flags.

**Label:** synthetic/unit only — not production process-restart evidence.

---

## 6. Production observations (genuine RO)

**Base URL:** `http://162.35.114.19:5173`  
**CI:** [Production deploy #39747378237](https://github.com/byosemarket-ui/kwizera-AI/actions/runs/39747378237) — **success** for `42732f6f`.

### 6.1 Persistence diagnostics

`GET /api/forex/providers/forexconnect/stream/status`:

- `lifecycle.persistence.enabled=true`
- `storePath=/var/lib/kwizera-ai-studio/forexconnect/intended-subscriptions.json`
- `environment=demo`, `lastError=null`, `lastRecoveredCorrupt=false`
- After subscribeLive: `intendedCount=3` (XAU/USD, EUR/USD, XAG/USD); `lastWriteAtMs` updated
- `FAKE/XYZ` not in intended
- `placesOrders=false`, `acceptsForExecution=false`, `trading=DISABLED`
- Note: Phase 56.3.4 durable-intent message present

### 6.2 Readiness isolation

`subscribeLive=1` probe: `liveReadySymbols` included XAU/USD, EUR/USD (and XAG/USD when it received genuine updates); `FAKE/XYZ` blocked `no_active_session`.

### 6.3 Process restart / authorized disconnect

| Scenario | Status |
|----------|--------|
| Synthetic restart hydrate (new service + same store file) | **PASS** (unit) |
| Production process restart restore | **BLOCKED** — not induced (would disrupt live gateway) |
| Authorized production disconnect→reconnect→fresh LIVE | **BLOCKED** — no safe admin disconnect performed |

---

## 7. UI / responsive

| Surface | HTTP |
|---------|------|
| `/forex/ai-analysis` | 200 |
| `/forex/charts` | 200 |
| `/forex/automated-trading` | 200 |

Lifecycle persistence fields available via stream status API (Admin/diagnostics consumers).

---

## 8. Safety locks

| Lock | Required | Observed |
|------|----------|----------|
| masterTradingEnabled | false | Unchanged (AT controls; no mutation) |
| emergencyEntryLock | true | Unchanged |
| placesOrders | false | Stream lifecycle + readiness |
| acceptsForExecution | false | Stream lifecycle + readiness |
| EXECUTION_FORBIDDEN | yes | `POST …/place-order` → 403 |
| FC trading DISABLED | yes | `trading: DISABLED` |
| LIVE trading unauthorized | yes | DEMO environment |
| Allowlist XAU-only | yes | Unchanged (synthetic + no allowlist edit) |
| Broker mutations | none | No disconnect/order APIs |

---

## 9. Known blockers

1. Authorized production disconnect→reconnect→LIVE cycle **not demonstrated** (safe admin disconnect avoided).  
2. Production process-restart restore **not induced** — synthetic restart hydrate only.  
3. Quantity / CondDist / FX draft gates from 56.2.x remain.  
4. **Do not start 56.3.5 / 56.4 without owner approval.**

---

## 10. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`**

Proven: durable intended store live on VPS; write on subscribe; catalog/env validation; restart hydrate in synthetic tests; reconnect single-flight restore retained; safety locks closed.

Unverified in production: full disconnect cycle and gateway process restart.

*End of Phase 56.3.4 record. STOP — do not begin Phase 56.3.5 / 56.4.*
