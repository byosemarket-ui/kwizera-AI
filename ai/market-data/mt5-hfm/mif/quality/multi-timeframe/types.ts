/**
 * Phase 5B.2 Step 2 — scoped multi-timeframe quality assessment types.
 */
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifProviderId, MifSafetyFlags, MifTimebase } from "../../canonical/types.js";
import type { MifQualityFinding, MifQualityMetric } from "../types.js";
import type { MifScopedQualityStatus } from "../status.js";
import type { MifMultiTimeframeRequirement } from "./requirements.js";
import type { TipBoundary } from "./synchronization.js";

export interface AssessMultiTimeframeQualityInput {
  providerSymbol: string;
  seriesByTimeframe: Readonly<Record<string, readonly MifCanonicalCandle[]>>;
  requirement: MifMultiTimeframeRequirement;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

export interface MifMultiTimeframeQualityAssessment extends MifSafetyFlags {
  contractId: "kwizera.mif.quality.v1";
  contractVersion: "1.0.0";
  scope: "step2-multi-timeframe-quality";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  consumerId: string;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifScopedQualityStatus;
  suppliedTimeframes: string[];
  requiredTimeframes: string[];
  optionalTimeframes: string[];
  requiredMissing: string[];
  optionalMissing: string[];
  emptyTimeframes: string[];
  unsupportedTimeframes: string[];
  tipByTimeframe: Record<string, TipBoundary>;
  measuredSkewSec: number | null;
  maxTipSkewSec: number | null;
  alignment: "aligned" | "skewed" | "unknown" | "incomparable";
  timebase: MifTimebase | "MIXED" | null;
  metrics: MifQualityMetric[];
  findings: MifQualityFinding[];
  warningCodes: Array<MifQualityFinding["code"]>;
  blockingCodes: Array<MifQualityFinding["code"]>;
  uncertaintyCodes: Array<MifQualityFinding["code"]>;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  notUnifiedOverallAssessment: true;
}
