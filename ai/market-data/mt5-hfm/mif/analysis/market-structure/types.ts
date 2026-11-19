/**
 * Phase 5D.6 — Market Structure Assessment types.
 * Wraps forex-structure swings/events without look-ahead or fabrication.
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type {
  MIF_MARKET_STRUCTURE_CONTRACT_ID,
  MIF_MARKET_STRUCTURE_CONTRACT_VERSION,
} from "./contracts.js";

export type MifMarketStructureStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export type MifStructureBias =
  | "BULLISH"
  | "BEARISH"
  | "RANGING"
  | "TRANSITION"
  | "UNKNOWN";

export interface MifStructureSwingRef {
  swingId: string;
  kind: "HIGH" | "LOW";
  status: "CONFIRMED" | "PROVISIONAL" | "UNCONFIRMED";
  price: number;
  openTimeSec: number;
  candleIndex: number;
  classification: "HH" | "HL" | "LH" | "LL" | "EQUAL_HIGH" | "EQUAL_LOW" | null;
  priorSwingId: string | null;
}

export interface MifStructureEventRef {
  eventId: string;
  eventKey: string;
  type: "BOS" | "CHOCH";
  direction: "BULLISH" | "BEARISH";
  status: "CONFIRMED" | "CANDIDATE";
  priceLevel: number;
  priorLevelSwingId: string | null;
  breakOpenTimeSec: number;
  breakCandleIndex: number;
}

export interface MifMarketStructureAssessment extends MifSafetyFlags {
  contractId: typeof MIF_MARKET_STRUCTURE_CONTRACT_ID;
  contractVersion: typeof MIF_MARKET_STRUCTURE_CONTRACT_VERSION;
  scope: "phase5d6-market-structure";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifMarketStructureStatus;
  bias: MifStructureBias;
  confirmedSwingCount: number;
  provisionalSwingCount: number;
  swings: readonly MifStructureSwingRef[];
  events: readonly MifStructureEventRef[];
  /** Primary structure reference for detectors (latest confirmed swing). */
  primaryRef: {
    refId: string;
    refType: "SWING_HIGH" | "SWING_LOW";
    refSide: "BUY_SIDE" | "SELL_SIDE";
    price: number;
    confirmed: true;
    openTimeSec: number;
  } | null;
  qualityRef: {
    sourceKind: "step1-data-integrity" | "step3-unified-quality" | null;
    status: string;
    inputIdentity: string | null;
    assessmentId: string | null;
  };
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalStructureInformationOnly: true;
}
