import type { ProductAssetViewType } from "../product-asset-preparation/types.js";

export type ProductSceneType =
  | "hero-introduction"
  | "product-reveal"
  | "showcase-360"
  | "feature-highlight"
  | "material-close-up"
  | "detail-showcase"
  | "lifestyle-scene"
  | "product-rotation"
  | "product-comparison"
  | "price-presentation"
  | "promotional-offer"
  | "brand-scene"
  | "call-to-action"
  | "closing-scene";

export type MarketingFlowStage =
  | "attention"
  | "interest"
  | "product-reveal"
  | "product-features"
  | "benefits"
  | "trust"
  | "price"
  | "offer"
  | "call-to-action";

export interface ProductUtilizationPlan {
  assetId: string;
  sourceImageId: string;
  viewType: ProductAssetViewType;
  appearance: string;
  displayDurationSeconds: number;
  rotation: string;
  zoom: string;
  movement: string;
  highlightSequence: string;
}

export interface PlannedProductScene {
  sceneId: string;
  sceneName: string;
  sceneType: ProductSceneType;
  order: number;
  priority: "critical" | "high" | "medium" | "low";
  objective: string;
  purpose: string;
  marketingFlowStage: MarketingFlowStage;
  durationSeconds: number;
  productView: ProductAssetViewType;
  cameraAngle: string;
  cameraMovement: string;
  lightingStyle: string;
  backgroundStyle: string;
  environment: string;
  animationStyle: string;
  transitionType: string;
  productUtilization: ProductUtilizationPlan[];
  whyThisScene: string;
  knowledgeDomains: string[];
  metadata: Record<string, string | number | boolean>;
}

export interface ScenePlanningQuality {
  sceneCompleteness: number;
  sceneOrderScore: number;
  marketingFlowScore: number;
  productUsageScore: number;
  cameraPlanningScore: number;
  lightingPlanningScore: number;
  overall: number;
  issues: string[];
  repairs: string[];
}

export interface ProductScenePlanResult {
  planId: string;
  projectId: string;
  productId: string;
  productName: string;
  marketingGoal: string;
  sceneCount: number;
  scenes: PlannedProductScene[];
  sequence: string[];
  missingScenes: ProductSceneType[];
  weakFlowNotes: string[];
  recommendedOrder: string[];
  productUsageCoverage: Array<{ assetId: string; viewType: ProductAssetViewType; sceneIds: string[] }>;
  quality: ScenePlanningQuality;
  knowledgeUsed: string[];
  creativePipelineStep: 3;
  storyboardGenerationDeferred: true;
  videoGenerationDeferred: true;
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface AiMeProductScenePlanningAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainScenes: boolean;
  canRecommendSceneOrder: boolean;
  canDetectMissingScenes: boolean;
  canDetectWeakMarketingFlow: boolean;
  storyboardGenerationDeferred: true;
  videoGenerationDeferred: true;
  summary: string;
}

export interface ProductSceneExplainResult {
  planId: string;
  productName: string;
  summary: string;
  sceneExplanations: Array<{ sceneId: string; sceneName: string; why: string; flowStage: MarketingFlowStage }>;
  recommendedOrder: string[];
  missingScenes: ProductSceneType[];
  weakFlowNotes: string[];
  readyForStoryboard: boolean;
}

export interface ProductSceneHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductScenePlanningStore {
  plans: ProductScenePlanResult[];
  cache: Record<string, string>;
  history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
