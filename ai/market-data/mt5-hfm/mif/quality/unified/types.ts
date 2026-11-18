/**
 * Phase 5B.2 Step 3 — unified quality assessment contract types.
 */
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { MifQualityFinding, MifQualityMetric, MifStep1DataIntegrityAssessment } from "../types.js";
import type { MifQuoteQualityAssessment } from "../quote/types.js";
import type { MifInstrumentQualityAssessment } from "../instrument/types.js";
import type { MifMultiTimeframeQualityAssessment } from "../multi-timeframe/types.js";
import type { MifPolicyEvaluationResult, MifQualityPolicy } from "../policy/types.js";
import type { MifPhase2ShadowReport } from "../shadow/types.js";
import type { MifScopedQualityStatus } from "../status.js";
import type { HfmAnalysisDataQualityReport, HfmAnalysisSyncReport } from "../../../analysis/types.js";
import type { MifQualityPolicyRegistry } from "../policy/registry.js";

export interface AssessMifUnifiedQualityInput {
  providerSymbol: string;
  consumerId: string;
  policyId: string;
  policyVersion: string;
  /** Registry used to resolve policy; no silent arbitrary default if missing. */
  policyRegistry: MifQualityPolicyRegistry;
  dataIntegrity?: MifStep1DataIntegrityAssessment | null;
  quote?: MifQuoteQualityAssessment | null;
  instrument?: MifInstrumentQualityAssessment | null;
  multiTimeframe?: MifMultiTimeframeQualityAssessment | null;
  /** Optional observational Phase 2 inputs — never mutated. */
  phase2Quality?: HfmAnalysisDataQualityReport | null;
  phase2Sync?: HfmAnalysisSyncReport | null;
  phase2SourceIdentity?: string | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

export interface MifUnifiedQualityDiagnostics {
  overallStatusReason: string;
  contributingSubsystems: string[];
  appliedPolicyRule: string;
  triggeringFindings: Array<{ code: string; severity: string; message: string }>;
  shadowDisagreement: boolean | null;
  missingEvidence: string[];
}

export interface MifUnifiedQualityAssessment extends MifSafetyFlags {
  contractId: "kwizera.mif.unified-quality.v1";
  contractVersion: "1.0.0";
  scope: "step3-unified-quality";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  consumerId: string;
  policyId: string | null;
  policyVersion: string | null;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifScopedQualityStatus;
  /** Preserved originals — not rewritten to match overall. */
  subsystems: {
    dataIntegrity: MifStep1DataIntegrityAssessment | null;
    quote: MifQuoteQualityAssessment | null;
    instrument: MifInstrumentQualityAssessment | null;
    multiTimeframe: MifMultiTimeframeQualityAssessment | null;
  };
  policyEvaluation: MifPolicyEvaluationResult | null;
  selectedPolicy: MifQualityPolicy | null;
  shadow: MifPhase2ShadowReport | null;
  metrics: MifQualityMetric[];
  findings: MifQualityFinding[];
  warningCodes: Array<MifQualityFinding["code"]>;
  blockingCodes: Array<MifQualityFinding["code"]>;
  uncertaintyCodes: Array<MifQualityFinding["code"]>;
  diagnostics: MifUnifiedQualityDiagnostics;
  diagnosticsSummary: string;
  /** Fixed safety declaration — never configurable. */
  doesNotApproveAiReasoning: true;
  notPhase2AiGate: true;
}
