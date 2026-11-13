/**
 * XAU/USD Automated Trading — owner-approved account-balance risk policy.
 *
 * Risk basis: live verified FXCM account BALANCE (never equity, margin, allocation, or a fixture).
 * 25% is a pre-entry modeled Stop Loss ceiling — not a target, not a hard realized-loss cap,
 * and never an authorization for broker close/modify commands.
 */

export const XAU_ACCOUNT_RISK_POLICY_ID = "XAU_ACCOUNT_BALANCE_25PCT_NET3R" as const;
export const XAU_ACCOUNT_RISK_POLICY_VERSION = "xau-account-balance-risk-v1" as const;

export type AtRiskBasis = "INDIVIDUAL_ORDER_ALLOCATION" | "ACCOUNT_BALANCE";

/** Maximum modeled Stop Loss loss as a fraction of the captured account balance. */
export const XAU_ACCOUNT_RISK_FRACTION = 0.25;
export const XAU_ACCOUNT_RISK_PERCENT = 25;

/** Minimum NET reward/risk after verified costs. 2.99 fails. */
export const XAU_MIN_NET_REWARD_RISK = 3;

/** Balance freshness ceiling measured against the clock at capture (not a provider flag). */
export const XAU_ACCOUNT_BALANCE_MAX_AGE_MS = 60_000;

/** Balance equality tolerance (account currency) when checking snapshot validity. */
export const XAU_ACCOUNT_BALANCE_CHANGE_TOLERANCE = 1e-6;

export type AccountRiskBlockCode =
  | "ACCOUNT_BALANCE_UNAVAILABLE"
  | "ACCOUNT_BALANCE_STALE"
  | "ACCOUNT_BALANCE_INVALID"
  | "ACCOUNT_CURRENCY_UNKNOWN"
  | "ACCOUNT_IDENTITY_UNVERIFIED"
  | "ACCOUNT_SNAPSHOT_TIMESTAMP_MISSING";

export type RiskSnapshotValidity =
  | "VALID"
  | "EXPIRED_ACCOUNT_CHANGED"
  | "EXPIRED_BALANCE_CHANGED"
  | "CURRENT_ACCOUNT_UNAVAILABLE";

/** Quote currency of an `AAA/BBB` symbol — the instrument's profit/loss currency. */
export function instrumentProfitCurrency(symbol: string | null | undefined): string | null {
  const s = String(symbol ?? "").trim().toUpperCase();
  const parts = s.split("/");
  if (parts.length !== 2) return null;
  const q = parts[1].replace(/[^A-Z]/g, "");
  return q.length === 3 ? q : null;
}
