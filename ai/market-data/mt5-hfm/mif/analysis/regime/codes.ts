/**
 * Phase 5C Step 2 — market regime reason codes.
 */

export const MIF_REG_POLICY_UNAVAILABLE = "POLICY_UNAVAILABLE" as const;
export const MIF_REG_POLICY_INVALID = "POLICY_INVALID" as const;
export const MIF_REG_QUALITY_MISSING = "QUALITY_MISSING" as const;
export const MIF_REG_QUALITY_BLOCKED = "QUALITY_BLOCKED" as const;
export const MIF_REG_ADAPTER_BLOCKED = "ADAPTER_BLOCKED" as const;
export const MIF_REG_INSUFFICIENT_HISTORY = "INSUFFICIENT_HISTORY" as const;
export const MIF_REG_ATR_UNAVAILABLE = "ATR_UNAVAILABLE" as const;
export const MIF_REG_CONFLICTING_EVIDENCE = "CONFLICTING_EVIDENCE" as const;
export const MIF_REG_OK = "OK" as const;

export type MifMarketRegimeReasonCode =
  | typeof MIF_REG_POLICY_UNAVAILABLE
  | typeof MIF_REG_POLICY_INVALID
  | typeof MIF_REG_QUALITY_MISSING
  | typeof MIF_REG_QUALITY_BLOCKED
  | typeof MIF_REG_ADAPTER_BLOCKED
  | typeof MIF_REG_INSUFFICIENT_HISTORY
  | typeof MIF_REG_ATR_UNAVAILABLE
  | typeof MIF_REG_CONFLICTING_EVIDENCE
  | typeof MIF_REG_OK;
