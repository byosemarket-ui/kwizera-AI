/**
 * HFM directional evidence fusion types.
 * Primary market direction is always BUY | SELL — never WAITING.
 * Conviction is analytical, not win probability / trade authorization.
 */

export type HfmMarketDirection = "BUY" | "SELL";

export type HfmConvictionLabel =
  | "MINIMAL"
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "VERY_HIGH";

export type HfmConflictKind =
  | "AGREEMENT"
  | "GENUINE_CONFLICT"
  | "DIFFERENT_TIMEFRAME"
  | "DIFFERENT_METHODOLOGY"
  | "INSUFFICIENT_DATA"
  | "STALE_DATA"
  | "CALCULATION_ERROR";

export type HfmEvidenceFamily =
  | "STRUCTURE_TREND"
  | "REGIME"
  | "MOMENTUM"
  | "OPPORTUNITY"
  | "SCENARIO"
  | "DTI"
  | "MTF_ALIGNMENT"
  | "LIQUIDITY"
  | "PATTERNS"
  | "DATA_QUALITY";

export interface HfmDirectionalEvidenceAtom {
  engineId: string;
  family: HfmEvidenceFamily;
  side: HfmMarketDirection | "NONE";
  rawWeight: number;
  qualityFactor: number;
  freshnessFactor: number;
  confirmationFactor: number;
  formingOnly: boolean;
  note: string;
}

export interface HfmDirectionalConvictionResult {
  direction: HfmMarketDirection;
  directionalConvictionScore: number;
  convictionLabel: HfmConvictionLabel;
  bullishEvidenceScore: number;
  bearishEvidenceScore: number;
  evidenceCompleteness: number;
  dataQuality: number;
  conflictSeverity: number;
  conflictKind: HfmConflictKind;
  supportingEngineIds: string[];
  contradictingEngineIds: string[];
  keyEvidence: string[];
  knownLimitations: string[];
  calculationVersion: string;
  tieBreakApplied: boolean;
  tieBreakReason: string | null;
  /** Explicit: not a win probability and not execution authorization. */
  scoreSemantics: "ANALYTICAL_DIRECTIONAL_CONVICTION_NOT_WIN_PROBABILITY";
  executionAuthorizationImplied: false;
}

export interface HfmDirectionalFusionPackage {
  contractId: string;
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  symbol: string;
  timeframe: string;
  generatedAt: string;
  conviction: HfmDirectionalConvictionResult;
  atoms: HfmDirectionalEvidenceAtom[];
  familyCapsApplied: Record<string, number>;
}
