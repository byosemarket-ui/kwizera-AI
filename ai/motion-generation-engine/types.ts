/**
 * KWIZERA AI STUDIO — Motion Generation Engine types (Step 8E)
 */

import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";

export enum MotionType {
  Character = "character",
  Product = "product",
  Object = "object",
  Camera = "camera",
  Environment = "environment",
  Combined = "combined",
}

export enum CharacterMotionAction {
  Walking = "walking",
  Running = "running",
  Turning = "turning",
  Looking = "looking",
  Gestures = "gestures",
  FacialExpressions = "facial-expressions",
  BodyLanguage = "body-language",
  Interaction = "interaction",
}

export enum ProductMotionAction {
  Rotation = "rotation",
  Reveal = "reveal",
  ZoomPresentation = "zoom-presentation",
  ShowcaseMotion = "showcase-motion",
  Floating = "floating",
  Placement = "placement",
  HighlightMotion = "highlight-motion",
}

export enum ObjectMotionAction {
  Entry = "entry",
  Exit = "exit",
  Interaction = "interaction",
  PhysicsBased = "physics-based",
  CollisionPlanning = "collision-planning",
  EnvironmentalInteraction = "environmental-interaction",
}

export enum EnvironmentMotionType {
  Wind = "wind",
  Rain = "rain",
  Smoke = "smoke",
  Fire = "fire",
  Water = "water",
  LightRays = "light-rays",
  Particles = "particles",
  BackgroundMotion = "background-motion",
}

export interface MotionPlanProfile {
  motionPlanId: string;
  sceneId: string;
  storyboardId: string;
  projectId: string;
  productId: string;
  brandId: string;
  platform: StoryboardGenerationPlatform;
  motionVersion: number;
  cameraPlanId: string;
}

export interface CharacterMotionPlan {
  primaryAction: CharacterMotionAction;
  walking: string;
  running: string;
  turning: string;
  looking: string;
  gestures: string;
  facialExpressions: string;
  bodyLanguage: string;
  interaction: string;
}

export interface ProductMotionPlan {
  primaryAction: ProductMotionAction;
  rotation: string;
  reveal: string;
  zoomPresentation: string;
  showcaseMotion: string;
  floating: string;
  placement: string;
  highlightMotion: string;
}

export interface ObjectMotionPlan {
  primaryAction: ObjectMotionAction;
  entry: string;
  exit: string;
  interaction: string;
  physicsBasedMotion: string;
  collisionPlanning: string;
  environmentalInteraction: string;
}

export interface CameraSynchronization {
  cameraMovement: string;
  characterMovement: string;
  productMovement: string;
  objectMovement: string;
  sceneTiming: string;
  syncPoints: string[];
}

export interface EnvironmentMotionPlan {
  activeEffects: EnvironmentMotionType[];
  wind: string;
  rain: string;
  smoke: string;
  fire: string;
  water: string;
  lightRays: string;
  particles: string;
  backgroundMotion: string;
}

export interface MotionTiming {
  motionStart: string;
  motionEnd: string;
  motionDuration: string;
  motionSpeed: string;
  motionAcceleration: string;
  motionDeceleration: string;
}

export interface MotionContinuity {
  sceneContinuity: boolean;
  characterContinuity: boolean;
  productContinuity: boolean;
  cameraContinuity: boolean;
  storyContinuity: boolean;
  notes: string[];
  issues: string[];
}

export interface PlatformMotionOptimization {
  platform: StoryboardGenerationPlatform;
  pacingStyle: string;
  movementIntensity: string;
  syncNotes: string[];
}

export interface MotionGenerationScores {
  motionQualityScore: number;
  smoothnessScore: number;
  cinematicScore: number;
  physicsConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface MotionGenerationRelationships {
  storyboards: string[];
  scenes: string[];
  cameraPlans: string[];
  stylePlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  knowledgeRecords: string[];
}

export interface MotionGenerationInput {
  sceneId?: string;
  storyboardId?: string;
  cameraPlanId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  stylePlanId?: string;
  knowledgeRecordIds?: string[];
  platform?: StoryboardGenerationPlatform;
}

export interface MotionGenerationRecord {
  motionPlanId: string;
  profile: MotionPlanProfile;
  motionType: MotionType;
  characterMotion: CharacterMotionPlan;
  productMotion: ProductMotionPlan;
  objectMotion: ObjectMotionPlan;
  cameraSynchronization: CameraSynchronization;
  environmentMotion: EnvironmentMotionPlan;
  motionTiming: MotionTiming;
  continuity: MotionContinuity;
  platformOptimizations: PlatformMotionOptimization[];
  storytellingOptimization: {
    narrativeBeat: string;
    emotionalArc: string;
    marketingMoment: string;
  };
  scores: MotionGenerationScores;
  relationships: MotionGenerationRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  physicallyConsistent: boolean;
  cinematicallyConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface MotionGenerationResult {
  success: boolean;
  plans?: MotionGenerationRecord[];
  record?: MotionGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface MotionGenerationSearchQuery {
  motionPlanId?: string;
  sceneId?: string;
  storyboardId?: string;
  motionType?: MotionType;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: StoryboardGenerationPlatform;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface MotionGenerationEngineStatusReport {
  engineStatus: string;
  planningStatus: string;
  synchronizationStatus: string;
  continuityStatus: string;
  motionPlansGenerated: number;
  averageMotionQualityScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averagePlanningMs: number;
    averageSearchMs: number;
    averageSyncMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class MotionGenerationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MotionGenerationEngineError";
  }
}

export const MOTION_PLATFORM_TARGETS: StoryboardGenerationPlatform[] = [
  StoryboardGenerationPlatform.TikTok,
  StoryboardGenerationPlatform.InstagramReels,
  StoryboardGenerationPlatform.Facebook,
  StoryboardGenerationPlatform.YouTubeShorts,
  StoryboardGenerationPlatform.YouTubeLongForm,
  StoryboardGenerationPlatform.Website,
  StoryboardGenerationPlatform.Television,
];

export const PLATFORM_MOTION_CONFIG: Record<
  StoryboardGenerationPlatform,
  { pacingStyle: string; movementIntensity: string }
> = {
  [StoryboardGenerationPlatform.TikTok]: { pacingStyle: "fast-dynamic", movementIntensity: "high" },
  [StoryboardGenerationPlatform.InstagramReels]: { pacingStyle: "rhythmic", movementIntensity: "medium-high" },
  [StoryboardGenerationPlatform.Facebook]: { pacingStyle: "moderate", movementIntensity: "medium" },
  [StoryboardGenerationPlatform.YouTubeShorts]: { pacingStyle: "punchy", movementIntensity: "high" },
  [StoryboardGenerationPlatform.YouTubeLongForm]: { pacingStyle: "cinematic", movementIntensity: "medium" },
  [StoryboardGenerationPlatform.WhatsApp]: { pacingStyle: "compact", movementIntensity: "low-medium" },
  [StoryboardGenerationPlatform.Website]: { pacingStyle: "smooth-professional", movementIntensity: "medium" },
  [StoryboardGenerationPlatform.Television]: { pacingStyle: "broadcast-stable", movementIntensity: "controlled" },
};
