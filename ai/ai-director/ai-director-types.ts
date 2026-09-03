/**
 * Step 7 — AI Director shared types (decision trace, plan review, quality review).
 */

export interface PlanReviewItem {
  order: number;
  label: string;
  purpose: string;
  assetId?: string;
}

export interface ProductionDecisionTrace {
  projectId: string;
  planSource: "ai" | "deterministic";
  modelId: string | null;
  fallbackUsed: boolean;
  heroAssetId: string | null;
  sceneCount: number;
  platform: string;
  productionMode: string;
  durationSeconds: number;
  creativePlanVersion: number;
  assetIds: string[];
  inputFingerprint: string;
  createdAt: string;
}

export type OutputQualityGate =
  | "VALIDATING"
  | "TECHNICAL_VALIDATION"
  | "AI_QUALITY_REVIEW"
  | "READY"
  | "FAILED";

export interface QualityReviewResult {
  score: number;
  suggestions: string[];
  checks: Record<string, boolean>;
  source: "deterministic" | "ai" | "none";
  reviewedAt: string;
  blocking: boolean;
}

export type AiDirectorProviderStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "LOADING"
  | "ERROR"
  | "MODEL_NOT_INSTALLED"
  | "DISABLED"
  | "FALLBACK_ACTIVE";
