export type CameraMove =
  | "pan"
  | "tilt"
  | "dolly"
  | "truck"
  | "orbit"
  | "push-in"
  | "pull-out"
  | "crane"
  | "handheld"
  | "product-rotation";

export type VisualEffect =
  | "motion-blur"
  | "depth-of-field"
  | "lens"
  | "reflections"
  | "contact-shadows"
  | "glow"
  | "product-highlight"
  | "luxury-presentation";

export type MarketingFlowBeat =
  | "hook"
  | "product-reveal"
  | "feature-showcase"
  | "benefits"
  | "brand-presence"
  | "price-presentation"
  | "offer"
  | "call-to-action";

export interface SceneVideoClip {
  clipId: string;
  sceneNumber: number;
  sceneId: string;
  sourceImageId: string;
  assetId: string;
  productName: string;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  cameraMove: CameraMove;
  cameraWhy: string;
  transition: string;
  effects: VisualEffect[];
  effectsWhy: string;
  marketingBeat: MarketingFlowBeat;
  marketingWhy: string;
  promptUsed: string;
  previewFileName: string;
  relativePath: string;
  mimeType: "image/svg+xml";
  keyframeImageId: string;
  productPreserved: true;
  originalUnmodified: true;
  consistencyLocks: string[];
  quality: {
    productAccuracy: number;
    motionQuality: number;
    cameraSmoothness: number;
    lightingConsistency: number;
    sceneConsistency: number;
    transitionQuality: number;
    marketingQuality: number;
    overall: number;
    issues: string[];
    repairs: string[];
  };
  createdAt: string;
}

export interface ProductVideoGenerationQuality {
  videoGenerationScore: number;
  motionQualityScore: number;
  cameraQualityScore: number;
  productPreservationScore: number;
  visualConsistencyScore: number;
  marketingFlowScore: number;
  overall: number;
  issues: string[];
  repairs: string[];
}

export interface ProductVideoGenerationResult {
  generationId: string;
  projectId: string;
  productId: string;
  imageGenerationId: string;
  orchestrationId: string;
  storyboardId: string;
  clips: SceneVideoClip[];
  assembledPreviewFileName: string;
  assembledRelativePath: string;
  totalDurationSeconds: number;
  frameRate: number;
  resolution: string;
  marketingFlowPresent: MarketingFlowBeat[];
  missingMarketingBeats: MarketingFlowBeat[];
  consistency: {
    productName: string;
    colors: string[];
    brand: string;
    lightingStyle: string;
    cameraStyle: string;
    backgroundStyle: string;
    marketingStyle: string;
  };
  improvementRecommendations: string[];
  quality: ProductVideoGenerationQuality;
  creativePipelineStep: 7;
  audioVoiceDeferred: true;
  originalsUnmodified: true;
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface AiMeProductVideoGenerationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainScenes: boolean;
  canExplainCameraMovements: boolean;
  canExplainVisualEffects: boolean;
  canExplainMarketingDecisions: boolean;
  canRecommendImprovements: boolean;
  audioVoiceDeferred: true;
  summary: string;
}

export interface ProductVideoGenerationExplainResult {
  generationId: string;
  productName: string;
  summary: string;
  sceneExplanations: Array<{ sceneNumber: number; why: string }>;
  cameraExplanations: Array<{ sceneNumber: number; move: CameraMove; why: string }>;
  effectExplanations: Array<{ sceneNumber: number; effects: VisualEffect[]; why: string }>;
  marketingExplanations: Array<{ sceneNumber: number; beat: MarketingFlowBeat; why: string }>;
  improvementRecommendations: string[];
  readyForAudioVoice: boolean;
}

export interface ProductVideoGenerationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductVideoGenerationStore {
  generations: ProductVideoGenerationResult[];
  cache: Record<string, string>;
  history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
