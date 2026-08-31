/** Unified STEP 1 — Product Setup types */

import type { IntakeAssetMeta, IntakeSnapshot } from "../product-intake/types";
import type { OrganizationSnapshot, OrganizedImage, ProductImageSet } from "../image-organization/types";

export type AnalysisUiStatus =
  | "NOT_STARTED"
  | "UPLOADING"
  | "ANALYZING"
  | "COMPLETE"
  | "REVIEW_REQUIRED"
  | "PARTIAL"
  | "FAILED";

export type DataOwnership = "USER_CONFIRMED" | "AI_DETECTED" | "SYSTEM_CALCULATED";

export interface ProductEssentials {
  productName: string;
  currentPrice: number | null;
  previousPrice: number | null;
  currency: string;
  size: string;
  shortDescription: string;
}

export interface OptionalProductDetails {
  brand: string;
  color: string;
  material: string;
  features: string;
  website: string;
  notes: string;
}

export interface DiscountInfo {
  percent: number | null;
  valid: boolean;
  label: string | null;
  ownership: DataOwnership;
}

export interface ReadinessResult {
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
  recommendations: string[];
  summary: {
    projectName: boolean;
    validImages: number;
    productName: boolean;
    analysisStatus: AnalysisUiStatus;
  };
  statusLabel: "READY TO CONTINUE" | "READY WITH RECOMMENDATIONS" | "NOT READY";
}

export interface AiProductSummary {
  productLabel: string | null;
  category: string | null;
  imageCount: number;
  usefulViews: string[];
  heroAssetId: string | null;
  coverageLabel: "GOOD PRODUCT COVERAGE" | "LIMITED PRODUCT COVERAGE" | "INSUFFICIENT COVERAGE";
  coverageMessage: string;
}

export interface ImageCardModel {
  assetId: string;
  url: string | undefined;
  fileName: string;
  aiViewType: string;
  finalViewType: string;
  displayLabel: string;
  confidence: number;
  needsReview: boolean;
  userCorrected: boolean;
  severity: "critical" | "warning" | "info" | "ok";
  issueMessage: string | null;
  isDuplicate: boolean;
  /** Live import state — visible before server save completes */
  uploadStatus: "uploading" | "saved" | "failed";
}

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export interface ProductSetupSnapshot {
  version: 1;
  projectId: string | null;
  projectName: string;
  intake: IntakeSnapshot;
  organization: OrganizationSnapshot;
  essentials: ProductEssentials;
  optional: OptionalProductDetails;
  discount: DiscountInfo;
  analysisStatus: AnalysisUiStatus;
  aiSummary: AiProductSummary | null;
  imageCards: ImageCardModel[];
  readiness: ReadinessResult;
  saveState: SaveState;
  canContinue: boolean;
  continueBlockedReason: string | null;
  continueLabel: string;
  updatedAt: string;
}

export interface Step2HandoffPayload {
  version: 1;
  step: "step-2-video-requirements";
  projectId: string;
  projectName: string;
  productImageSet: ProductImageSet;
  essentials: ProductEssentials;
  optional: OptionalProductDetails;
  discount: DiscountInfo;
  category: string | null;
  preparedAt: string;
}

export type { IntakeAssetMeta, OrganizedImage, ProductImageSet };
