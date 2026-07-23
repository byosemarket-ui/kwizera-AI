/**
 * KWIZERA AI STUDIO — AI Rendering Preparation Engine types (Step 8K)
 */

import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";

export enum RenderPlanType {
  Standard = "standard",
  PlatformOptimized = "platform-optimized",
  MultiOutput = "multi-output",
  Combined = "combined",
}

export enum RenderOutputPlatform {
  TikTok = "tiktok",
  InstagramReels = "instagram-reels",
  Facebook = "facebook",
  YouTubeShorts = "youtube-shorts",
  YouTubeLongForm = "youtube-long-form",
  WhatsApp = "whatsapp",
  Website = "website",
  Television = "television",
  DigitalSignage = "digital-signage",
}

export interface RenderProfile {
  renderPlanId: string;
  projectId: string;
  productionId: string;
  videoId: string;
  platform: StoryboardGenerationPlatform;
  renderVersion: number;
}

export interface RenderValidationPlan {
  storyboardValidated: boolean;
  sceneGenerationValidated: boolean;
  cameraPlansValidated: boolean;
  motionPlansValidated: boolean;
  animationPlansValidated: boolean;
  visualEffectsPlansValidated: boolean;
  audioSyncValidated: boolean;
  marketingPlansValidated: boolean;
  productionPlansValidated: boolean;
  allValidated: boolean;
  issues: string[];
}

export interface TimelineValidationPlan {
  sceneTimelineValid: boolean;
  cameraTimelineValid: boolean;
  motionTimelineValid: boolean;
  animationTimelineValid: boolean;
  audioTimelineValid: boolean;
  subtitleTimelineValid: boolean;
  effectTimelineValid: boolean;
  renderTimelineValid: boolean;
  sceneTimeline: string[];
  cameraTimeline: string[];
  motionTimeline: string[];
  animationTimeline: string[];
  audioTimeline: string[];
  subtitleTimeline: string[];
  effectTimeline: string[];
  renderTimeline: string[];
  allTimelinesValid: boolean;
}

export interface RenderAssetValidationPlan {
  images: string;
  videos: string;
  logos: string;
  fonts: string;
  music: string;
  voice: string;
  soundEffects: string;
  luts: string;
  motionGraphics: string;
  templates: string;
  captions: string;
  subtitles: string;
  brandAssets: string;
  allAssetsReady: boolean;
}

export interface RenderDependencyValidationPlan {
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
  allDependenciesReady: boolean;
  missingDependencies: string[];
}

export interface RenderSettingsPlan {
  resolution: string;
  aspectRatio: string;
  frameRate: string;
  codec: string;
  bitrate: string;
  hdr: string;
  sdr: string;
  colorSpace: string;
  pixelFormat: string;
  audioCodec: string;
  audioBitrate: string;
  compressionProfile: string;
  keyframeInterval: string;
  renderPriority: string;
}

export interface OutputProfilePlan {
  platform: RenderOutputPlatform;
  resolution: string;
  aspectRatio: string;
  frameRate: string;
  codec: string;
  bitrate: string;
  notes: string[];
}

export interface ResourcePlanningPlan {
  cpuAllocation: string;
  gpuAllocation: string;
  ramAllocation: string;
  storageAllocation: string;
  cacheAllocation: string;
  temporaryFiles: string;
  renderQueue: string;
  parallelRenderingPreparation: string;
}

export interface RenderJobPlan {
  jobId: string;
  renderPlanId: string;
  priority: string;
  status: string;
  outputProfile: RenderOutputPlatform;
  estimatedDuration: string;
}

export interface RenderRecoveryPlan {
  checkpointStrategy: string;
  resumeRendering: string;
  rollback: string;
  automaticRecovery: string;
  failureDetection: string;
  rollbackPoints: string[];
}

export interface RenderingPreparationScores {
  renderReadinessScore: number;
  assetQualityScore: number;
  timelineIntegrityScore: number;
  performanceScore: number;
  platformCompatibilityScore: number;
  aiConfidenceScore: number;
}

export interface RenderingPreparationRelationships {
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

export interface RenderingPreparationInput {
  storyboardId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  productionId?: string;
  knowledgeRecordIds?: string[];
  platform?: StoryboardGenerationPlatform;
}

export interface RenderingPreparationRecord {
  renderPlanId: string;
  profile: RenderProfile;
  planType: RenderPlanType;
  renderValidation: RenderValidationPlan;
  timelineValidation: TimelineValidationPlan;
  assetValidation: RenderAssetValidationPlan;
  dependencyValidation: RenderDependencyValidationPlan;
  renderSettings: RenderSettingsPlan;
  outputProfiles: OutputProfilePlan[];
  resourcePlanning: ResourcePlanningPlan;
  renderJobs: RenderJobPlan[];
  recoveryPlan: RenderRecoveryPlan;
  scores: RenderingPreparationScores;
  relationships: RenderingPreparationRelationships;
  recommendations: string[];
  validated: boolean;
  renderReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface RenderingPreparationResult {
  success: boolean;
  plans?: RenderingPreparationRecord[];
  record?: RenderingPreparationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface RenderingPreparationSearchQuery {
  renderPlanId?: string;
  storyboardId?: string;
  productionId?: string;
  videoId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: StoryboardGenerationPlatform;
  resolution?: string;
  codec?: string;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface RenderingPreparationEngineStatusReport {
  engineStatus: string;
  validationStatus: string;
  resourcePlanningStatus: string;
  timelineStatus: string;
  renderPlansGenerated: number;
  averageRenderReadinessScore: number;
  averageAssetQualityScore: number;
  performance: {
    averagePreparationMs: number;
    averageSearchMs: number;
    averageValidationMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class RenderingPreparationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "RenderingPreparationEngineError";
  }
}

export const RENDER_OUTPUT_PLATFORM_TARGETS: RenderOutputPlatform[] = [
  RenderOutputPlatform.TikTok,
  RenderOutputPlatform.InstagramReels,
  RenderOutputPlatform.Facebook,
  RenderOutputPlatform.YouTubeShorts,
  RenderOutputPlatform.YouTubeLongForm,
  RenderOutputPlatform.WhatsApp,
  RenderOutputPlatform.Website,
  RenderOutputPlatform.Television,
  RenderOutputPlatform.DigitalSignage,
];

export const OUTPUT_PROFILE_CONFIG: Record<
  RenderOutputPlatform,
  { resolution: string; aspectRatio: string; frameRate: string; codec: string; bitrate: string }
> = {
  [RenderOutputPlatform.TikTok]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", codec: "H.264", bitrate: "8-12 Mbps" },
  [RenderOutputPlatform.InstagramReels]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", codec: "H.264", bitrate: "10-15 Mbps" },
  [RenderOutputPlatform.Facebook]: { resolution: "1080x1080", aspectRatio: "1:1", frameRate: "30fps", codec: "H.264", bitrate: "8-10 Mbps" },
  [RenderOutputPlatform.YouTubeShorts]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", codec: "H.264/H.265", bitrate: "12-18 Mbps" },
  [RenderOutputPlatform.YouTubeLongForm]: { resolution: "3840x2160", aspectRatio: "16:9", frameRate: "24/30fps", codec: "H.265", bitrate: "35-45 Mbps" },
  [RenderOutputPlatform.WhatsApp]: { resolution: "720x1280", aspectRatio: "9:16", frameRate: "30fps", codec: "H.264", bitrate: "4-6 Mbps" },
  [RenderOutputPlatform.Website]: { resolution: "1920x1080", aspectRatio: "16:9", frameRate: "30fps", codec: "H.264", bitrate: "10-20 Mbps" },
  [RenderOutputPlatform.Television]: { resolution: "3840x2160", aspectRatio: "16:9", frameRate: "25fps", codec: "ProRes 422 HQ", bitrate: "120 Mbps" },
  [RenderOutputPlatform.DigitalSignage]: { resolution: "3840x2160", aspectRatio: "16:9", frameRate: "60fps", codec: "H.265", bitrate: "25-40 Mbps" },
};

export function mapStoryboardToRenderOutput(platform: StoryboardGenerationPlatform): RenderOutputPlatform {
  const map: Record<StoryboardGenerationPlatform, RenderOutputPlatform> = {
    [StoryboardGenerationPlatform.TikTok]: RenderOutputPlatform.TikTok,
    [StoryboardGenerationPlatform.InstagramReels]: RenderOutputPlatform.InstagramReels,
    [StoryboardGenerationPlatform.Facebook]: RenderOutputPlatform.Facebook,
    [StoryboardGenerationPlatform.YouTubeShorts]: RenderOutputPlatform.YouTubeShorts,
    [StoryboardGenerationPlatform.YouTubeLongForm]: RenderOutputPlatform.YouTubeLongForm,
    [StoryboardGenerationPlatform.WhatsApp]: RenderOutputPlatform.WhatsApp,
    [StoryboardGenerationPlatform.Website]: RenderOutputPlatform.Website,
    [StoryboardGenerationPlatform.Television]: RenderOutputPlatform.Television,
  };
  return map[platform] ?? RenderOutputPlatform.Website;
}
