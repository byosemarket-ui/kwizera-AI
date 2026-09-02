/**
 * Future image-to-video provider contract.
 * FFmpeg remains the active production renderer until a real provider is configured.
 * Do not fake generative video support.
 */

export type VideoGenerationProviderStatus =
  | "UNAVAILABLE"
  | "CONFIGURED"
  | "STARTING"
  | "READY"
  | "ERROR";

export interface VideoGenerationJobRequest {
  projectId: string;
  sceneId: string;
  sourceAssetId: string;
  sourceImagePath: string;
  durationSeconds: number;
  motionHint?: string;
  cameraHint?: string;
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
