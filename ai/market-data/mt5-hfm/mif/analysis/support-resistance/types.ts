import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type {
  MIF_SUPPORT_RESISTANCE_CONTRACT_ID,
  MIF_SUPPORT_RESISTANCE_CONTRACT_VERSION,
} from "./contracts.js";

export type MifSupportResistanceStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export interface MifBoundaryLevel {
  boundaryId: string;
  kind: "SUPPORT" | "RESISTANCE" | "PIVOT";
  low: number;
  high: number;
  mid: number;
  sourceSwingIds: readonly string[];
  touchCount: number;
  lifecycle: "ACTIVE" | "BROKEN" | "STALE" | "INVALIDATED";
  lastTouchOpenTimeSec: number | null;
}

export interface MifSupportResistanceAssessment extends MifSafetyFlags {
  contractId: typeof MIF_SUPPORT_RESISTANCE_CONTRACT_ID;
  contractVersion: typeof MIF_SUPPORT_RESISTANCE_CONTRACT_VERSION;
  scope: "phase5d6-support-resistance";
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
  status: MifSupportResistanceStatus;
  boundaries: readonly MifBoundaryLevel[];
  primaryBoundary: MifBoundaryLevel | null;
  qualityRef: {
    sourceKind: string | null;
    status: string;
    inputIdentity: string | null;
    assessmentId: string | null;
  };
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalBoundaryInformationOnly: true;
}
