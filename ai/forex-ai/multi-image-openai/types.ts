/**
 * Phase 49B/49C — Multi-image OpenAI analysis types.
 */
import type { ChartCaptureRecord } from "../../forex-chart-capture/types.js";
import type { OpenAiSnapshotAnalysisResult } from "../snapshot-openai/types.js";
import { MULTI_IMAGE_ANALYSIS_SCHEMA } from "./limits.js";

export { MULTI_IMAGE_ANALYSIS_SCHEMA };

export interface MultiImageMtfRosterRole {
  timeframe: string;
  role: "higher" | "intermediate" | "lower" | "only";
  captureIds: string[];
  imageCount: number;
  earliestCapturedAtUtc: string | null;
  latestCapturedAtUtc: string | null;
  note: string | null;
}

export interface MultiImageMtfRoster {
  distinctTimeframes: string[];
  sameTimeframeDuplicates: boolean;
  captureSpanMs: number | null;
  roles: MultiImageMtfRosterRole[];
  note: string;
}

export interface MultiImageMtfReasoning {
  roster: MultiImageMtfRoster;
  timeframeAgreement:
    | "ALIGNED"
    | "MIXED"
    | "CONFLICTING"
    | "SINGLE_TIMEFRAME"
    | "INSUFFICIENT";
  higherTimeframeContext: string | null;
  intermediateStructure: string | null;
  lowerTimeframeSetup: string | null;
  agreementSummary: string | null;
  conflictSummary: string | null;
  bullishScenario: string | null;
  bearishScenario: string | null;
  keyLevels: Array<{
    level: string;
    provenance: "VISIBLE_IN_IMAGE" | "CONFIRMED_BY_DATA" | "INFERENCE" | "UNKNOWN";
    captureId: string | null;
    timeframe: string | null;
  }>;
  confirmationConditions: string[];
  invalidationConditions: string[];
  missingEvidence: string[];
}

export interface MultiImageCaptureRef {
  captureId: string;
  capturedAtUtc: string;
  capturedAtLocal: string;
  mode: string;
  instrument: ChartCaptureRecord["instrument"];
  timeframe: string;
  quote: ChartCaptureRecord["quote"];
  candleWindow: ChartCaptureRecord["candleWindow"];
  /** Capture-time linkage — may be null (Phase 49A.1 verified). */
  marketSnapshot: ChartCaptureRecord["marketSnapshot"];
  image: {
    mimeType: string;
    width: number;
    height: number;
    byteLength: number;
  };
  hasImage: boolean;
}

export interface MultiImageAnalysisRequest {
  /** Required — must be true; opening the page or selecting images is not enough. */
  confirmed: boolean;
  /** Stable fingerprint of the exact sorted captureId set being confirmed. */
  selectionFingerprint: string;
  captureIds: string[];
  /** Optional analysis-time immutable snapshot (current market context). */
  snapshotId?: string;
  contentFingerprint?: string;
  timeoutMs?: number;
  tradeAllocation?: { amount: number; currency: string } | null;
}

export interface MultiImageDataProvenance {
  captureTime: {
    note: string;
    captures: MultiImageCaptureRef[];
  };
  analysisTime: {
    note: string;
    snapshotId: string | null;
    contentFingerprint: string | null;
    quoteFreshness: string | null;
    feedHealth: string | null;
    bid: number | null;
    ask: number | null;
    lastPrice: number | null;
    observedAtUtc: string | null;
    provider: string | null;
    symbol: string | null;
  };
  onlineResearch: {
    included: false;
    note: string;
  };
}

export interface MultiImageAnalysisResult extends OpenAiSnapshotAnalysisResult {
  schemaVersion: typeof MULTI_IMAGE_ANALYSIS_SCHEMA | OpenAiSnapshotAnalysisResult["schemaVersion"] | string;
  multiImage: {
    captureIds: string[];
    selectionFingerprint: string;
    imageCount: number;
    provenance: MultiImageDataProvenance;
    visionModel: string;
    confirmedAtUtc: string;
    /** Phase 49C — deterministic roster + model MTF reasoning. */
    mtfReasoning?: MultiImageMtfReasoning;
    /** Phase 50A — BUY-side directional confidence (not a win probability). */
    buyAssessment?: {
      directionalConfidencePercent: number | null;
      directionalConfidenceLabel: string;
      scoreMethod: string;
      supportsBuy: boolean;
      buyBlockedReason: string | null;
      entryReadiness: "NOT_CONFIRMED" | "REVIEW_ONLY";
      components: Array<{ id: string; delta: number; reason: string }>;
      imagesSubmittedAsImageUrl: true;
      modelDecisionBeforePolicy: string;
      finalDecision: string;
    };
  };
}

export interface MultiImageAnalysisApiResult {
  ok: boolean;
  code: string;
  error?: string;
  latencyMs: number;
  analysis: MultiImageAnalysisResult | null;
  review?: MultiImageReviewPayload | null;
}

/** Server-built review payload (no image bytes) for the confirm UI. */
export interface MultiImageReviewPayload {
  selectionFingerprint: string;
  imageCount: number;
  captures: MultiImageCaptureRef[];
  model: string;
  modelVisionEligible: boolean;
  modelVisionNote: string;
  analysisTime: MultiImageDataProvenance["analysisTime"];
  /** Phase 49C — deterministic timeframe roster for the review panel. */
  mtfRoster: MultiImageMtfRoster;
  warnings: string[];
  limits: {
    maxCaptures: number;
    maxTotalBytes: number;
    maxBytesPerImage: number;
  };
  requiresExplicitConfirm: true;
  note: string;
}
