import type { ProductAssetViewType } from "../product-asset-preparation/types.js";
import type { MarketingFlowStage, ProductSceneType } from "../product-scene-planning/types.js";

export type StoryboardMarketingBeat =
  | "attention"
  | "interest"
  | "desire"
  | "trust"
  | "product-value"
  | "price"
  | "offer"
  | "call-to-action";

export interface StoryboardVoiceScript {
  narration: string;
  voiceTimingSeconds: number;
  speakingPace: "slow" | "moderate" | "energetic";
  emotion: string;
  tone: string;
  emphasis: string[];
}

export interface StoryboardVisualScript {
  cameraInstructions: string;
  lightingInstructions: string;
  productRotation: string;
  zoomInstructions: string;
  motionInstructions: string;
  backgroundInstructions: string;
}

export interface StoryboardScenePanel {
  sceneNumber: number;
  sceneId: string;
  sceneType: ProductSceneType;
  scenePurpose: string;
  sceneDescription: string;
  marketingBeat: StoryboardMarketingBeat;
  durationSeconds: number;
  productPosition: string;
  productView: ProductAssetViewType;
  assetId: string;
  sourceImageId: string;
  cameraAngle: string;
  cameraMovement: string;
  lightingStyle: string;
  backgroundDescription: string;
  environment: string;
  animationInstructions: string;
  transition: string;
  onScreenText: string;
  productPricePlacement: string;
  logoPlacement: string;
  ctaPlacement: string;
  voice: StoryboardVoiceScript;
  visual: StoryboardVisualScript;
  whyThisDecision: string;
  knowledgeDomains: string[];
}

export interface MarketingScriptPackage {
  openingHook: string;
  productIntroduction: string;
  featurePresentation: string;
  benefitPresentation: string;
  productHighlights: string[];
  trustBuilding: string;
  pricePresentation: string;
  promotionalMessage: string;
  callToAction: string;
  closingMessage: string;
  fullNarration: string;
}

export interface StoryboardQuality {
  storyboardScore: number;
  scriptScore: number;
  sceneConsistencyScore: number;
  marketingFlowScore: number;
  productUsageScore: number;
  ctaPlacementScore: number;
  overall: number;
  issues: string[];
  repairs: string[];
}

export interface ProductStoryboardResult {
  storyboardId: string;
  projectId: string;
  productId: string;
  storyboardTitle: string;
  marketingObjective: string;
  targetAudience: string;
  totalScenes: number;
  sceneSequence: string[];
  sceneTiming: Array<{ sceneNumber: number; startSeconds: number; durationSeconds: number }>;
  panels: StoryboardScenePanel[];
  marketingScript: MarketingScriptPackage;
  marketingBeatsPresent: StoryboardMarketingBeat[];
  missingBeats: StoryboardMarketingBeat[];
  missingScenes: string[];
  weakFlowNotes: string[];
  improvementRecommendations: string[];
  quality: StoryboardQuality;
  knowledgeUsed: string[];
  creativePipelineStep: 4;
  promptOrchestrationDeferred: true;
  videoGenerationDeferred: true;
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface AiMeProductStoryboardAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainStoryboardDecisions: boolean;
  canExplainScriptDecisions: boolean;
  canRecommendImprovements: boolean;
  canDetectMissingScenes: boolean;
  canDetectWeakMarketingFlow: boolean;
  promptOrchestrationDeferred: true;
  videoGenerationDeferred: true;
  summary: string;
}

export interface ProductStoryboardExplainResult {
  storyboardId: string;
  productName: string;
  summary: string;
  storyboardDecisions: Array<{ sceneNumber: number; decision: string }>;
  scriptDecisions: Array<{ section: string; decision: string }>;
  improvementRecommendations: string[];
  missingScenes: string[];
  weakFlowNotes: string[];
  readyForPromptOrchestration: boolean;
}

export interface ProductStoryboardHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductStoryboardStore {
  storyboards: ProductStoryboardResult[];
  cache: Record<string, string>;
  history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

export type { MarketingFlowStage };
