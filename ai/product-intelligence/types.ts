/** Supported product image view roles for multi-view analysis. */
export type ProductViewRole =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "detail"
  | "close-up"
  | "side"
  | "unknown";

export interface ProductViewAnalysis {
  imageId: string;
  fileName: string;
  role: ProductViewRole;
  duplicateOf?: string;
}

export interface ProductSellingPoint {
  point: string;
  source: "user-provided" | "image-evidence" | "inferred-from-description";
  confidence: number;
}

export interface MissingProductInformation {
  field: string;
  severity: "critical" | "recommended" | "optional";
  recommendation: string;
}

export interface PhotoRecommendation {
  view: ProductViewRole;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface ImageAnalysisSummary {
  imageCount: number;
  boundariesDetected: number;
  backgroundsClassified: number;
  shadowsNoted: number;
  reflectionsNoted: number;
  averageQuality: number;
  resolutionNotes: string[];
  missingAngles: ProductViewRole[];
  duplicateImageIds: string[];
  viewCoverage: ProductViewAnalysis[];
}

export interface ProductIntelligenceProfile {
  id: string;
  projectId: string;
  productName: string;
  identifiedAs: string;
  productType: string;
  category: string;
  brand: string;
  description: string;
  imageIds: string[];
  viewCount: number;
  materials: string[];
  colours: string[];
  textures: string[];
  shapes: string[];
  patterns: string[];
  style: string[];
  features: string[];
  functions: string[];
  dimensions?: string;
  visibleLogos: string[];
  qualityIndicators: string[];
  sellingPoints: ProductSellingPoint[];
  targetAudience: string;
  marketingKeywords: string[];
  price?: number;
  currency?: string;
  sizes: string[];
  tags: string[];
  specifications: Record<string, string>;
  quality: { score: number; confidence: number; notes: string[] };
  relationships: Array<{ type: string; target: string; confidence: number }>;
  multiView: {
    viewCount: number;
    coverage: string;
    views: ProductViewAnalysis[];
    missingAngles: ProductViewRole[];
  };
  imageAnalysis: ImageAnalysisSummary;
  missingInformation: MissingProductInformation[];
  photoRecommendations: PhotoRecommendation[];
  detailRecommendations: string[];
  readyForCreativeGeneration: boolean;
  /** Original uploaded bytes are never rewritten by this engine. */
  originalImagesUnmodified: true;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface AiMeProductIntelligenceAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canUnderstandProduct: boolean;
  canExplainCharacteristics: boolean;
  canDetectMissingInformation: boolean;
  canRecommendAdditionalPhotos: boolean;
  canRecommendMissingDetails: boolean;
  /** Step 1 itself does not remove backgrounds; Step 2 Product Asset Preparation owns cutouts. */
  backgroundRemovalDeferred: true;
  videoGenerationDeferred: true;
  summary: string;
}

export interface ProductIntelligenceExplainResult {
  productId: string;
  productName: string;
  summary: string;
  characteristics: string[];
  missingInformation: MissingProductInformation[];
  photoRecommendations: PhotoRecommendation[];
  detailRecommendations: string[];
  readyForCreativeGeneration: boolean;
}

export interface ProductIntelligenceHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductIntelligenceStore {
  profiles: ProductIntelligenceProfile[];
  history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>;
  cache: Record<string, string>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
