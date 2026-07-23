/**
 * KWIZERA AI STUDIO — Scene Generation Engine types (Step 8C)
 */

import {
  CameraAngle,
  CameraMovement,
  ShotType,
  StoryboardGenerationPlatform,
} from "../story-generation-engine/types.js";

export { CameraAngle, CameraMovement, ShotType, StoryboardGenerationPlatform };

export enum SceneGenerationInputType {
  Storyboard = "storyboard",
  ProductInformation = "product-information",
  BrandGuidelines = "brand-guidelines",
  Campaign = "campaign",
  Script = "script",
  Image = "image",
  Video = "video",
  Audio = "audio",
  KnowledgeRecord = "knowledge-record",
}

export enum SceneType {
  Opening = "opening",
  Hook = "hook",
  Introduction = "introduction",
  Problem = "problem",
  Solution = "solution",
  ProductShowcase = "product-showcase",
  Benefits = "benefits",
  SocialProof = "social-proof",
  CallToAction = "call-to-action",
  Ending = "ending",
  Transition = "transition",
  Custom = "custom",
}

export enum ScenePriority {
  Critical = "critical",
  High = "high",
  Medium = "medium",
  Low = "low",
}

export interface SceneGenerationProfile {
  sceneId: string;
  storyboardId: string;
  projectId: string;
  campaignId: string;
  productId: string;
  brandId: string;
  platform: StoryboardGenerationPlatform;
  sceneVersion: number;
}

export interface SceneStructure {
  sceneOrder: number;
  sceneDuration: string;
  scenePurpose: string;
  scenePriority: ScenePriority;
  sceneType: SceneType;
  sceneMood: string;
  sceneEnvironment: string;
  sceneObjectives: string[];
}

export interface SceneShot {
  shotId: string;
  shotOrder: number;
  shotDuration: string;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  cameraMovement: CameraMovement;
  framing: string;
  focusPoint: string;
  motionInstructions: string;
}

export interface VisualGenerationPlan {
  background: string;
  lighting: string;
  composition: string;
  colorStyle: string;
  productPlacement: string;
  logoPlacement: string;
  typographyPlacement: string;
  graphicElements: string;
}

export interface CharacterPlanning {
  characterPosition: string;
  characterActions: string;
  facialExpression: string;
  bodyLanguage: string;
  eyeContact: string;
  interactionPlanning: string;
}

export interface ObjectPlanning {
  productPosition: string;
  objectPosition: string;
  objectInteraction: string;
  environmentObjects: string[];
  motionObjects: string[];
}

export interface SceneAudioPlanning {
  voiceTiming: string;
  musicTiming: string;
  soundEffects: string;
  audioSynchronization: string;
  silenceTiming: string;
}

export interface TransitionPlanning {
  sceneTransition: string;
  shotTransition: string;
  motionTransition: string;
  audioTransition: string;
  visualTransition: string;
}

export interface ScenePlatformOptimization {
  platform: StoryboardGenerationPlatform;
  aspectRatio: string;
  durationGuidance: string;
  pacingNotes: string[];
  safeZoneNotes: string[];
}

export interface SceneGenerationScores {
  sceneQualityScore: number;
  compositionScore: number;
  cinematicScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface SceneGenerationRelationships {
  storyboards: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  scripts: string[];
  motionPlans: string[];
  cameraPlans: string[];
  audioPlans: string[];
  knowledgeRecords: string[];
  images: string[];
  videos: string[];
}

export interface SceneGenerationInput {
  storyboardId: string;
  sceneId?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  scriptId?: string;
  imageIds?: string[];
  videoIds?: string[];
  audioIds?: string[];
  knowledgeRecordIds?: string[];
  platform?: StoryboardGenerationPlatform;
  inputTypes?: SceneGenerationInputType[];
}

export interface SceneGenerationRecord {
  sceneId: string;
  profile: SceneGenerationProfile;
  structure: SceneStructure;
  shots: SceneShot[];
  visualPlan: VisualGenerationPlan;
  characterPlanning: CharacterPlanning;
  objectPlanning: ObjectPlanning;
  audioPlanning: SceneAudioPlanning;
  transitionPlanning: TransitionPlanning;
  cameraPlanning: {
    primaryAngle: CameraAngle;
    primaryMovement: CameraMovement;
    coverageNotes: string;
  };
  motionPlanning: {
    subjectMotion: string;
    cameraMotion: string;
    environmentMotion: string;
  };
  layout: {
    foreground: string;
    midground: string;
    background: string;
    depthLayers: string[];
  };
  platformOptimizations: ScenePlatformOptimization[];
  scores: SceneGenerationScores;
  relationships: SceneGenerationRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  marketingReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface SceneGenerationResult {
  success: boolean;
  scenes?: SceneGenerationRecord[];
  record?: SceneGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface SceneGenerationSearchQuery {
  sceneId?: string;
  storyboardId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: StoryboardGenerationPlatform;
  sceneType?: SceneType;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface SceneGenerationEngineStatusReport {
  engineStatus: string;
  generationStatus: string;
  shotPlanningStatus: string;
  compositionStatus: string;
  scenesGenerated: number;
  averageSceneQualityScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averageShotPlanningMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class SceneGenerationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SceneGenerationEngineError";
  }
}

export const SCENE_PLATFORM_TARGETS: StoryboardGenerationPlatform[] = [
  StoryboardGenerationPlatform.TikTok,
  StoryboardGenerationPlatform.InstagramReels,
  StoryboardGenerationPlatform.Facebook,
  StoryboardGenerationPlatform.YouTubeShorts,
  StoryboardGenerationPlatform.YouTubeLongForm,
  StoryboardGenerationPlatform.Website,
  StoryboardGenerationPlatform.Television,
];

export const PLATFORM_SCENE_CONFIG: Record<
  StoryboardGenerationPlatform,
  { aspectRatio: string; durationGuidance: string }
> = {
  [StoryboardGenerationPlatform.TikTok]: { aspectRatio: "9:16", durationGuidance: "5-8s per scene" },
  [StoryboardGenerationPlatform.InstagramReels]: { aspectRatio: "9:16", durationGuidance: "6-10s per scene" },
  [StoryboardGenerationPlatform.Facebook]: { aspectRatio: "1:1", durationGuidance: "8-12s per scene" },
  [StoryboardGenerationPlatform.YouTubeShorts]: { aspectRatio: "9:16", durationGuidance: "5-9s per scene" },
  [StoryboardGenerationPlatform.YouTubeLongForm]: { aspectRatio: "16:9", durationGuidance: "10-15s per scene" },
  [StoryboardGenerationPlatform.WhatsApp]: { aspectRatio: "9:16", durationGuidance: "7-10s per scene" },
  [StoryboardGenerationPlatform.Website]: { aspectRatio: "16:9", durationGuidance: "8-12s per scene" },
  [StoryboardGenerationPlatform.Television]: { aspectRatio: "16:9", durationGuidance: "broadcast-safe pacing" },
};

export function mapPurposeToSceneType(purpose: string): SceneType {
  const map: Record<string, SceneType> = {
    "opening-hook": SceneType.Hook,
    introduction: SceneType.Introduction,
    problem: SceneType.Problem,
    solution: SceneType.Solution,
    "product-showcase": SceneType.ProductShowcase,
    benefits: SceneType.Benefits,
    "social-proof": SceneType.SocialProof,
    "call-to-action": SceneType.CallToAction,
    ending: SceneType.Ending,
  };
  return map[purpose] ?? SceneType.Custom;
}

export function mapPurposeToPriority(purpose: string): ScenePriority {
  if (["opening-hook", "call-to-action", "product-showcase"].includes(purpose)) return ScenePriority.Critical;
  if (["hook", "solution", "benefits"].includes(purpose)) return ScenePriority.High;
  if (["introduction", "social-proof"].includes(purpose)) return ScenePriority.Medium;
  return ScenePriority.Low;
}
