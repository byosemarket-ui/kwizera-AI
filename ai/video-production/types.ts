export const VIDEO_PRODUCTION_VERSION = "step4-v1";

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
  kind: "headline" | "supporting" | "feature" | "benefit" | "cta" | "price";
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
  x264Preset?: "veryfast" | "medium";
  crf?: number;
}

export interface VideoVersion {
  versionId: string;
  renderJobId: string;
  preset: "preview" | "standard";
  creativePlanId: string;
  creativePlanVersion: number;
  manifestId?: string;
  aspectRatio: VideoAspectRatio;
  sceneCount: number;
  durationMs: number;
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
}

export interface VideoProject {
  id: string;
  projectId: string;
  productId: string;
  creativePlanId: string;
  creativePlanVersion: number;
  manifestId?: string;
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
