/**
 * Phase 44 — Snapshot-bound trade plans (Pullback + Breakout) per AI provider.
 * Deterministic structure; never fabricates prices or confidence percentages.
 */

export const SNAPSHOT_TRADE_PLANS_SCHEMA = "forex-snapshot-trade-plans-v1";

export type SnapshotMarketDirection =
  | "BULLISH"
  | "BEARISH"
  | "SIDEWAYS"
  | "UNCERTAIN";

export type SnapshotPlanKind = "PULLBACK" | "BREAKOUT";

export type SnapshotPlanIntent = "BUY" | "SELL" | "WAIT" | "UNSUITABLE";

export type SnapshotPlanLifecycle =
  | "PLAN_CREATED"
  | "ENTRY_ZONE_REACHED"
  | "CONFIRMATION_PENDING"
  | "SETUP_CONFIRMED"
  | "INVALIDATED"
  | "EXPIRED"
  | "WAIT_CONFLICT";

export type SnapshotComparisonVerdict =
  | "AGREEMENT"
  | "PARTIAL_AGREEMENT"
  | "CONFLICT"
  | "INSUFFICIENT_DATA";

export interface SnapshotStructureEvidenceSummary {
  trendState: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN" | null;
  lastSwingHigh: number | null;
  lastSwingLow: number | null;
  events: Array<{
    type: "BOS" | "CHOCH";
    direction: "BULLISH" | "BEARISH";
    status: string;
    level: number | null;
  }>;
  zones: Array<{
    side: "SUPPORT" | "RESISTANCE" | "PIVOT";
    low: number;
    high: number;
    status: string;
  }>;
  patterns: Array<{
    name: string;
    direction: string;
    status: string;
  }>;
  warnings: string[];
  insufficientHistory: boolean;
  quoteFreshness: string | null;
  dataUsable: boolean;
}

export interface SnapshotPriceZone {
  lower: number | null;
  upper: number | null;
  reference: number | null;
  rationale: string;
  unavailableReason: string | null;
}

export interface SnapshotTradePlan {
  schemaVersion: typeof SNAPSHOT_TRADE_PLANS_SCHEMA;
  planId: string;
  planKind: SnapshotPlanKind;
  version: 1;
  analysisProvider: "LOCAL" | "OPENAI";
  analysisId: string;
  snapshotId: string;
  contentFingerprint: string;
  instrument: string;
  candleTimeframe: string;
  analysisPeriod: string;
  marketDirection: SnapshotMarketDirection;
  intent: SnapshotPlanIntent;
  lifecycle: SnapshotPlanLifecycle;
  lifecycleNote: string;
  entryZone: SnapshotPriceZone;
  confirmationRequired: string[];
  confirmationStatus: "NOT_STARTED" | "PENDING" | "MET" | "NOT_MET" | "BLOCKED";
  stopLoss: {
    price: number | null;
    rationale: string;
    unavailableReason: string | null;
  };
  takeProfit: {
    prices: number[];
    rationale: string;
    unavailableReason: string | null;
  };
  invalidationConditions: string[];
  expiryConditions: string[];
  riskReward: {
    ratio: number | null;
    risk: number | null;
    reward: number | null;
    unavailableReason: string | null;
  };
  spreadNote: string | null;
  dataQualityLimitations: string[];
  unsuitableReasons: string[];
  createdAt: string;
}

export interface SnapshotPlanBundle {
  schemaVersion: typeof SNAPSHOT_TRADE_PLANS_SCHEMA;
  marketDirection: SnapshotMarketDirection;
  directionExplanation: string;
  directionMeaning: string;
  structureEvidence: SnapshotStructureEvidenceSummary;
  pullback: SnapshotTradePlan;
  breakout: SnapshotTradePlan;
  confidenceDisplay: string;
  createdAt: string;
}

export interface SnapshotPlanFieldConflict {
  field: string;
  localValue: string;
  openaiValue: string;
  material: boolean;
}

export interface SnapshotPlanComparison {
  verdict: SnapshotComparisonVerdict;
  directionAgree: boolean | null;
  pullbackConflict: boolean;
  breakoutConflict: boolean;
  conflicts: SnapshotPlanFieldConflict[];
  waitConflict: boolean;
  waitConflictReason: string | null;
  incomplete: boolean;
  note: string;
}
