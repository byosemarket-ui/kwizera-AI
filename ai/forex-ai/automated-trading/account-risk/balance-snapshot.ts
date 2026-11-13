/**
 * Immutable FXCM account-balance risk snapshot for one XAU/USD proposal.
 * Captured once; a later balance/account change expires the proposal instead of
 * silently re-budgeting it. Read-only — never touches the broker.
 */
import { createHash } from "node:crypto";
import {
  XAU_ACCOUNT_BALANCE_CHANGE_TOLERANCE,
  XAU_ACCOUNT_BALANCE_MAX_AGE_MS,
  XAU_ACCOUNT_RISK_FRACTION,
  XAU_ACCOUNT_RISK_PERCENT,
  XAU_ACCOUNT_RISK_POLICY_ID,
  XAU_ACCOUNT_RISK_POLICY_VERSION,
  type AccountRiskBlockCode,
  type RiskSnapshotValidity,
} from "./policy.js";

export interface AccountBalanceRiskSnapshot {
  snapshotId: string;
  policyId: typeof XAU_ACCOUNT_RISK_POLICY_ID;
  policyVersion: typeof XAU_ACCOUNT_RISK_POLICY_VERSION;
  riskBasis: "ACCOUNT_BALANCE";
  accountIdMasked: string | null;
  /** sha256 prefix of the raw bound account id — raw id is never persisted. */
  accountBindingHash: string;
  environment: string | null;
  balance: number;
  accountCurrency: string;
  balanceTimestampUtc: string;
  balanceAgeMsAtCapture: number;
  provider: "FOREXCONNECT";
  source: "Accounts.balance";
  riskPercent: typeof XAU_ACCOUNT_RISK_PERCENT;
  riskFraction: typeof XAU_ACCOUNT_RISK_FRACTION;
  maximumRiskAccountCurrency: number;
  quote: { bid: number | null; ask: number | null; timestampUtc: string | null } | null;
  contract: {
    offerId: string | null;
    source: string | null;
    baseUnitSize: number | null;
    quantityMin: number | null;
    quantityStep: number | null;
    pointSize: number | null;
    identity: string;
  } | null;
  capturedAtUtc: string;
}

export interface CaptureAccountBalanceRiskInput {
  account: {
    accountIdMasked?: string | null;
    accountCurrency?: string | null;
    balance?: number | null;
    fetchedAtUtc?: string | null;
    fields?: { balance?: boolean; accountCurrency?: boolean } | null;
  } | null | undefined;
  /** Raw account id the connected XAU/USD session is bound to. */
  accountId: string | null | undefined;
  identityVerified: boolean;
  environment?: string | null;
  quote?: { bid?: number | null; ask?: number | null; timestampMs?: number | null } | null;
  contract?: {
    offerId?: string | null;
    source?: string | null;
    baseUnitSize?: number | null;
    quantityMin?: number | null;
    quantityStep?: number | null;
    pointSize?: number | null;
  } | null;
  nowMs?: number;
  maxAgeMs?: number;
}

export type CaptureAccountBalanceRiskResult =
  | { ok: true; snapshot: AccountBalanceRiskSnapshot }
  | { ok: false; code: AccountRiskBlockCode; message: string };

export function accountBindingHash(accountId: string): string {
  return createHash("sha256").update(`fxcm-account:${accountId}`).digest("hex").slice(0, 24);
}

function finiteOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function captureAccountBalanceRiskSnapshot(
  input: CaptureAccountBalanceRiskInput,
): CaptureAccountBalanceRiskResult {
  const nowMs = input.nowMs ?? Date.now();
  const maxAgeMs = input.maxAgeMs ?? XAU_ACCOUNT_BALANCE_MAX_AGE_MS;
  const acct = input.account ?? null;
  const rawId = String(input.accountId ?? "").trim();

  if (!acct || !rawId || !input.identityVerified) {
    return {
      ok: false,
      code: "ACCOUNT_IDENTITY_UNVERIFIED",
      message: "Connected FXCM account identity is not verified — balance risk basis unavailable.",
    };
  }
  const balanceKnown = acct.fields?.balance !== false;
  const balance = finiteOrNull(acct.balance);
  if (!balanceKnown || balance == null) {
    return {
      ok: false,
      code: "ACCOUNT_BALANCE_UNAVAILABLE",
      message: "FXCM account balance is unavailable — equity/margin/allocation are not substituted.",
    };
  }
  if (!(balance > 0)) {
    return {
      ok: false,
      code: "ACCOUNT_BALANCE_INVALID",
      message: `FXCM account balance ${balance} is not positive — no risk budget.`,
    };
  }
  const ccy = String(acct.accountCurrency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(ccy) || acct.fields?.accountCurrency === false) {
    return {
      ok: false,
      code: "ACCOUNT_CURRENCY_UNKNOWN",
      message: "FXCM account currency is unknown — USD is never assumed.",
    };
  }
  const fetchedMs = acct.fetchedAtUtc ? Date.parse(acct.fetchedAtUtc) : NaN;
  if (!Number.isFinite(fetchedMs)) {
    return {
      ok: false,
      code: "ACCOUNT_SNAPSHOT_TIMESTAMP_MISSING",
      message: "FXCM account balance has no provider timestamp — freshness unprovable.",
    };
  }
  const ageMs = Math.max(0, nowMs - fetchedMs);
  if (ageMs > maxAgeMs) {
    return {
      ok: false,
      code: "ACCOUNT_BALANCE_STALE",
      message: `FXCM account balance is ${ageMs}ms old (max ${maxAgeMs}ms) — refresh required.`,
    };
  }

  const maximumRisk = balance * XAU_ACCOUNT_RISK_FRACTION;
  const binding = accountBindingHash(rawId);
  const c = input.contract ?? null;
  const contract = c
    ? {
      offerId: c.offerId != null ? String(c.offerId) : null,
      source: c.source ?? null,
      baseUnitSize: finiteOrNull(c.baseUnitSize),
      quantityMin: finiteOrNull(c.quantityMin),
      quantityStep: finiteOrNull(c.quantityStep),
      pointSize: finiteOrNull(c.pointSize),
      identity: "",
    }
    : null;
  if (contract) {
    contract.identity = createHash("sha256")
      .update(JSON.stringify([
        contract.offerId,
        contract.source,
        contract.baseUnitSize,
        contract.quantityMin,
        contract.quantityStep,
        contract.pointSize,
      ]))
      .digest("hex")
      .slice(0, 16);
  }
  const q = input.quote ?? null;
  const quote = q
    ? {
      bid: finiteOrNull(q.bid),
      ask: finiteOrNull(q.ask),
      timestampUtc: finiteOrNull(q.timestampMs) != null ? new Date(q.timestampMs as number).toISOString() : null,
    }
    : null;
  const capturedAtUtc = new Date(nowMs).toISOString();
  const balanceTimestampUtc = new Date(fetchedMs).toISOString();
  const snapshotId = createHash("sha256")
    .update(JSON.stringify([binding, balance, ccy, balanceTimestampUtc, XAU_ACCOUNT_RISK_POLICY_VERSION, contract?.identity ?? null]))
    .digest("hex")
    .slice(0, 24);

  return {
    ok: true,
    snapshot: {
      snapshotId,
      policyId: XAU_ACCOUNT_RISK_POLICY_ID,
      policyVersion: XAU_ACCOUNT_RISK_POLICY_VERSION,
      riskBasis: "ACCOUNT_BALANCE",
      accountIdMasked: acct.accountIdMasked ?? null,
      accountBindingHash: binding,
      environment: input.environment ?? null,
      balance,
      accountCurrency: ccy,
      balanceTimestampUtc,
      balanceAgeMsAtCapture: ageMs,
      provider: "FOREXCONNECT",
      source: "Accounts.balance",
      riskPercent: XAU_ACCOUNT_RISK_PERCENT,
      riskFraction: XAU_ACCOUNT_RISK_FRACTION,
      maximumRiskAccountCurrency: maximumRisk,
      quote,
      contract,
      capturedAtUtc,
    },
  };
}

/**
 * Compare a captured snapshot with the currently connected account.
 * Any account or balance change expires the proposal — it must be recalculated.
 */
export function evaluateRiskSnapshotValidity(
  snapshot: Pick<AccountBalanceRiskSnapshot, "accountBindingHash" | "accountIdMasked" | "balance">,
  current: {
    accountId?: string | null;
    accountIdMasked?: string | null;
    balance?: number | null;
  } | null | undefined,
): RiskSnapshotValidity {
  if (!current) return "CURRENT_ACCOUNT_UNAVAILABLE";
  const rawId = String(current.accountId ?? "").trim();
  if (rawId) {
    if (accountBindingHash(rawId) !== snapshot.accountBindingHash) return "EXPIRED_ACCOUNT_CHANGED";
  } else if (current.accountIdMasked && snapshot.accountIdMasked) {
    if (current.accountIdMasked !== snapshot.accountIdMasked) return "EXPIRED_ACCOUNT_CHANGED";
  } else {
    return "CURRENT_ACCOUNT_UNAVAILABLE";
  }
  const bal = finiteOrNull(current.balance);
  if (bal == null) return "CURRENT_ACCOUNT_UNAVAILABLE";
  if (Math.abs(bal - snapshot.balance) > XAU_ACCOUNT_BALANCE_CHANGE_TOLERANCE) return "EXPIRED_BALANCE_CHANGED";
  return "VALID";
}
