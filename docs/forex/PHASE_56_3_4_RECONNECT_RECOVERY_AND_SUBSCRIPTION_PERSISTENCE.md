# Phase 56.3.4 — Reconnect Recovery, Subscription Persistence & Restart Resilience

**Project:** KWIZERA AI STUDIO  
**Module:** ForexConnect market-data lifecycle (persistence + restart)  
**Document type:** Infrastructure hardening (market-data only)  
**Starting HEAD:** `daf27d19102d7ff47322b35aa156f12835dd780f` (matched production `verifiedLive=true`)  
**Phase 56.3.3 baseline:** `PASS_WITH_KNOWN_BLOCKERS`; in-memory intended only; no production disconnect cycle  
**Ending HEAD / deployed:** _(filled at ship)_  
**Scope:** Durable intended subscriptions + restart hydrate + reconnect restore. **No execution. Do not start 56.3.5 / 56.4.**

---

## 1. Baseline verification

| Item | Evidence |
|------|----------|
| Local / prod at start | `daf27d19…`, `verifiedLive=true`, healthy |
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
| Store | `data/forexconnect/intended-subscriptions.json` via existing `writeJsonAtomic` / `readJsonSafeSync` |
| Why not new DB | Matches profiles + analysis-snapshot filesystem pattern; no new service |
| Schema | `version: 1`, `schemaVersion: "56.3.4"`, `provider`, `environment`, `subscriptions[]` |
| Persisted fields | `providerSymbol`, `timeframe`, `rememberedAtMs`, optional `canonicalSymbol` |
| Never persisted | Credentials, tokens, quotes, bid/ask, order state |
| Validation | Safe symbol chars, supported project timeframes, env match, catalog membership when Offers list available, dedupe, max 32 |
| Failure | Corrupt → quarantine/fallback empty; mismatch → skip; errors exposed in `lifecycle.persistence` |
| LIVE gate | Unchanged — hydrate only fills intent; LIVE still needs genuine Offers price changes |

---

## 4. Reconnect / restore flow

```
DISCONNECT → markAllSessionsDisconnected (stale) → intended preserved (+ persisted)
CONNECTED  → hydratePersistedIntended → restoreIntendedSubscriptions (single-flight, max 3)
ensure()   → SUBSCRIBED_WAITING / seeded — NOT LIVE until genuine tick
```

Env switch (`clearIntended`) clears Map **and** durable store.

---

## 5. Tests (synthetic)

| Suite | Result |
|-------|--------|
| `phase56-3-4-persistence-and-restart.test.ts` | _(filled)_ |
| 56.3.1–56.3.3 regressions | _(filled)_ |

**Label:** synthetic/unit only.

---

## 6. Production observations

_(Filled after deploy — RO probes for lifecycle.persistence; authorized disconnect BLOCKED unless available.)_

---

## 7. Safety locks

| Lock | Required | Observed |
|------|----------|----------|
| masterTradingEnabled | false | Unchanged |
| emergencyEntryLock | true | Unchanged |
| placesOrders | false | Lifecycle + restore APIs |
| acceptsForExecution | false | Same |
| EXECUTION_FORBIDDEN | yes | Unchanged |
| FC trading DISABLED | yes | Unchanged |
| Allowlist XAU-only | yes | Unchanged |

---

## 8. Known blockers

1. Authorized production disconnect→reconnect→LIVE cycle still **BLOCKED** without safe admin disconnect.  
2. Quantity / CondDist / FX draft gates from 56.2.x remain.  
3. Persistence unavailable → fail-safe empty intent (clients must re-`ensure`).  
4. **Do not start 56.3.5 / 56.4 without owner approval.**

---

## 9. Verdict

**`PASS_WITH_KNOWN_BLOCKERS`** — durable intent + restart hydrate shipped with synthetic coverage; full production disconnect cycle not induced.

*End of Phase 56.3.4 record. STOP.*
