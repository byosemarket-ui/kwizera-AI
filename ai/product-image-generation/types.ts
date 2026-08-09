export type BackgroundStyle =
  | "luxury-studio"
  | "modern-studio"
  | "lifestyle"
  | "indoor"
  | "outdoor"
  | "product-showcase"
  | "premium-marketing";

export interface ProductPlacement {
  scale: number;
  positionX: number;
  positionY: number;
  rotationDegrees: number;
  perspective: "front" | "slight-angle" | "hero";
  contactShadow: boolean;
  reflection: boolean;
  ambientLighting: boolean;
}

export interface ImageEnhancementApplied {
  resolution: string;
  sharpness: number;
  lighting: number;
  exposure: number;
  contrast: number;
  whiteBalance: number;
  colors: number;
  noiseReduction: number;
  edgeQuality: number;
}

export interface SceneMarketingImage {
  imageId: string;
  sceneNumber: number;
  sceneId: string;
  assetId: string;
  sourceImageId: string;
  productName: string;
  fileName: string;
  relativePath: string;
  mimeType: "image/png";
  resolution: { width: number; height: number };
  backgroundStyle: BackgroundStyle;
  backgroundWhy: string;
  lightingWhy: string;
  placement: ProductPlacement;
  enhancement: ImageEnhancementApplied;
  promptUsed: string;
  productPreserved: true;
  originalUnmodified: true;
  consistencyLocks: string[];
  quality: {
    productAccuracy: number;
    imageQuality: number;
    backgroundQuality: number;
    lightingConsistency: number;
    shadowConsistency: number;
    reflectionQuality: number;
    sceneConsistency: number;
    overall: number;
    issues: string[];
    repairs: string[];
  };
  createdAt: string;
}

export interface ProductImageGenerationQuality {
  productPreservationScore: number;
  backgroundScore: number;
  enhancementScore: number;
  sceneConsistencyScore: number;
  imageQualityScore: number;
  productAccuracyScore: number;
  overall: number;
  issues: string[];
  repairs: string[];
}

export interface ProductImageGenerationResult {
  generationId: string;
  projectId: string;
  productId: string;
  orchestrationId: string;
  storyboardId: string;
  images: SceneMarketingImage[];
  consistency: {
    productName: string;
    colors: string[];
    brand: string;
    cameraStyle: string;
    lightingStyle: string;
    backgroundStyleFamily: string;
  };
  improvementRecommendations: string[];
  quality: ProductImageGenerationQuality;
  creativePipelineStep: 6;
  videoGenerationDeferred: true;
  originalsUnmodified: true;
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface AiMeProductImageGenerationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainGeneratedImages: boolean;
  canExplainBackgroundSelection: boolean;
  canExplainLightingDecisions: boolean;
  canRecommendImageImprovements: boolean;
  videoGenerationDeferred: true;
  summary: string;
}

export interface ProductImageGenerationExplainResult {
  generationId: string;
  productName: string;
  summary: string;
  imageExplanations: Array<{ sceneNumber: number; why: string; path: string }>;
  backgroundExplanations: Array<{ sceneNumber: number; style: BackgroundStyle; why: string }>;
  lightingExplanations: Array<{ sceneNumber: number; why: string }>;
  improvementRecommendations: string[];
  readyForVideoGeneration: boolean;
}

export interface ProductImageGenerationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductImageGenerationStore {
  generations: ProductImageGenerationResult[];
  cache: Record<string, string>;
  history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
