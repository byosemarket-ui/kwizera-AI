/**
 * Phase 5B.2 Step 3 — Phase 2 shadow comparison types (observational only).
 */
import type { HfmAnalysisDataQualityReport, HfmAnalysisSyncReport } from "../../../analysis/types.js";
import type { MifStep1DataIntegrityAssessment } from "../types.js";
import type { MifQuoteQualityAssessment } from "../quote/types.js";
import type { MifMultiTimeframeQualityAssessment } from "../multi-timeframe/types.js";
import type { MifScopedQualityStatus } from "../status.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";

export type MifShadowDimension =
  | "candle_integrity"
  | "coverage"
  | "gaps"
  | "quote_freshness"
  | "synchronization"
  | "overall_interpretation";

export type MifShadowComparisonOutcome =
  | "equivalent"
  | "compatible_different"
  | "mif_additional_evidence"
  | "phase2_additional_evidence"
  | "genuine_disagreement"
  | "incomparable"
  | "insufficient_evidence";

export interface MifShadowDimensionResult {
  dimension: MifShadowDimension;
  outcome: MifShadowComparisonOutcome;
  phase2Status: string | null;
  mifStatus: MifScopedQualityStatus | string | null;
  phase2Evidence: string | null;
  mifEvidence: string | null;
  disagreementCode: string | null;
  explanation: string;
}

export interface Phase2ShadowBridgeInput {
  dataIntegrity: MifStep1DataIntegrityAssessment | null;
  quote: MifQuoteQualityAssessment | null;
  multiTimeframe: MifMultiTimeframeQualityAssessment | null;
  phase2Quality: HfmAnalysisDataQualityReport;
  phase2Sync?: HfmAnalysisSyncReport | null;
  /** Optional opaque Phase 2 source identity (e.g. snapshotHash) — not mutated. */
  phase2SourceIdentity?: string | null;
  providerSymbol: string;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

export interface MifPhase2ShadowReport extends MifSafetyFlags {
  contractId: "kwizera.mif.unified-quality.v1";
  contractVersion: "1.0.0";
  scope: "step3-phase2-shadow";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  phase2SourceIdentity: string | null;
  phase2Status: string;
  phase2ApprovedForAiReasoning: boolean;
  /** Echo only — never mutated by the bridge. */
  phase2ApprovedForAiReasoningUnchanged: true;
  dimensions: MifShadowDimensionResult[];
  hasGenuineDisagreement: boolean;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  doesNotMutatePhase2: true;
  notUnifiedOverallAssessment: true;
}
