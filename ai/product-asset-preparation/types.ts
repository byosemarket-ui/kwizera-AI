import type { ProductViewRole } from "../product-intelligence/types.js";
import type { PreparedAssetDecision } from "./prepared-asset-contract.js";

export type ProductAssetViewType = ProductViewRole;
export type { PreparedAssetDecision };

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackgroundRemovalPlan {
  sourceImageId: string;
  productDetected: boolean;
  backgroundDetected: boolean;
  removable: boolean;
  preserveEdges: boolean;
  preserveShadows: boolean;
  preserveTransparency: boolean;
  preserveReflections: boolean;
  confidence: number;
  notes: string[];
}

export interface AssetQualityReport {
  backgroundRemoved: boolean;
  productNotDamaged: boolean;
  edgesClean: boolean;
  transparencyCorrect: boolean;
  resolutionAcceptable: boolean;
  duplicate: boolean;
  score: number;
  confidence: number;
  issues: string[];
  repairs: string[];
}

export interface ProductAssetRecord {
  assetId: string;
  productId: string;
  projectId: string;
  sourceImageId: string;
  viewType: ProductAssetViewType;
  fileName: string;
  relativePath: string;
  mimeType: "image/png";
  resolution: { width: number; height: number };
  transparency: boolean;
  boundingBox: BoundingBox;
  version: number;
  fingerprint: string;
  originalPreserved: true;
  quality: AssetQualityReport;
  removalPlan: BackgroundRemovalPlan;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface MultiViewProductAssetSet {
  projectId: string;
  productId: string;
  productName: string;
  views: Record<ProductAssetViewType, ProductAssetRecord[]>;
  missingViews: ProductAssetViewType[];
  assetIds: string[];
}

export interface ProductAssetPreparationResult {
  projectId: string;
  productId: string;
  productName: string;
  assets: ProductAssetRecord[];
  /** STEP 6 — one decision per original product image (includes KEEP_ORIGINAL). */
  preparedDecisions: PreparedAssetDecision[];
  multiView: MultiViewProductAssetSet;
  missingViews: ProductAssetViewType[];
  photoRecommendations: Array<{ view: ProductAssetViewType; reason: string; priority: "high" | "medium" | "low" }>;
  qualitySummary: {
    averageScore: number;
    averageConfidence: number;
    backgroundRemovalPassRate: number;
    edgePassRate: number;
    transparencyPassRate: number;
  };
  originalsUnmodified: true;
  creativePipelineStep: 2;
  scenePlanningDeferred: true;
  videoGenerationDeferred: true;
  step6ContractVersion?: string;
}

export interface AiMeProductAssetAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canUseProcessedAssets: boolean;
  canDetectMissingAngles: boolean;
  canRecommendAdditionalPhotos: boolean;
  canExplainAssetQuality: boolean;
  backgroundRemovalEnabled: boolean;
  scenePlanningDeferred: true;
  videoGenerationDeferred: true;
  summary: string;
}

export interface ProductAssetExplainResult {
  projectId: string;
  productName: string;
  summary: string;
  assetCount: number;
  qualityNotes: string[];
  missingViews: ProductAssetViewType[];
  photoRecommendations: Array<{ view: ProductAssetViewType; reason: string; priority: "high" | "medium" | "low" }>;
  readyForScenePlanning: boolean;
}

export interface ProductAssetHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductAssetPreparationStore {
  assets: ProductAssetRecord[];
  results: ProductAssetPreparationResult[];
  /** Latest STEP 6 decisions keyed for quick project restore. */
  preparedDecisions: PreparedAssetDecision[];
  fingerprints: Record<string, string>;
  history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
