/**
 * Step 2 — AI & Media Intelligence Foundation types.
 * Machine-readable product + asset intelligence for Steps 1–4 continuity.
 */

export type MediaAssetStatus =
  | "READY"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "LOW_QUALITY"
  | "FAILED";

export interface MediaAssetEntry {
  assetId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  status: MediaAssetStatus;
  analysisState: "pending" | "analyzing" | "ready" | "failed" | "unavailable";
  processingState: "pending" | "processing" | "ready" | "failed";
  preparationDecision?:
    | "KEEP_ORIGINAL"
    | "REMOVE_BACKGROUND"
    | "REPLACE_BACKGROUND_LATER"
    | "ENHANCE_SOURCE"
    | "REFRAME_PRODUCT"
    | "REQUEST_USER_ATTENTION";
  /** STEP 6 production role for later motion stages. */
  productionRole?: string;
  productionRoleConfidence?: number;
  suitableForProduction?: boolean;
  readyForLaterMotionStages?: boolean;
  backgroundPrepDecision?: string;
  view?: { role: string; confidence: number };
  background?: { type: string; removable: boolean; confidence: number; suitability?: string };
  quality?: { score: number; classification?: string; confidence: number };
  derivedForegroundId?: string;
  derivedMaskId?: string;
  derivedThumbnailId?: string;
  originalPreserved: true;
  errors: string[];
}

export interface ProductIntelligenceSummary {
  productName: string;
  category: string;
  description: string;
  visualAttributes: string[];
  colors: Array<{ name: string; confidence: number }>;
  materials: string[];
  availableViews: Array<{ view: string; assetId: string; confidence: number }>;
  userAuthoritative: boolean;
}

export interface MediaIntelligenceReport {
  projectId: string;
  productId: string;
  checkedAt: string;
  pipelineVersion: string;
  assets: MediaAssetEntry[];
  productIntelligence: ProductIntelligenceSummary | null;
  summary: {
    total: number;
    ready: number;
    needsReview: number;
    lowQuality: number;
    failed: number;
    processing: number;
    usableCount: number;
    productAnalysisReady: boolean;
    isolationReady: boolean;
  };
  failures: string[];
  ollamaReady: boolean;
  ollamaNote: string;
}

export interface ProductionImageResolution {
  path: string;
  source: "original" | "derived-foreground";
  assetId: string;
  parentAssetId: string;
}
