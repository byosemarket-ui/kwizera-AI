import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type {
  MIF_LIQUIDITY_REFERENCE_CONTRACT_ID,
  MIF_LIQUIDITY_REFERENCE_CONTRACT_VERSION,
} from "./contracts.js";

export type MifLiquidityReferenceStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export type MifLiquidityRefType =
  | "SWING_HIGH"
  | "SWING_LOW"
  | "EQUAL_HIGH"
  | "EQUAL_LOW"
  | "CLUSTER";

export type MifLiquidityLifecycle =
  | "ACTIVE"
  | "SWEPT"
  | "RECLAIMED"
  | "ACCEPTED_THROUGH"
  | "STALE"
  | "INVALID";

export interface MifLiquidityReference {
  referenceId: string;
  refType: MifLiquidityRefType;
  refSide: "BUY_SIDE" | "SELL_SIDE";
  price: number;
  sourceSwingIds: readonly string[];
  confirmed: boolean;
  lifecycle: MifLiquidityLifecycle;
  detectionOpenTimeSec: number;
  freshnessBars: number;
  /** Descriptive only — never claims resting stop orders. */
  notes: string;
}

export interface MifLiquidityReferenceAssessment extends MifSafetyFlags {
  contractId: typeof MIF_LIQUIDITY_REFERENCE_CONTRACT_ID;
  contractVersion: typeof MIF_LIQUIDITY_REFERENCE_CONTRACT_VERSION;
  scope: "phase5d6-liquidity-reference";
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
  status: MifLiquidityReferenceStatus;
  references: readonly MifLiquidityReference[];
  primaryReference: MifLiquidityReference | null;
  tipObservation: {
    excursion: "BEYOND" | "TOUCH" | "NONE";
    reclaim: "YES" | "NO" | "UNKNOWN";
    accepted: boolean;
    closeState: "CLOSED" | "FORMING" | "UNKNOWN";
    againstReferenceId: string | null;
  } | null;
  qualityRef: {
    sourceKind: string | null;
    status: string;
    inputIdentity: string | null;
    assessmentId: string | null;
  };
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalLiquidityInformationOnly: true;
  /** Explicit: does not claim institutional resting liquidity. */
  doesNotClaimRestingOrders: true;
}
