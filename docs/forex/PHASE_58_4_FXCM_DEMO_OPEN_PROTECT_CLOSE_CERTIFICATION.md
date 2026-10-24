# Phase 58.4 — FXCM DEMO Open / Protect / Close Certification

**Date:** 2026-10-24  
**Module:** Automated Trading · FXCM ForexConnect DEMO lifecycle  
**Verdict:** `BLOCKED`

---

## 1. Executive summary

Phase 58.4 audited the real repository and deployed VPS against the Phase 58.3 baseline, then enforced mandatory safety gates **before** any broker mutation.

**No DEMO order was submitted.** Mutation was not attempted.

Primary blockers:

1. ForexConnect runtime reports `trading=DISABLED` (DEMO mutation flag still off).
2. Admin-gated DEMO lifecycle APIs return **HTTP 403** without an owner Admin API token (grant / readiness / open / close unreachable).
3. Enabling mutation and/or restarting the sidecar was **not authorized** in this phase.
4. Live quote stream shows `lastQuoteAt=null` / `subscriptionCount=0` (quote-freshness gate would also fail until an Offers subscription/quote is established).

Code revision `790b650a` (Phase 58.2–58.3) **is committed, pushed, and deployed**. Ordinary AT safety remains intact. LIVE remains locked.

---

## 2. Step 1 — Existing changes review

| Item | Result |
|------|--------|
| Local HEAD | `790b650ad03651680583cd0422bca9f994e3a6a6` (`790b650a`) |
| Message | `feat(forex): Phase 58.2-58.3 DEMO lifecycle protect, cancel, and preflight` |
| `origin/main` | Same SHA (ahead/behind `0/0`) |
| Working tree | Only unrelated AI/video/pmv edits dirty — **preserved, not committed** |
| Phase 58.0–58.3 AT files | Included in `790b650a` (17 files: demo-execution, sidecar, client, AT API/UI, docs, tests) |

No destructive Git operations. No unrelated commits.

---

## 3. Step 2 — Deployed environment (read-only)

| Check | Result | Evidence |
|-------|--------|----------|
| Deployed revision | `790b650ad03651680583cd0422bca9f994e3a6a6` | `/api/deployment` `verifiedLive=true` |
| Matches local/remote | **Yes** | Local HEAD = origin = deployed |
| FC session | `CONNECTED` | `/api/forex/providers/forexconnect/status` |
| Environment | `demo` / FXCM DEMO | status + profiles |
| DEMO credentials | configured (username hint only) | profiles.demo |
| LIVE credentials | **not configured** | profiles.live.configured=false |
| Trading / mutation surface | `DISABLED` | status.trading |
| Sidecar reachable | true | status |
| SDK | forexconnect **1.6.43** requested; import OK | runtimeProbe |
| Sidecar Python | **3.7.17** | runtimeProbe |
| Instruments | 516 | status |
| Quote stream | `lastQuoteAt=null`, subscriptions=0 | status |
| `/sdk-capabilities` via public FC path | **404** (not exposed on that URL) | probe |
| AT `demo-lifecycle/readiness` | **403** without admin token | probe |
| AT `demo-lifecycle/status` | **403** | probe |
| AT `broker-ro-tables` | **403** | probe |
| AT `status` | **403** | probe |
| Public FC accounts/trades paths tried | **404** | probe |

Secrets were not requested, printed, or logged.

---

## 4. Step 3 — Safety gates (pre-mutation)

| Gate | Status | Notes |
|------|--------|-------|
| Verified DEMO session | **PASS** | CONNECTED + environment demo |
| LIVE not usable | **PASS** | LIVE profile empty; no LIVE fallback observed |
| Deploy includes 58.2/58.3 code | **PASS** | SHA match |
| DEMO mutation enabled | **FAIL** | `trading=DISABLED` |
| Mutation secret configured (server-side) | **UNKNOWN** | Cannot inspect without admin/sidecar probe under auth |
| Time-bounded owner DEMO grant | **FAIL** | Cannot create/list — admin 403 |
| Risk / DEMO preflight | **NOT RUN** | Blocked before grant/mutation |
| Fresh quote | **FAIL / insufficient** | No live quote timestamp; no subscription |
| SL/TP broker verify path in code | **PRESENT in deploy** | Not exercised against broker |
| Exact position close capability in code | **PRESENT in deploy** | Not exercised |
| Master Trading OFF / Emergency lock / auto-entry off | **POLICY ASSUMED + AT disabled path** | Admin status 403; ordinary AT still disabled by design in committed code |
| No LIVE routing | **PASS (RO)** | LIVE unconfigured |

**Mandatory gate failure → stop before broker mutation.**

---

## 5. Steps 4–6 — Controlled open / protect / close

| Step | Result |
|------|--------|
| DEMO open submitted | **No** |
| Broker order ID | N/A |
| Fill / trade / position | N/A |
| Broker SL/TP confirmed | N/A |
| Close submitted | N/A |
| Close confirmed | N/A |
| Reconciliation | N/A |

No HTTP “success” was treated as broker evidence. No retries. No unrelated positions touched.

---

## 6. Step 7 — Cleanup and safety restoration

| Action | Result |
|--------|--------|
| Outstanding test orders/positions from this phase | **None created** |
| Disable DEMO mutation | Already disabled (`trading=DISABLED`) — left disabled |
| Revoke temporary grant | **None created** |
| LIVE locked | **Yes** (unconfigured) |
| Global execution safety | Mutation not enabled; no bypass performed |
| Unresolved broker uncertainty from this test | **None** (no mutation) |

---

## 7. Local tests performed

```text
Command:
  .\node_modules\.bin\vitest.cmd run
    tests/unit/ai/forex-ai/phase58-2-demo-protection-and-lifecycle.test.ts
    tests/unit/ai/forex-ai/phase58-3-complete-audit-and-lifecycle.test.ts
    --pool=forks --maxWorkers=1 --reporter=dot
Environment: local
Revision: 790b650a (+ unrelated dirty AI/video files preserved)
Type: unit / wiring (not broker mutation)
Exit: 0 — 2 files, 18 tests passed
```

These tests do **not** certify broker execution.

---

## 8. Explicit certification answers

| Question | Answer |
|----------|--------|
| Did a real DEMO order reach FXCM? | **No** |
| Did FXCM acknowledge it? | N/A |
| Was it filled? | N/A |
| Broker order/trade IDs? | N/A |
| Position visible at broker? | N/A |
| Required SL/TP confirmed at broker? | **Not verified** |
| Close reached broker? | N/A |
| Broker confirmed close? | N/A |
| Final position closed? | N/A |
| Internal state matched broker? | N/A |
| Deploy/restart performed this phase? | **No** (already on `790b650a`) |
| Tests skipped/blocked? | **Actual broker lifecycle blocked** by mutation-off + missing admin grant auth + quote/subscription gap |

---

## 9. Remaining blockers (exact)

1. **Owner Admin API token** required for `demo-lifecycle/*` (grant, readiness, open, close).
2. **Enable** `KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1` and configure shared mutation secret on app + sidecar **without exposing values**.
3. **Explicit authorization** to restart/reload ForexConnect sidecar if env change requires it (not performed).
4. Create a **short-TTL DEMO grant** (e.g. `maxLots=1`, allowlisted instrument).
5. Establish **fresh Offers quote** for the test instrument (subscribe / confirm bid-ask).
6. Authorize **one** controlled lifecycle: open with `requireProtective=true` + absolute SL/TP → reconcile protection → close exact `tradeId` → revoke grant → set mutation flag back to off.

---

## 10. Exact next owner action

Provide (out of band, not in chat if sensitive):

1. Admin token for DEMO lifecycle APIs **or** run the grant/open/close yourself after enabling mutation.  
2. Explicit approval to set DEMO mutation env + restart sidecar if needed.  
3. Confirmation of the intended DEMO instrument for the single minimum-lot test.

Until then, Phase 58.4 remains **BLOCKED** at the safety gate — by design.

---

## 11. Final stop

- LIVE remains locked.  
- DEMO mutation remains disabled.  
- No broker order submitted.  
- No general Master Trading / automatic entry enabled.  
- Unrelated working-tree AI/video changes preserved.  
- Phase 58.4 **stops** after this report. Phase 58.5+ not started.

**Verdict: `BLOCKED`** — deployed code is ready at `790b650a`, but mandatory DEMO mutation authorization, admin grant access, and quote readiness were not available; certification correctly refused to mutate.
