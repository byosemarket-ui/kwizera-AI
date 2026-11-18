/**
 * Phase 5B.2 Step 2 — scoped quote quality assessment types.
 */
import type { MifCanonicalQuote } from "../../canonical/quote.js";
import type { MifProviderId, MifSafetyFlags, MifTimebase } from "../../canonical/types.js";
import type { MifQualityFinding, MifQualityMetric } from "../types.js";
import type { MifScopedQualityStatus } from "../status.js";
import type {
  ClockComparabilityResult,
  MifQuoteFreshnessClass,
  MifQuoteFreshnessProfile,
} from "./freshness.js";

export interface AssessQuoteQualityInput {
  /** Null when a quote-required consumer has no quote. */
  quote: MifCanonicalQuote | null;
  providerSymbol: string;
  /** When true, missing quote is a blocking condition for this consumer. */
  requireQuote: boolean;
  /** Named freshness profile; null ⇒ freshness remains UNKNOWN (no universal thresholds). */
  freshnessProfile?: MifQuoteFreshnessProfile | null;
  /**
   * Wall-clock assessment now (unix seconds). Used only for freshness age and
   * assessmentTimestamp — excluded from inputIdentity.
   */
  nowSec?: number;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

export interface MifQuoteQualityAssessment extends MifSafetyFlags {
  contractId: "kwizera.mif.quality.v1";
  contractVersion: "1.0.0";
  scope: "step2-quote-quality";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifScopedQualityStatus;
  requireQuote: boolean;
  quotePresent: boolean;
  bid: number | null;
  ask: number | null;
  computedSpread: number | null;
  declaredSpread: number | null;
  quoteTimestampSec: number | null;
  receivedAt: string | null;
  timebase: MifTimebase | null;
  clockComparability: ClockComparabilityResult | null;
  freshnessProfileId: string | null;
  freshnessProfileVersion: string | null;
  freshness: MifQuoteFreshnessClass;
  ageSec: number | null;
  metrics: MifQualityMetric[];
  findings: MifQualityFinding[];
  warningCodes: Array<MifQualityFinding["code"]>;
  blockingCodes: Array<MifQualityFinding["code"]>;
  uncertaintyCodes: Array<MifQualityFinding["code"]>;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  notUnifiedOverallAssessment: true;
}
