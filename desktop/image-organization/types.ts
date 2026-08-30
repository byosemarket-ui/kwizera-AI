/** Phase 2 Step 2 — Intelligent Product Image Organization */

export type OrganizationViewType =
  | "FRONT"
  | "BACK"
  | "LEFT"
  | "RIGHT"
  | "FRONT_LEFT"
  | "FRONT_RIGHT"
  | "BACK_LEFT"
  | "BACK_RIGHT"
  | "TOP"
  | "BOTTOM"
  | "DETAIL"
  | "CLOSE_UP"
  | "MATERIAL_DETAIL"
  | "PACKAGING"
  | "LOGO"
  | "OTHER"
  | "UNKNOWN";

export type ImageRoleInGroup = "primary" | "alternative" | "detail";

export interface OrganizationWarning {
  code:
    | "duplicate"
    | "near-duplicate"
    | "low-confidence"
    | "visibility"
    | "consistency"
    | "missing-view"
    | "analysis-failed"
    | "quality";
  message: string;
  assetId?: string;
}

export interface OrganizedImage {
  assetId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  url?: string;
  viewType: OrganizationViewType;
  confidence: number;
  roleInGroup: ImageRoleInGroup;
  groupId: string;
  backgroundType: string;
  visibilityStatus: "clear" | "partial" | "cut-off" | "small" | "unknown";
  duplicateOfAssetId?: string;
  similarity?: number;
  needsReview: boolean;
  analysisFailed: boolean;
  analysisError?: string;
  userCorrected: boolean;
  qualityScore: number;
  warnings: OrganizationWarning[];
  analyzedAt: string;
  origin?: "original" | "derived";
  processingState?: string;
  analysisState?: string;
  aiVisionStatus?: string;
  analysisVersion?: string;
  provenanceProvider?: string;
  visualMethod?: string;
  pixelAnalysisAvailable?: boolean;
  observations?: Array<{ field: string; value: string; kind: string; confidence: number }>;
  derivedThumbnailId?: string;
}

export interface ViewGroup {
  viewType: OrganizationViewType;
  groupId: string;
  primaryAssetId: string | null;
  images: OrganizedImage[];
  missing: boolean;
}

export interface OrganizationProgress {
  total: number;
  completed: number;
  percent: number;
  currentFile: string | null;
  currentClassification: OrganizationViewType | null;
  currentConfidence: number | null;
  statusLabel: string;
  running: boolean;
}

export interface ProductImageSet {
  version: 1;
  projectId: string;
  projectName: string;
  categoryEstimate: string;
  groups: ViewGroup[];
  images: OrganizedImage[];
  missingViews: OrganizationViewType[];
  recommendedViews: OrganizationViewType[];
  coverageScore: number;
  warnings: OrganizationWarning[];
  consistencyOk: boolean;
  analyzedAt: string;
  updatedAt: string;
}

export interface OrganizationSnapshot {
  version: 1;
  projectId: string | null;
  projectName: string;
  progress: OrganizationProgress;
  productImageSet: ProductImageSet | null;
  canContinue: boolean;
  continueBlockedReason: string | null;
  handoffReady: boolean;
  recommendation: string;
  updatedAt: string;
}

export interface Step3HandoffPayload {
  version: 1;
  step: "step-3-product-information";
  projectId: string;
  projectName: string;
  productImageSet: ProductImageSet;
  preparedAt: string;
}

export const ORG_STORE_KEY = "kwizera.image-organization.set.v1";
export const ORG_HANDOFF_KEY = "kwizera.image-organization.handoff.v1";
export const LOW_CONFIDENCE = 0.7;

export const ALL_VIEW_TYPES: OrganizationViewType[] = [
  "FRONT", "BACK", "LEFT", "RIGHT", "FRONT_LEFT", "FRONT_RIGHT", "BACK_LEFT", "BACK_RIGHT",
  "TOP", "BOTTOM", "DETAIL", "CLOSE_UP", "MATERIAL_DETAIL", "PACKAGING", "LOGO", "OTHER", "UNKNOWN",
];
