/** Phase 3 Step 1 — AI Visual Product Analysis */

import type { ProductProfile } from "../product-profile/types";
import type { ProductImageSet, OrganizationViewType } from "../image-organization/types";
import type { ProductionInputPackage } from "../product-validation/types";

export type FactKind = "verified" | "ai-observation" | "ai-inference";
export type ReviewStatus = "pending" | "accepted" | "rejected" | "flagged" | "reviewed";
export type QualityClass = "GOOD" | "ACCEPTABLE" | "NEEDS_REVIEW" | "POOR";
export type CoverageNeed = "required" | "recommended" | "optional";

export type AnalysisStage =
  | "loaded"
  | "product-detection"
  | "background"
  | "color"
  | "logo"
  | "text"
  | "view"
  | "quality"
  | "visibility"
  | "features"
  | "consistency"
  | "missing-photos"
  | "saved";

export interface ConfidenceValue {
  value: string | number | boolean | string[];
  confidence: number;
  kind: FactKind;
  needsReview: boolean;
}

export interface ImageVisualResult {
  assetId: string;
  fileName: string;
  url?: string;
  width: number | null;
  height: number | null;
  viewType: OrganizationViewType;
  viewConfidence: number;
  productDetection: {
    detected: boolean;
    confidence: number;
    visibilityPercent: number;
    mainProduct: string;
    obstruction: string;
    needsReview: boolean;
  };
  background: {
    type: string;
    complexity: string;
    separation: string;
    removalSuitability: string;
    confidence: number;
  };
  colors: Array<{ name: string; role: string; confidence: number }>;
  logo: {
    present: boolean;
    possibleBrand: string | null;
    location: string | null;
    confidence: number;
  };
  detectedText: Array<{ text: string; kind: string; confidence: number }>;
  quality: {
    classification: QualityClass;
    score: number;
    sharpness: string;
    lighting: string;
    blur: string;
    resolutionNote: string;
    confidence: number;
  };
  lighting: {
    exposure: string;
    shadows: string;
    highlights: string;
    productVisibility: string;
  };
  visibility: {
    percent: number;
    framing: string;
    cutoff: boolean;
    obstruction: string;
    status: string;
    confidence: number;
  };
  composition: string;
  visualFeatures: string[];
  failed: boolean;
  failureReason?: string;
  reviewStatus: ReviewStatus;
  analyzedAt: string;
}

export interface CategoryVisualCheck {
  profileCategory: string;
  visualEstimate: string;
  confidence: number;
  conflict: boolean;
}

export interface CoverageRow {
  view: OrganizationViewType;
  need: CoverageNeed;
  status: "available" | "missing";
}

export interface VisualAnalysisWarning {
  id: string;
  code: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface VisualProductAnalysisPackage {
  version: 1;
  analysisId: string;
  projectId: string;
  productId: string;
  projectName: string;
  productName: string;
  engineId: string;
  productionPackageRef: string | null;
  productImageSet: ProductImageSet | null;
  productProfile: ProductProfile | null;
  images: ImageVisualResult[];
  categoryCheck: CategoryVisualCheck;
  consistency: {
    consistent: boolean;
    confidence: number;
    note: string;
  };
  coverage: CoverageRow[];
  coveragePercent: number;
  aggregate: {
    productDetectionAvg: number;
    primaryColor: string | null;
    secondaryColor: string | null;
    logoDetected: boolean;
    textDetected: boolean;
    qualityGoodCount: number;
    needsReviewCount: number;
    warningCount: number;
    imagesAnalyzed: number;
    imagesTotal: number;
  };
  warnings: VisualAnalysisWarning[];
  verifiedFacts: Array<{ field: string; value: string }>;
  aiObservations: Array<{ field: string; value: string; confidence: number }>;
  aiInferences: Array<{ field: string; value: string; confidence: number }>;
  status: "idle" | "running" | "complete" | "partial" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisProgress {
  total: number;
  completed: number;
  percent: number;
  currentFile: string | null;
  currentStage: AnalysisStage | null;
  statusLabel: string;
  running: boolean;
  stagePercents: Partial<Record<AnalysisStage, number>>;
}

export interface VisualAnalysisSnapshot {
  version: 1;
  package: VisualProductAnalysisPackage | null;
  progress: AnalysisProgress;
  recommendation: string;
  handoffReady: boolean;
  serviceAvailable: boolean;
  updatedAt: string;
}

export interface Step2DeepIntelHandoffPayload {
  version: 1;
  step: "step-2-deep-product-intelligence";
  projectId: string;
  projectName: string;
  visualAnalysis: VisualProductAnalysisPackage;
  productionPackage: ProductionInputPackage | null;
  preparedAt: string;
}

export const VISUAL_STORE_KEY = "kwizera.visual-analysis.v1";
export const VISUAL_HANDOFF_KEY = "kwizera.visual-analysis.handoff.v1";
export const LOW_CONFIDENCE = 0.7;

export const ANALYSIS_STAGES: AnalysisStage[] = [
  "loaded",
  "product-detection",
  "background",
  "color",
  "logo",
  "text",
  "view",
  "quality",
  "visibility",
  "features",
  "consistency",
  "missing-photos",
  "saved",
];

export const STAGE_LABELS: Record<AnalysisStage, string> = {
  loaded: "Image Loaded",
  "product-detection": "Product Detection",
  background: "Background Detection",
  color: "Color Detection",
  logo: "Logo Detection",
  text: "Text Detection",
  view: "View Analysis",
  quality: "Quality Analysis",
  visibility: "Visibility Analysis",
  features: "Feature Analysis",
  consistency: "Consistency Check",
  "missing-photos": "Missing Photo Check",
  saved: "Result Saved",
};
