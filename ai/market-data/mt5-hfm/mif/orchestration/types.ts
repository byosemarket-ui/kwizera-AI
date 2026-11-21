import type { MifSafetyFlags } from "../canonical/types.js";
import type { MifMarketEvidencePackage } from "../market-evidence/types.js";
import type {
  MIF_ORCHESTRATION_CONTRACT_ID,
  MIF_ORCHESTRATION_CONTRACT_VERSION,
} from "./contracts.js";

export type MifOrchestrationStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "FAILED"
  | "SKIPPED";

export type MifOrchestrationCandleTipState =
  | "CLOSED"
  | "FORMING"
  | "STALE"
  | "MISSING";

export interface MifOrchestrationCompleteness {
  expectedTimeframes: readonly string[];
  presentTimeframes: readonly string[];
  missingTimeframes: readonly string[];
  enginesCompleted: readonly string[];
  enginesSkipped: readonly string[];
  rankingIncluded: boolean;
  probabilityIncluded: false;
  evidenceItemCount: number;
  evidenceTrustedComplete: boolean;
  notes: readonly string[];
}

export interface MifOrchestrationTimingsMs {
  validateMs: number;
  seriesAdaptMs: number;
  pipelineMs: number;
  assembleMs: number;
  persistMs: number;
  totalMs: number;
}

export interface MifOrchestrationResult extends MifSafetyFlags {
  contractId: typeof MIF_ORCHESTRATION_CONTRACT_ID;
  contractVersion: typeof MIF_ORCHESTRATION_CONTRACT_VERSION;
  correlationId: string;
  snapshotId: string;
  snapshotHash: string;
  hashVersion: string;
  /** True only when Charts snapshotId/hash were supplied and verified — never fabricated. */
  snapshotIdSourceVerified: boolean;
  providerId: "HFM_MT5";
  providerSymbol: string;
  timeframePack: readonly string[];
  candleTipStates: Readonly<Record<string, MifOrchestrationCandleTipState>>;
  mifRequestId: string | null;
  mifRunId: string | null;
  evidencePackageId: string | null;
  evidencePackage: MifMarketEvidencePackage | null;
  orchestrationStatus: MifOrchestrationStatus;
  completeness: MifOrchestrationCompleteness;
  warnings: readonly string[];
  failureReason: string | null;
  timingsMs: MifOrchestrationTimingsMs;
  capturedAt: string;
  doesNotApproveAiReasoning: true;
  analyticalOrchestrationOnly: true;
  notExecutable: true;
}
