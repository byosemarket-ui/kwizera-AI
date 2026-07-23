/**
 * KWIZERA AI STUDIO — AI Video Quality Validation Engine types (Step 8L)
 */

import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";

export enum QualityValidationType {
  Standard = "standard",
  PreRender = "pre-render",
  Comprehensive = "comprehensive",
  Combined = "combined",
}

export enum QualityIssueSeverity {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum QualityIssueCategory {
  MissingAsset = "missing-asset",
  BrokenTimeline = "broken-timeline",
  BrokenRelationship = "broken-relationship",
  Visual = "visual",
  Audio = "audio",
  Subtitle = "subtitle",
  Brand = "brand",
  RenderingRisk = "rendering-risk",
  Technical = "technical",
}

export interface QualityValidationProfile {
  validationId: string;
  projectId: string;
  renderPlanId: string;
  productionId: string;
  videoId: string;
  platform: StoryboardGenerationPlatform;
  validationVersion: number;
}

export interface QualityIssue {
  issueId: string;
  category: QualityIssueCategory;
  severity: QualityIssueSeverity;
  message: string;
  repaired: boolean;
}

export interface VideoQualityValidationPlan {
  sceneContinuity: string;
  cameraContinuity: string;
  motionContinuity: string;
  animationContinuity: string;
  transitionConsistency: string;
  visualConsistency: string;
  colorConsistency: string;
  lightingConsistency: string;
  allVisualChecksPassed: boolean;
}

export interface AudioQualityValidationPlan {
  voiceQuality: string;
  musicQuality: string;
  soundEffects: string;
  audioSynchronization: string;
  loudness: string;
  noise: string;
  lipSync: string;
  audioBalance: string;
  allAudioChecksPassed: boolean;
}

export interface TextQualityValidationPlan {
  subtitles: string;
  captions: string;
  typography: string;
  spelling: string;
  timing: string;
  positioning: string;
  readability: string;
  allTextChecksPassed: boolean;
}

export interface BrandQualityValidationPlan {
  logoUsage: string;
  brandColors: string;
  brandTypography: string;
  brandAssets: string;
  marketingConsistency: string;
  campaignConsistency: string;
  allBrandChecksPassed: boolean;
}

export interface PlatformQualityValidationPlan {
  platform: StoryboardGenerationPlatform;
  resolutionReady: boolean;
  aspectRatioReady: boolean;
  durationReady: boolean;
  notes: string[];
}

export interface TechnicalQualityValidationPlan {
  resolution: string;
  aspectRatio: string;
  frameRate: string;
  codec: string;
  bitrate: string;
  colorSpace: string;
  hdrSdr: string;
  audioCodec: string;
  compression: string;
  allTechnicalChecksPassed: boolean;
}

export interface ProductionReadinessValidationPlan {
  storyboardReady: boolean;
  scenePlansReady: boolean;
  cameraPlansReady: boolean;
  motionPlansReady: boolean;
  animationPlansReady: boolean;
  visualEffectsPlansReady: boolean;
  audioSyncPlansReady: boolean;
  marketingPlansReady: boolean;
  productionPlansReady: boolean;
  renderPlansReady: boolean;
  allInputsReady: boolean;
}

export interface QualityDependencyValidationPlan {
  memoryEngine: boolean;
  knowledgeEngine: boolean;
  productIntelligenceEngine: boolean;
  imageIntelligenceEngine: boolean;
  videoIntelligenceEngine: boolean;
  videoGenerationFoundation: boolean;
  storyboardGeneration: boolean;
  sceneGeneration: boolean;
  cameraDirector: boolean;
  motionGeneration: boolean;
  animation: boolean;
  visualEffects: boolean;
  audioSynchronization: boolean;
  marketingVideo: boolean;
  videoProduction: boolean;
  renderingPreparation: boolean;
  allDependenciesReady: boolean;
  missingDependencies: string[];
}

export interface QualityValidationScores {
  overallQualityScore: number;
  visualQualityScore: number;
  audioQualityScore: number;
  motionScore: number;
  animationScore: number;
  cameraScore: number;
  brandConsistencyScore: number;
  platformCompatibilityScore: number;
  renderReadinessScore: number;
  aiConfidenceScore: number;
}

export interface QualityValidationRelationships {
  storyboards: string[];
  productionPlans: string[];
  renderPlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  motionPlans: string[];
  cameraPlans: string[];
  animationPlans: string[];
  visualEffectPlans: string[];
  audioPlans: string[];
  marketingPlans: string[];
  knowledgeRecords: string[];
  scenes: string[];
}

export interface QualityValidationInput {
  storyboardId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  renderPlanId?: string;
  productionId?: string;
  knowledgeRecordIds?: string[];
  platform?: StoryboardGenerationPlatform;
}

export interface QualityValidationRecord {
  validationId: string;
  profile: QualityValidationProfile;
  validationType: QualityValidationType;
  productionReadiness: ProductionReadinessValidationPlan;
  videoQuality: VideoQualityValidationPlan;
  audioQuality: AudioQualityValidationPlan;
  textQuality: TextQualityValidationPlan;
  brandQuality: BrandQualityValidationPlan;
  platformValidations: PlatformQualityValidationPlan[];
  technicalQuality: TechnicalQualityValidationPlan;
  dependencyValidation: QualityDependencyValidationPlan;
  issues: QualityIssue[];
  scores: QualityValidationScores;
  relationships: QualityValidationRelationships;
  recommendations: string[];
  validated: boolean;
  approved: boolean;
  brandConsistent: boolean;
  criticalIssuesResolved: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface QualityValidationResult {
  success: boolean;
  validations?: QualityValidationRecord[];
  record?: QualityValidationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface QualityValidationSearchQuery {
  validationId?: string;
  storyboardId?: string;
  renderPlanId?: string;
  productionId?: string;
  videoId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: StoryboardGenerationPlatform;
  minQualityScore?: number;
  validation?: string;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface VideoQualityValidationEngineStatusReport {
  engineStatus: string;
  visualValidationStatus: string;
  audioValidationStatus: string;
  brandValidationStatus: string;
  validationsGenerated: number;
  averageOverallQualityScore: number;
  averageRenderReadinessScore: number;
  performance: {
    averageValidationMs: number;
    averageSearchMs: number;
    averageRepairMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class VideoQualityValidationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "VideoQualityValidationEngineError";
  }
}

export const QUALITY_PLATFORM_TARGETS: StoryboardGenerationPlatform[] = [
  StoryboardGenerationPlatform.TikTok,
  StoryboardGenerationPlatform.InstagramReels,
  StoryboardGenerationPlatform.Facebook,
  StoryboardGenerationPlatform.YouTubeShorts,
  StoryboardGenerationPlatform.YouTubeLongForm,
  StoryboardGenerationPlatform.Website,
  StoryboardGenerationPlatform.Television,
];

export const PLATFORM_QUALITY_CONFIG: Record<
  StoryboardGenerationPlatform,
  { resolution: string; aspectRatio: string; maxDuration: string }
> = {
  [StoryboardGenerationPlatform.TikTok]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "60s" },
  [StoryboardGenerationPlatform.InstagramReels]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "90s" },
  [StoryboardGenerationPlatform.Facebook]: { resolution: "1080x1080", aspectRatio: "1:1", maxDuration: "120s" },
  [StoryboardGenerationPlatform.YouTubeShorts]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "60s" },
  [StoryboardGenerationPlatform.YouTubeLongForm]: { resolution: "3840x2160", aspectRatio: "16:9", maxDuration: "600s" },
  [StoryboardGenerationPlatform.WhatsApp]: { resolution: "720x1280", aspectRatio: "9:16", maxDuration: "30s" },
  [StoryboardGenerationPlatform.Website]: { resolution: "1920x1080", aspectRatio: "16:9", maxDuration: "120s" },
  [StoryboardGenerationPlatform.Television]: { resolution: "3840x2160", aspectRatio: "16:9", maxDuration: "30s" },
};
