/**
 * Image-to-video provider contract.
 * Exact Product Mode continues to use FFmpeg still-to-video.
 * Cinematic mode uses Admin-routed VIDEO_IMAGE_TO_VIDEO when configured.
 */

export type VideoGenerationProviderStatus =
  | "UNAVAILABLE"
  | "CONFIGURED"
  | "STARTING"
  | "READY"
  | "ERROR";

export interface VideoGenerationIdentityConstraints {
  protectedAttributes?: string[];
  allowedCreativeChanges?: string[];
  productName?: string;
  category?: string;
  colors?: string[];
  materials?: string[];
  distinctiveDetails?: string[];
}

export interface VideoGenerationJobRequest {
  projectId: string;
  sceneId: string;
  sourceAssetId: string;
  sourceImagePath: string;
  durationSeconds: number;
  motionHint?: string;
  cameraHint?: string;
  purpose?: string;
  atmosphere?: string;
  lighting?: string;
  background?: string;
  visualDescription?: string;
  aspectRatio?: string;
  resolution?: string;
  prompt?: string;
  negativePrompt?: string;
  /** Server path for the derived MP4 (never overwrites original product assets). */
  outputPath?: string;
  identityConstraints?: VideoGenerationIdentityConstraints | null;
  attempt?: number;
}

export interface VideoGenerationJobHandle {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  outputPath?: string;
  error?: string;
}

export interface VideoGenerationProvider {
  readonly id: string;
  readonly status: VideoGenerationProviderStatus;
  isAvailable(): Promise<boolean>;
  generateMotion?(request: VideoGenerationJobRequest): Promise<VideoGenerationJobHandle>;
  generateVideoClip?(request: VideoGenerationJobRequest): Promise<VideoGenerationJobHandle>;
  checkJob?(jobId: string): Promise<VideoGenerationJobHandle>;
  retrieveOutput?(jobId: string): Promise<{ path: string } | null>;
}

export class UnavailableVideoGenerationProvider implements VideoGenerationProvider {
  readonly id = "unavailable";
  readonly status: VideoGenerationProviderStatus = "UNAVAILABLE";

  async isAvailable(): Promise<boolean> {
    return false;
  }
}

let activeProvider: VideoGenerationProvider = new UnavailableVideoGenerationProvider();

export function setVideoGenerationProvider(provider: VideoGenerationProvider | null): void {
  activeProvider = provider ?? new UnavailableVideoGenerationProvider();
}

export function getVideoGenerationProvider(): VideoGenerationProvider {
  return activeProvider;
}
