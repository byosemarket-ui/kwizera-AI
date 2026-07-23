/**
 * KWIZERA AI STUDIO — Visual Planning Engine types (Step 5I)
 */

import type { CreativeDirectionStyle, CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";

export type VisualPlanningPlatform = CreativePlatform;

export interface VisualPlanningProfile {
  visualPlanId: string;
  projectId: string;
  storyboardId: string;
  scriptPlanId: string;
  product: string;
  brand: string;
  campaignGoal: MarketingObjective;
  platform: VisualPlanningPlatform;
  visualVersion: number;
  creativeStyle: CreativeDirectionStyle;
  industry: string;
}

export interface SceneVisualPlan {
  sceneNumber: number;
  visualGoal: string;
  productPlacement: string;
  backgroundStyle: string;
  lightingDirection: string;
  cameraAngle: string;
  cameraDistance: string;
  cameraMovement: string;
  composition: string;
  depth: string;
  colorPalette: string;
  typography: string;
  iconPlacement: string;
  logoPlacement: string;
  visualEffectsPlan: string;
  motionDirection: string;
  transitionDirection: string;
}

export interface BackgroundPlanning {
  studioBackground: string;
  lifestyleBackground: string;
  transparentBackground: string;
  gradientBackground: string;
  environmentBackground: string;
  brandedBackground: string;
  customBackground: string;
}

export interface CameraPlanning {
  closeUp: string;
  mediumShot: string;
  wideShot: string;
  topView: string;
  sideView: string;
  heroShot: string;
  orbit: string;
  zoom: string;
  pan: string;
  tilt: string;
}

export interface VisualStylePlanning {
  modern: string;
  luxury: string;
  minimal: string;
  corporate: string;
  cinematic: string;
  commercial: string;
  fashion: string;
  technology: string;
  food: string;
  realEstate: string;
}

export interface BrandConsistencyCheck {
  logoPlacement: boolean;
  brandColors: boolean;
  typography: boolean;
  brandIdentity: boolean;
  visualConsistency: boolean;
  issues: string[];
  recommendations: string[];
}

export interface GraphicElementsPlan {
  titles: string;
  captions: string;
  priceTags: string;
  productFeatures: string;
  icons: string;
  ctaButtons: string;
  qrCodes: string;
  contactInformation: string;
}

export interface VisualPlanningScores {
  visualPlanningScore: number;
  compositionScore: number;
  brandConsistencyScore: number;
  creativeScore: number;
  marketingScore: number;
  aiConfidenceScore: number;
}

export interface VisualPlanningRelationships {
  storyboards: string[];
  scriptPlans: string[];
  creativeDirections: string[];
  marketingStrategies: string[];
  products: string[];
  brands: string[];
  audioPlans: string[];
  productionPlans: string[];
  knowledgeRecords: string[];
}

export interface VisualPlanningInput {
  productId: string;
  visualPlanId?: string;
  storyboardId?: string;
  scriptPlanId?: string;
  projectId?: string;
}

export interface VisualPlanningRecord {
  visualPlanId: string;
  productId: string;
  projectId: string;
  storyboardId: string;
  scriptPlanId: string;
  creativeId: string;
  strategyId: string;
  profile: VisualPlanningProfile;
  scenePlans: SceneVisualPlan[];
  backgroundPlanning: BackgroundPlanning;
  cameraPlanning: CameraPlanning;
  visualStyle: VisualStylePlanning;
  brandConsistency: BrandConsistencyCheck;
  graphicElements: GraphicElementsPlan;
  scores: VisualPlanningScores;
  relationships: VisualPlanningRelationships;
  validated: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
  version: number;
}

export interface VisualPlanningResult {
  success: boolean;
  record?: VisualPlanningRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface VisualPlanningSearchQuery {
  visualPlanId?: string;
  storyboardId?: string;
  scriptPlanId?: string;
  brand?: string;
  productId?: string;
  creativeStyle?: CreativeDirectionStyle;
  platform?: VisualPlanningPlatform;
  campaignGoal?: MarketingObjective;
  sceneNumber?: number;
  industry?: string;
  text?: string;
  limit?: number;
}

export interface VisualPlanningEngineStatusReport {
  engineStatus: string;
  visualPlanningStatus: string;
  cameraPlanningStatus: string;
  backgroundPlanningStatus: string;
  visualPlansPrepared: number;
  averageVisualPlanningScore: number;
  averageCompositionScore: number;
  performance: {
    averagePlanningMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class VisualPlanningEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "VisualPlanningEngineError";
  }
}
