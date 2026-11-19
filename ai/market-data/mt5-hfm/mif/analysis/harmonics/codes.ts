/**
 * Phase 5C Step 2 — harmonic pattern reason codes.
 */

export const MIF_HAR_POLICY_UNAVAILABLE = "POLICY_UNAVAILABLE" as const;
export const MIF_HAR_POLICY_INVALID = "POLICY_INVALID" as const;
export const MIF_HAR_QUALITY_MISSING = "QUALITY_MISSING" as const;
export const MIF_HAR_QUALITY_BLOCKED = "QUALITY_BLOCKED" as const;
export const MIF_HAR_QUALITY_DISALLOWS_CONFIRMED = "QUALITY_DISALLOWS_CONFIRMED" as const;
export const MIF_HAR_ADAPTER_BLOCKED = "ADAPTER_BLOCKED" as const;
export const MIF_HAR_INSUFFICIENT_SWINGS = "INSUFFICIENT_SWINGS" as const;
export const MIF_HAR_ATR_UNAVAILABLE = "ATR_UNAVAILABLE" as const;
export const MIF_HAR_NO_CANDIDATES = "NO_CANDIDATES" as const;
export const MIF_HAR_RATIO_REJECTED = "RATIO_REJECTED" as const;
export const MIF_HAR_OK = "OK" as const;

export type MifHarmonicReasonCode =
  | typeof MIF_HAR_POLICY_UNAVAILABLE
  | typeof MIF_HAR_POLICY_INVALID
  | typeof MIF_HAR_QUALITY_MISSING
  | typeof MIF_HAR_QUALITY_BLOCKED
  | typeof MIF_HAR_QUALITY_DISALLOWS_CONFIRMED
  | typeof MIF_HAR_ADAPTER_BLOCKED
  | typeof MIF_HAR_INSUFFICIENT_SWINGS
  | typeof MIF_HAR_ATR_UNAVAILABLE
  | typeof MIF_HAR_NO_CANDIDATES
  | typeof MIF_HAR_RATIO_REJECTED
  | typeof MIF_HAR_OK;
