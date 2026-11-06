# Stage 4 — Risk Limits Configuration, Approval & Administration

**Status:** Implemented (propose ≠ approve; fail-closed; no broker mutation)  
**Module:** `ai/forex-ai/automated-trading/risk-policy/` (extended Stage 3)  
**Stage id:** `STAGE_4_RISK_LIMITS_CONFIGURATION_APPROVAL`  
**Schema:** `kwizera.at-risk-policy.v1` (backward-compatible migration)

---

## 1. Mission

Secure, auditable, instrument-specific configuration and **explicit approval** for spread/slippage limits — without inventing or auto-selecting numeric thresholds.

Safety stamps unchanged: `placesOrders=false`, `acceptsForExecution=false`, `mutatesBroker=false`, Execution Master OFF, Emergency Lock ON, owner max `0.01` lots.

---

## 2. Configuration schema and units

| Field | Meaning |
|-------|---------|
| `maxSpreadAbsolute` | Active **approved** absolute bid–ask spread (price units) |
| `maxSlippageAbsolute` | Active **approved** absolute \|entry−executable\| (BUY→ask, SELL→bid) |
| `proposed` | Pending value (not used by precheck) |
| `approvalState` | `NOT_CONFIGURED` \| `PENDING_APPROVAL` \| `APPROVED` \| `REJECTED` \| `INVALID` |
| `status` | Resolve status: `VERIFIED` only when APPROVED |
| `configVersion` | Per-limit revision counter |
| Document `version` | Optimistic concurrency for mutations |

### Instruments and precision guidance (display/docs only — not invented limits)

| Instrument | Documented price precision |
|------------|----------------------------|
| EUR/USD | 5 |
| GBP/USD | 5 |
| USD/JPY | 3 |
| XAU/USD | 2 |

Units: **absolute_price** (same scale as live bid/ask).

---

## 3. Approval workflow

1. **Propose** — validates positive finite number; stores `proposed`; sets `PENDING_APPROVAL`; **does not** change active approved value.
2. **Approve** — requires `confirm=true`; copies proposed → active; stamps `approvedBy` / `approvedAtUtc` / `effectiveAtUtc`; pushes prior active into `history`; bumps `configVersion`.
3. **Reject** — clears proposed; keeps prior APPROVED active if any; otherwise `REJECTED`.
4. **Rollback** — restores last entry from `history` as active APPROVED.
5. **Clear** — clears active + proposed → `NOT_CONFIGURED`.

Version conflicts: optional `expectedVersion` must match document `version` or → `VERSION_CONFLICT` (HTTP 409).

Authorization: existing Forex Admin (`requireForexAdmin` / admin API token). There is **no separate owner principal** in code — approval is an explicit audited action under the same admin boundary (`confirm=true` required). Actor string is recorded (e.g. `forex-admin-ui`, `admin-api`).

---

## 4. API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/forex/automated-trading/risk-policy` | Current document |
| GET | `/api/forex/automated-trading/risk-policy/history` | Audit trail |
| POST/PUT/PATCH | `/api/forex/automated-trading/risk-policy` | `{ instrument, kind, action, value?, confirm?, expectedVersion?, … }` |

Actions: `propose` \| `approve` \| `reject` \| `rollback` \| `clear`.  
Approve without `confirm=true` → `CONFIRMATION_REQUIRED`.  
Submitting a body alone never auto-approves.

---

## 5. Admin UI

`/admin/forex/settings` → `ForexAdminAtRiskLimitsPanel` (sibling of position-sizing panel).

Shows all four instruments, proposed vs active, approval badges, propose/approve/reject/rollback/clear, recent audit. Explicit confirm dialog before approve. No execution controls.

---

## 6. Precheck integration

`resolveSpreadLimit` / `resolveSlippageLimit` use **only APPROVED** active values (or request/env override).  
Pending / rejected / invalid → fail-closed (`NOT_CONFIGURED` / `INVALID`).  
Existing Phase 2 spread/slippage checks preserved; Execution Master / Emergency Lock unchanged.

---

## 7. Remaining owner decisions

Approve concrete absolute values per instrument for spread and slippage (do not derive from live spreads). Until then precheck remains blocked on those gates.
