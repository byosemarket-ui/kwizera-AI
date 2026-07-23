/**
 * KWIZERA AI STUDIO — Sound Effects Generation Engine types (Step 10F)
 */

export enum SfxPlatform {
  Website = "website",
  Mobile = "mobile",
  YouTube = "youtube",
  TikTok = "tiktok",
  Instagram = "instagram",
  Facebook = "facebook",
  Television = "television",
  Radio = "radio",
}

export enum SoundCategory {
  Foley = "foley",
  Environmental = "environmental",
  Cinematic = "cinematic",
  Transition = "transition",
  Interface = "interface",
  Object = "object",
  Human = "human",
  Mechanical = "mechanical",
  Electronic = "electronic",
  Mixed = "mixed",
}

export enum SfxInputType {
  SoundPrompt = "sound-prompt",
  VideoInformation = "video-information",
  ImageInformation = "image-information",
  AnimationInformation = "animation-information",
  BrandGuidelines = "brand-guidelines",
  Campaign = "campaign",
  Timeline = "timeline",
  KnowledgeRecord = "knowledge-record",
}

export enum SfxSyncTarget {
  Video = "video",
  Animation = "animation",
  Game = "game",
  Film = "film",
  Podcast = "podcast",
  Advertisement = "advertisement",
  SocialMedia = "social-media",
}

export enum FoleyType {
  Footsteps = "footsteps",
  ClothingMovement = "clothing-movement",
  DoorSounds = "door-sounds",
  GlassSounds = "glass-sounds",
  MetalSounds = "metal-sounds",
  PaperSounds = "paper-sounds",
  WaterSounds = "water-sounds",
  ToolSounds = "tool-sounds",
}

export enum EnvironmentalType {
  Rain = "rain",
  Wind = "wind",
  Forest = "forest",
  Ocean = "ocean",
  River = "river",
  Fire = "fire",
  Crowd = "crowd",
  Office = "office",
  Restaurant = "restaurant",
  City = "city",
  Village = "village",
  Market = "market",
}

export enum CinematicType {
  Impact = "impact",
  Boom = "boom",
  Whoosh = "whoosh",
  Rise = "rise",
  Hit = "hit",
  TrailerEffects = "trailer-effects",
  TransitionEffects = "transition-effects",
  Atmosphere = "atmosphere",
}

export interface SoundProfile {
  soundPlanId: string;
  projectId: string;
  brandId: string;
  campaignId?: string;
  platform: SfxPlatform;
  soundCategory: SoundCategory;
  version: number;
}

export interface SoundAnalysis {
  scene: string;
  environment: string;
  action: string;
  objects: string[];
  distance: string;
  direction: string;
  durationSec: number;
  intensity: string;
  emotion: string;
  intendedAudience: string;
  keywords: string[];
}

export interface SoundEffectPlan {
  foleySounds: string[];
  objectSounds: string[];
  humanSounds: string[];
  natureSounds: string[];
  animalSounds: string[];
  vehicleSounds: string[];
  mechanicalSounds: string[];
  electronicSounds: string[];
  interfaceSounds: string[];
  transitionSounds: string[];
}

export interface FoleyPlan {
  foleyTypes: FoleyType[];
  footsteps: string;
  clothingMovement: string;
  doorSounds: string;
  glassSounds: string;
  metalSounds: string;
  paperSounds: string;
  waterSounds: string;
  toolSounds: string;
  notes: string[];
}

export interface EnvironmentalSoundPlan {
  environmentalTypes: EnvironmentalType[];
  primaryEnvironment: string;
  ambientLayers: string[];
  spatialNotes: string[];
  environmentDetails: Record<string, string>;
}

export interface CinematicSoundPlan {
  cinematicTypes: CinematicType[];
  impact: string;
  boom: string;
  whoosh: string;
  rise: string;
  hit: string;
  trailerEffects: string;
  transitionEffects: string;
  atmosphere: string;
}

export interface TimelinePlan {
  cuePoints: { timeSec: number; label: string; soundType: string }[];
  layerPositions: string[];
  totalDurationSec: number;
  fadeIn: string;
  fadeOut: string;
  crossfade: string;
}

export interface SyncPreparationPlan {
  syncTarget: SfxSyncTarget;
  hitPoints: string[];
  syncNotes: string[];
  platformNotes: string[];
}

export interface ProductionSfxInstructions {
  renderNotes: string[];
  layerGuidance: string[];
  mixGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
}

export interface SoundEffectsScores {
  realismScore: number;
  synchronizationScore: number;
  layerQualityScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface SoundEffectsRelationships {
  soundPlans: string[];
  musicPlans: string[];
  voicePlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  videos: string[];
  images: string[];
  knowledgeRecords: string[];
}

export interface SoundEffectsGenerationInput {
  soundPrompt?: string;
  videoId?: string;
  videoRef?: string;
  imageId?: string;
  imageRef?: string;
  animationId?: string;
  animationRef?: string;
  timelineRef?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: SfxPlatform;
  soundCategory?: SoundCategory;
  syncTarget?: SfxSyncTarget;
  durationSec?: number;
  sceneHint?: string;
  musicPlanIds?: string[];
  voicePlanIds?: string[];
  knowledgeRecordIds?: string[];
  inputTypes?: SfxInputType[];
}

export interface SoundEffectsGenerationRecord {
  soundPlanId: string;
  profile: SoundProfile;
  soundAnalysis: SoundAnalysis;
  soundEffectPlan: SoundEffectPlan;
  foleyPlan: FoleyPlan;
  environmentalPlan: EnvironmentalSoundPlan;
  cinematicPlan: CinematicSoundPlan;
  timelinePlan: TimelinePlan;
  syncPreparation: SyncPreparationPlan;
  productionInstructions: ProductionSfxInstructions;
  blueprintId?: string;
  scores: SoundEffectsScores;
  relationships: SoundEffectsRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface SoundEffectsGenerationResult {
  success: boolean;
  record?: SoundEffectsGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface SoundEffectsSearchQuery {
  soundPlanId?: string;
  productId?: string;
  brandId?: string;
  soundCategory?: SoundCategory;
  scene?: string;
  platform?: SfxPlatform;
  syncTarget?: SfxSyncTarget;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface SoundEffectsGenerationEngineStatusReport {
  engineStatus: string;
  soundAnalysisStatus: string;
  foleyPlanningStatus: string;
  environmentalPlanningStatus: string;
  cinematicPlanningStatus: string;
  timelinePlanningStatus: string;
  syncPreparationStatus: string;
  soundPlansGenerated: number;
  averageRealismScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averageBlueprintMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class SoundEffectsGenerationEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "SoundEffectsGenerationEngineError";
  }
}

export const ALL_SFX_PLATFORMS: SfxPlatform[] = [
  SfxPlatform.Website,
  SfxPlatform.Mobile,
  SfxPlatform.YouTube,
  SfxPlatform.TikTok,
  SfxPlatform.Instagram,
  SfxPlatform.Facebook,
  SfxPlatform.Television,
  SfxPlatform.Radio,
];

export const SUPPORTED_SOUND_CATEGORIES: SoundCategory[] = [
  SoundCategory.Foley,
  SoundCategory.Environmental,
  SoundCategory.Cinematic,
  SoundCategory.Transition,
  SoundCategory.Interface,
  SoundCategory.Object,
  SoundCategory.Human,
  SoundCategory.Mechanical,
  SoundCategory.Electronic,
  SoundCategory.Mixed,
];

export const FOLEY_TYPES: FoleyType[] = Object.values(FoleyType);
export const ENVIRONMENTAL_TYPES: EnvironmentalType[] = Object.values(EnvironmentalType);
export const CINEMATIC_TYPES: CinematicType[] = Object.values(CinematicType);

export const PLATFORM_SFX_CONFIG: Record<
  SfxPlatform,
  { maxDurationSec: number; loudnessTarget: string; formatNotes: string }
> = {
  [SfxPlatform.Website]: { maxDurationSec: 30, loudnessTarget: "-16 LUFS", formatNotes: "Subtle UI and transition SFX" },
  [SfxPlatform.Mobile]: { maxDurationSec: 15, loudnessTarget: "-14 LUFS", formatNotes: "Short tactile feedback sounds" },
  [SfxPlatform.YouTube]: { maxDurationSec: 120, loudnessTarget: "-14 LUFS", formatNotes: "Full cinematic SFX range" },
  [SfxPlatform.TikTok]: { maxDurationSec: 15, loudnessTarget: "-12 LUFS", formatNotes: "Punchy impact and whoosh" },
  [SfxPlatform.Instagram]: { maxDurationSec: 20, loudnessTarget: "-13 LUFS", formatNotes: "Trend-aware transition SFX" },
  [SfxPlatform.Facebook]: { maxDurationSec: 30, loudnessTarget: "-14 LUFS", formatNotes: "Auto-play optimized SFX" },
  [SfxPlatform.Television]: { maxDurationSec: 10, loudnessTarget: "-24 LUFS", formatNotes: "Broadcast SFX standard" },
  [SfxPlatform.Radio]: { maxDurationSec: 5, loudnessTarget: "-16 LUFS", formatNotes: "Stinger and transition SFX" },
};
