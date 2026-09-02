import type {
  VideoAspectRatio,
  VideoCameraId,
  VideoMotionId,
  VideoOutputDetails,
  VideoPlatformId,
  VideoProject,
  VideoRenderJob,
  VideoRenderValidation,
  VideoTransitionId,
} from "../../ai/video-production/types";
import { VIDEO_PLATFORM_OPTIONS } from "../../ai/video-production/platform-profiles.js";

export type {
  VideoAspectRatio,
  VideoCameraId,
  VideoMotionId,
  VideoOutputDetails,
  VideoPlatformId,
  VideoProject,
  VideoRenderJob,
  VideoRenderValidation,
  VideoTimelineClip,
  VideoTransitionId,
} from "../../ai/video-production/types";

export { VIDEO_PLATFORM_OPTIONS };

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${response.status})`);
  return body;
}

export async function getVideoProject(projectId: string): Promise<{ video: VideoProject | null }> {
  const response = await fetch(`/api/video-production/projects/${projectId}`);
  return readJson(response);
}

export async function createVideoProject(projectId: string): Promise<{ video: VideoProject }> {
  const response = await fetch(`/api/video-production/projects/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create" }),
  });
  return readJson(response);
}

export async function updateVideoProject(projectId: string, changes: {
  aspectRatio?: VideoAspectRatio;
  platform?: VideoPlatformId;
  reorder?: string[];
  clip?: {
    id: string;
    durationMs?: number;
    camera?: VideoCameraId;
    motion?: VideoMotionId;
    transitionOut?: VideoTransitionId;
    assetId?: string;
    text?: string;
  };
}): Promise<{ video: VideoProject }> {
  const response = await fetch(`/api/video-production/projects/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", ...changes }),
  });
  return readJson(response);
}

export async function validateVideoRender(
  projectId: string,
  preset: "preview" | "standard" = "standard",
): Promise<{ validation: VideoRenderValidation }> {
  const response = await fetch(`/api/video-production/projects/${projectId}/validate?preset=${preset}`);
  return readJson(response);
}

export async function getVideoOutputDetails(projectId: string): Promise<{ output: VideoOutputDetails }> {
  const response = await fetch(`/api/video-production/projects/${projectId}/output`);
  return readJson(response);
}

export async function startVideoRender(projectId: string, preset: "preview" | "standard" = "preview"): Promise<{ job: VideoRenderJob; video: VideoProject }> {
  const response = await fetch(`/api/video-production/projects/${projectId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  return readJson(response);
}

export async function getVideoJob(projectId: string, jobId: string): Promise<{ job: VideoRenderJob }> {
  const response = await fetch(`/api/video-production/projects/${projectId}/jobs/${jobId}`);
  return readJson(response);
}

export async function getVideoVersions(projectId: string): Promise<{ versions: import("../../ai/video-production/types.js").VideoVersion[] }> {
  const response = await fetch(`/api/video-production/projects/${projectId}/versions`);
  return readJson(response);
}

export const CAMERA_OPTIONS: VideoCameraId[] = [
  "close-up", "medium", "wide", "hero", "macro", "top-down", "side", "front", "rear",
  "orbit", "push-in", "pull-out", "pan", "tilt", "reveal",
];

export const MOTION_OPTIONS: VideoMotionId[] = [
  "slow-zoom", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down", "image-reveal", "hold",
];

export const TRANSITION_OPTIONS: VideoTransitionId[] = ["cut", "fade"];
export const ASPECT_OPTIONS: VideoAspectRatio[] = ["16:9", "9:16", "1:1"];
