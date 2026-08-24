/** Phase 2 Step 5 — Live Product Validation, Final Review & Production Readiness */

import type { ProductProfile } from "../product-profile/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import type { ProductImageSet } from "../image-organization/types";

export type ValidationSeverity = "info" | "warning" | "critical";
export type ReadinessState = "READY" | "READY_WITH_WARNINGS" | "NOT_READY" | "MANUAL_REVIEW_REQUIRED";
export type ValidationArea =
  | "assets"
  | "image-set"
  | "product-information"
  | "marketing"
  | "consistency"
  | "pricing"
  | "cta"
  | "language"
  | "production-requirements";

export type QuickFixAction =
  | "edit-product"
  | "edit-images"
  | "edit-marketing"
  | "review-conflict"
  | "keep-current"
  | "use-ai-recommendation"
  | "add-missing"
  | "rerun-validation";

export interface ValidationIssue {
  id: string;
  area: ValidationArea;
  severity: ValidationSeverity;
  code: string;
  title: string;
  checked: string;
  found: string;
  why: string;
  howToFix: string;
  quickFix?: QuickFixAction;
  userValue?: string;
  aiValue?: string;
  acknowledged: boolean;
}

export interface ValidationAreaProgress {
  area: ValidationArea;
  label: string;
  percent: number;
  status: "pending" | "running" | "done" | "failed";
  ok: boolean;
}

export interface CompletenessScores {
  productAssets: number;
  imageSet: number;
  productInformation: number;
  marketing: number;
  validation: number;
  overall: number;
  blockersTo100: string[];
}

export interface ProductionRequirements {
  productImages: boolean;
  productInformation: boolean;
  marketingInformation: boolean;
  storyRequirements: string[];
  creativeRequirements: string[];
  audioRequirements: string[];
  videoRequirements: string[];
  platformRequirements: string[];
  exportRequirements: string[];
}

export interface ProductionInputPackage {
  version: string;
  packageId: string;
  status: "draft" | "confirmed" | "handoff-failed" | "handed-off";
  projectId: string;
  productId: string;
  projectName: string;
  productImageSet: ProductImageSet | null;
  productProfile: ProductProfile;
  marketingBrief: MarketingProductionBrief;
  issues: ValidationIssue[];
  scores: CompletenessScores;
  readiness: ReadinessState;
  readinessReason: string;
  productionRequirements: ProductionRequirements;
  userConfirmations: {
    confirmedAt: string | null;
    confirmedBy: "user";
    acknowledgedIssueIds: string[];
  };
  aiRecommendations: Array<{ field: string; value: string; note: string }>;
  pipelineJobId: string | null;
  handoffError: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
}

export interface ValidationSnapshot {
  version: 1;
  running: boolean;
  progress: ValidationAreaProgress[];
  currentLabel: string;
  overallProgress: number;
  package: ProductionInputPackage | null;
  issues: ValidationIssue[];
  scores: CompletenessScores | null;
  readiness: ReadinessState | null;
  readinessReason: string;
  reviewOpen: boolean;
  confirmPending: boolean;
  handoffReady: boolean;
  productInputCenterComplete: boolean;
  recommendation: string;
  updatedAt: string;
}

export const VALIDATION_STORE_KEY = "kwizera.product-validation.v1";
export const PRODUCTION_PACKAGE_KEY = "kwizera.production-input-package.v1";

export const AREA_LABELS: Record<ValidationArea, string> = {
  assets: "Product Assets",
  "image-set": "Image Set",
  "product-information": "Product Information",
  marketing: "Marketing",
  consistency: "Consistency",
  pricing: "Pricing",
  cta: "CTA",
  language: "Language",
  "production-requirements": "Production Requirements",
};
