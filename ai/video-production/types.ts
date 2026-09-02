import type { CreativeToneId, ProductionModeId } from "./production-mode-types.js";
import type { OutputQualityGate, QualityReviewResult } from "../ai-director/ai-director-types.js";

export const VIDEO_PRODUCTION_VERSION = "step7-v1";

export type VideoOutputStatus = "CURRENT" | "OUTDATED" | "NONE";
export type VideoPlatformId =
  | "tiktok"
  | "instagram_reels"
  | "instagram_feed"
  | "youtube_shorts"
  | "youtube"
  | "facebook_feed";

export type VideoRenderJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type VideoRenderStage = "queued" | "preparing" | "processing" | "rendering" | "encoding" | "validating" | "registering" | "completed" | "failed";
export type VideoTextOverlayStatus = "applied" | "skipped" | "unavailable" | "failed";
export type VideoKnowledgeStatus = "linked" | "already-linked" | "created" | "unavailable" | "failed" | "empty" | "error";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1";
export type VideoMotionId =
  | "slow-zoom"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "image-reveal"
  | "hold";
export type VideoCameraId =
  | "close-up"
  | "medium"
  | "wide"
  | "hero"
  | "macro"
  | "top-down"
  | "side"
  | "front"
  | "rear"
  | "orbit"
  | "push-in"
  | "pull-out"
  | "pan"
  | "tilt"
  | "reveal";
export type VideoTransitionId = "cut" | "fade";

export interface VideoTextLayer {
  content: string;
  kind: "headline" | "supporting" | "feature" | "benefit" | "cta" | "price" | "price_was" | "price_save";
  startMs: number;
  durationMs: number;
  position: "top" | "bottom" | "center";
}

export interface VideoTimelineClip {
  id: string;
  sceneId: string;
  order: number;
  purpose: string;
  assetId: string;
  imageRole?: string;
  view?: string;
  startMs: number;
  durationMs: number;
  layer: "video";
  camera: VideoCameraId;
  motion: VideoMotionId;
  lighting: string;
  background: string;
  transitionIn: VideoTransitionId;
  transitionOut: VideoTransitionId;
  text: VideoTextLayer[];
  audioDirection: string;
  userEdited?: boolean;
}

export interface VideoAudioPlan {
  backgroundMusic: "none";
  voiceover: "none";
  soundEffects: "none";
  status: "UNAVAILABLE" | "planned";
  message: string;
}

export interface VideoRenderPlan {
  width: number;
  height: number;
  aspectRatio: VideoAspectRatio;
  frameRate: 24;
  durationMs: number;
  videoCodec: "libx264";
  audioCodec: "none";
  outputFormat: "mp4";
  preset: "preview" | "standard";
  platform?: VideoPlatformId;
  x264Preset?: "veryfast" | "medium";
  crf?: number;
}

export interface VideoRenderValidation {
  ready: boolean;
  issues: string[];
  warnings: string[];
  platform: VideoPlatformId;
  platformLabel: string;
  aspectRatio: VideoAspectRatio;
  dimensions: string;
  sceneCount: number;
  uniqueAssetCount: number;
  durationMs: number;
  commercial: {
    productName: string | null;
    hasPrice: boolean;
    hasDiscount: boolean;
    hasWebsite: boolean;
    hasCta: boolean;
  };
  outputStatus: VideoOutputStatus;
}

export interface VideoOutputDetails {
  assetId: string;
  url: string;
  mimeType: "video/mp4";
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
  platform?: VideoPlatformId;
  platformLabel?: string;
  preset?: "preview" | "standard";
  renderJobId: string;
  createdAt: string;
  outputStatus: VideoOutputStatus;
  validationStatus: "TECHNICALLY_VALIDATED" | "FAILED" | "NONE";
  validationChecks?: Record<string, boolean>;
  qualityGate?: OutputQualityGate;
  qualityReview?: QualityReviewResult;
  creativePlanId: string;
  creativePlanVersion: number;
  manifestId?: string;
  sceneCount: number;
  sourceAssetIds: string[];
  textOverlay?: VideoTextOverlayStatus;
}

export interface VideoVersion {
  versionId: string;
  renderJobId: string;
  preset: "preview" | "standard";
  platform?: VideoPlatformId;
  creativePlanId: string;
  creativePlanVersion: number;
  manifestId?: string;
  aspectRatio: VideoAspectRatio;
  sceneCount: number;
  durationMs: number;
  sourceFingerprint: string;
  output: VideoOutputAsset;
  createdAt: string;
}

export interface VideoOutputAsset {
  assetId: string;
  mimeType: "video/mp4";
  durationMs: number;
  width: number;
  height: number;
  sizeBytes: number;
  url: string;
  renderJobId: string;
  createdAt: string;
  preset?: "preview" | "standard";
  platform?: VideoPlatformId;
  validationStatus?: "TECHNICALLY_VALIDATED" | "FAILED";
}

export interface VideoRenderJob {
  id: string;
  projectId: string;
  videoProjectId: string;
  status: VideoRenderJobStatus;
  stage?: VideoRenderStage;
  progress: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  errorCode?: string;
  ffmpegExitCode?: number;
  outputPath?: string;
  outputAssetId?: string;
  textOverlay?: VideoTextOverlayStatus;
  preset?: "preview" | "standard";
  sceneIndex?: number;
  sceneCount?: number;
  stageMessage?: string;
}

export interface VideoProject {
  id: string;
  projectId: string;
  productId: string;
  creativePlanId: string;
  creativePlanVersion: number;
  manifestId?: string;
  platform?: VideoPlatformId;
  createdAt: string;
  modifiedAt: string;
  version: number;
  timeline: VideoTimelineClip[];
  timelineMode: "full";
  audioPlan: VideoAudioPlan;
  renderPlan: VideoRenderPlan;
  renderState: VideoRenderJobStatus | "idle";
  activeJobId?: string;
  output?: VideoOutputAsset;
  outputStatus?: VideoOutputStatus;
  outputSourceFingerprint?: string;
  outputValidation?: Record<string, boolean>;
  versions?: VideoVersion[];
  videoGenerationProvider: "UNAVAILABLE";
  videoGenerationProviderMessage: string;
  userEdited?: boolean;
  memoryStatus?: "linked" | "unavailable" | "error";
  memoryMessage?: string;
  knowledgeStatus?: VideoKnowledgeStatus;
  knowledgeMessage?: string;
  foundationKnowledgeIds?: string[];
  textOverlay?: VideoTextOverlayStatus;
  productionMode?: ProductionModeId;
  creativeTone?: CreativeToneId;
  productionRenderLabel?: string;
  qualityGate?: OutputQualityGate;
  qualityReview?: QualityReviewResult;
}

export class VideoProductionError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "VideoProductionError";
  }
}

export interface VideoProductionStore {
  projects: VideoProject[];
  jobs: VideoRenderJob[];
}
