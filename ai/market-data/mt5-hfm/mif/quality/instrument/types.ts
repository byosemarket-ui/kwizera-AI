/**
 * Phase 5B.2 Step 2 — scoped instrument quality assessment types.
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { MifQualityFinding, MifQualityMetric } from "../types.js";
import type { MifScopedQualityStatus } from "../status.js";
import type { PriceCheckInput } from "./price-precision.js";

export interface AssessInstrumentQualityInput {
  instrument: MifCanonicalInstrument | null;
  providerSymbol: string;
  /** Optional prices to check against metadata (no rounding). */
  prices?: PriceCheckInput[];
  requirePositivePrices?: boolean;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

export interface MifInstrumentQualityAssessment extends MifSafetyFlags {
  contractId: "kwizera.mif.quality.v1";
  contractVersion: "1.0.0";
  scope: "step2-instrument-quality";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifScopedQualityStatus;
  metadataComplete: boolean;
  catalogVersion: string | null;
  digits: number | null;
  point: number | null;
  tickSize: number | null;
  precisionVerified: boolean | null;
  metrics: MifQualityMetric[];
  findings: MifQualityFinding[];
  warningCodes: Array<MifQualityFinding["code"]>;
  blockingCodes: Array<MifQualityFinding["code"]>;
  uncertaintyCodes: Array<MifQualityFinding["code"]>;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  notUnifiedOverallAssessment: true;
}
