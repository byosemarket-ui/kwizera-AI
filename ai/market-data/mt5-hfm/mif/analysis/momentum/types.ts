import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type {
  MIF_MOMENTUM_CONTRACT_ID,
  MIF_MOMENTUM_CONTRACT_VERSION,
} from "./contracts.js";

export type MifMomentumStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export type MifMomentumDirection = "UP" | "DOWN" | "FLAT" | "UNKNOWN";
export type MifMomentumPhase =
  | "EXPANDING"
  | "STABLE"
  | "WEAKENING"
  | "EXHAUSTING"
  | "FLAT"
  | "INSUFFICIENT_EVIDENCE";

export interface MifMomentumIndicatorReading {
  indicatorId: "ROC" | "RSI";
  /** Documented definition id. */
  definition: string;
  period: number;
  value: number | null;
  unit: string;
  warmUpComplete: boolean;
}

export interface MifMomentumAssessment extends MifSafetyFlags {
  contractId: typeof MIF_MOMENTUM_CONTRACT_ID;
  contractVersion: typeof MIF_MOMENTUM_CONTRACT_VERSION;
  scope: "phase5d6-momentum";
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
  status: MifMomentumStatus;
  direction: MifMomentumDirection;
  phase: MifMomentumPhase;
  /** Composite analytical strength in [0,1] — NOT a win probability. */
  strengthScore: number | null;
  strengthScoreDefinition: string;
  notWinProbability: true;
  indicators: readonly MifMomentumIndicatorReading[];
  conflictingIndicators: boolean;
  qualityRef: {
    sourceKind: string | null;
    status: string;
    inputIdentity: string | null;
    assessmentId: string | null;
  };
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalMomentumInformationOnly: true;
}
