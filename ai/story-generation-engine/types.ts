/**
 * KWIZERA AI STUDIO — Storyboard Generation Engine types (Step 8B)
 */

import type { CreativePlatform, CreativeDirectionStyle } from "../creative-direction-engine/types.js";
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";

export enum StoryboardGenerationPlatform {
  TikTok = "tiktok",
  InstagramReels = "instagram-reels",
  Facebook = "facebook",
  YouTubeShorts = "youtube-shorts",
  YouTubeLongForm = "youtube-long-form",
  WhatsApp = "whatsapp",
  Website = "website",
  Television = "television",
}

export enum StoryboardGenerationInputType {
  TextPrompt = "text-prompt",
  ProductInformation = "product-information",
  BrandGuidelines = "brand-guidelines",
  MarketingCampaign = "marketing-campaign",
  CreativeBrief = "creative-brief",
  Script = "script",
  Image = "image",
  Video = "video",
  VoiceInstructions = "voice-instructions",
  KnowledgeRecord = "knowledge-record",
}

export enum StoryboardStoryType {
  ProductLaunch = "product-launch",
  BrandAwareness = "brand-awareness",
  Conversion = "conversion",
  Educational = "educational",
  Testimonial = "testimonial",
  Promotional = "promotional",
  Custom = "custom",
}

export enum ShotType {
  Wide = "wide",
  Medium = "medium",
  CloseUp = "close-up",
  ExtremeCloseUp = "extreme-close-up",
  OverTheShoulder = "over-the-shoulder",
  Aerial = "aerial",
  POV = "pov",
  Insert = "insert",
}

export enum CameraAngle {
  EyeLevel = "eye-level",
  LowAngle = "low-angle",
  HighAngle = "high-angle",
  Dutch = "dutch",
  BirdEye = "bird-eye",
  WormEye = "worm-eye",
}

export enum CameraMovement {
  Static = "static",
  Pan = "pan",
  Tilt = "tilt",
  Dolly = "dolly",
  Tracking = "tracking",
  Crane = "crane",
  Handheld = "handheld",
  Zoom = "zoom",
}

export interface StoryboardGenerationProfile {
  storyboardId: string;
  projectId: string;
  campaignId: string;
  productId: string;
  brandId: string;
  platform: StoryboardGenerationPlatform;
  language: string;
  version: number;
  storyType: StoryboardStoryType;
  creativeStyle: CreativeDirectionStyle;
  targetAudience: string;
  estimatedDuration: string;
  totalScenes: number;
  totalShots: number;
}

export interface StoryStructure {
  openingHook: string;
  introduction: string;
  problem: string;
  solution: string;
  productShowcase: string;
  benefits: string;
  socialProof: string;
  callToAction: string;
  ending: string;
}

export interface GeneratedScene {
  sceneId: string;
  sceneOrder: number;
  scenePurpose: string;
  sceneDuration: string;
  sceneObjective: string;
  sceneMood: string;
  sceneEnvironment: string;
  sceneAssets: string[];
  shots: GeneratedShot[];
}

export interface GeneratedShot {
  shotId: string;
  shotOrder: number;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  cameraMovement: CameraMovement;
  framing: string;
  motionInstructions: string;
  duration: string;
  description: string;
}

export interface VisualPlanning {
  composition: string;
  lighting: string;
  colorStyle: string;
  background: string;
  typography: string;
  graphics: string;
  branding: string;
}

export interface AudioPlanning {
  voiceTiming: string;
  musicPlacement: string;
  soundEffects: string;
  silencePlanning: string;
  audioSynchronization: string;
}

export interface MarketingPlanning {
  productReveal: string;
  offerPlacement: string;
  brandPlacement: string;
  ctaPlacement: string;
  conversionStrategy: string;
}

export interface ViewerJourney {
  attentionPhase: string;
  interestPhase: string;
  desirePhase: string;
  actionPhase: string;
  retentionPhase: string;
}

export interface CinematicPlanning {
  pacing: string;
  rhythm: string;
  visualArc: string;
  emotionalArc: string;
  transitionStrategy: string;
}

export interface PlatformStoryboardVariation {
  platform: StoryboardGenerationPlatform;
  adaptedSceneCount: number;
  adaptedDuration: string;
  pacingAdjustments: string[];
  formatNotes: string[];
  ctaAdaptation: string;
  aspectRatio: string;
}

export interface StoryboardGenerationScores {
  storyQualityScore: number;
  marketingScore: number;
  creativeScore: number;
  cinematicScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface StoryboardGenerationRelationships {
  products: string[];
  brands: string[];
  campaigns: string[];
  scripts: string[];
  images: string[];
  videos: string[];
  audio: string[];
  knowledgeRecords: string[];
  productionPlans: string[];
  storyboardIntelligenceIds: string[];
  creativeDirections: string[];
  marketingStrategies: string[];
}

export interface StoryboardGenerationInput {
  /** Primary text prompt for generation */
  textPrompt?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  platform?: StoryboardGenerationPlatform;
  language?: string;
  storyType?: StoryboardStoryType;
  /** Link to existing storyboard intelligence record */
  storyboardIntelligenceId?: string;
  creativeBrief?: string;
  scriptId?: string;
  scriptText?: string;
  imageIds?: string[];
  videoIds?: string[];
  voiceInstructions?: string;
  knowledgeRecordIds?: string[];
  includeSocialProof?: boolean;
  generatePlatformVariations?: boolean;
  inputTypes?: StoryboardGenerationInputType[];
}

export interface StoryboardGenerationRecord {
  storyboardId: string;
  profile: StoryboardGenerationProfile;
  storyStructure: StoryStructure;
  scenes: GeneratedScene[];
  visualPlanning: VisualPlanning;
  audioPlanning: AudioPlanning;
  marketingPlanning: MarketingPlanning;
  viewerJourney: ViewerJourney;
  cinematicPlanning: CinematicPlanning;
  platformVariations: PlatformStoryboardVariation[];
  productionStructure: {
    acts: string[];
    narrativeFlow: string[];
    marketingFlow: string[];
  };
  scores: StoryboardGenerationScores;
  relationships: StoryboardGenerationRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  marketingReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface StoryboardGenerationResult {
  success: boolean;
  record?: StoryboardGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface StoryboardGenerationSearchQuery {
  storyboardId?: string;
  campaignId?: string;
  productId?: string;
  brandId?: string;
  storyType?: StoryboardStoryType;
  platform?: StoryboardGenerationPlatform;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface StoryboardGenerationEngineStatusReport {
  engineStatus: string;
  generationStatus: string;
  scenePlanningStatus: string;
  shotPlanningStatus: string;
  platformVariationStatus: string;
  storyboardsGenerated: number;
  averageStoryQualityScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averageScenePlanningMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class StoryboardGenerationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "StoryboardGenerationEngineError";
  }
}

/** Map CreativePlatform to StoryboardGenerationPlatform */
export function mapCreativePlatform(platform: CreativePlatform): StoryboardGenerationPlatform {
  const map: Record<CreativePlatform, StoryboardGenerationPlatform> = {
    tiktok: StoryboardGenerationPlatform.TikTok,
    "instagram-reels": StoryboardGenerationPlatform.InstagramReels,
    facebook: StoryboardGenerationPlatform.Facebook,
    "youtube-shorts": StoryboardGenerationPlatform.YouTubeShorts,
    youtube: StoryboardGenerationPlatform.YouTubeLongForm,
    "whatsapp-status": StoryboardGenerationPlatform.WhatsApp,
    website: StoryboardGenerationPlatform.Website,
  };
  return map[platform] ?? StoryboardGenerationPlatform.Website;
}

export const ALL_STORYBOARD_PLATFORMS: StoryboardGenerationPlatform[] = [
  StoryboardGenerationPlatform.TikTok,
  StoryboardGenerationPlatform.InstagramReels,
  StoryboardGenerationPlatform.Facebook,
  StoryboardGenerationPlatform.YouTubeShorts,
  StoryboardGenerationPlatform.YouTubeLongForm,
  StoryboardGenerationPlatform.WhatsApp,
  StoryboardGenerationPlatform.Website,
  StoryboardGenerationPlatform.Television,
];

export const PLATFORM_CONFIG: Record<
  StoryboardGenerationPlatform,
  { sceneCount: number; totalSeconds: number; aspectRatio: string }
> = {
  [StoryboardGenerationPlatform.TikTok]: { sceneCount: 6, totalSeconds: 45, aspectRatio: "9:16" },
  [StoryboardGenerationPlatform.InstagramReels]: { sceneCount: 7, totalSeconds: 60, aspectRatio: "9:16" },
  [StoryboardGenerationPlatform.Facebook]: { sceneCount: 8, totalSeconds: 90, aspectRatio: "1:1" },
  [StoryboardGenerationPlatform.YouTubeShorts]: { sceneCount: 6, totalSeconds: 50, aspectRatio: "9:16" },
  [StoryboardGenerationPlatform.YouTubeLongForm]: { sceneCount: 10, totalSeconds: 180, aspectRatio: "16:9" },
  [StoryboardGenerationPlatform.WhatsApp]: { sceneCount: 5, totalSeconds: 45, aspectRatio: "9:16" },
  [StoryboardGenerationPlatform.Website]: { sceneCount: 8, totalSeconds: 90, aspectRatio: "16:9" },
  [StoryboardGenerationPlatform.Television]: { sceneCount: 12, totalSeconds: 30, aspectRatio: "16:9" },
};

export type { CreativePlatform, CreativeDirectionStyle, MarketingObjective };
