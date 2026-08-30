import { createHash } from "node:crypto";
import type { VideoOutputStatus, VideoProject, VideoTimelineClip } from "./types.js";

export function timelineFingerprint(video: Pick<VideoProject, "timeline" | "renderPlan" | "creativePlanVersion" | "platform">): string {
  const payload = {
    creativePlanVersion: video.creativePlanVersion,
    platform: video.platform ?? null,
    aspect: video.renderPlan.aspectRatio,
    clips: video.timeline.map((clip) => ({
      sceneId: clip.sceneId,
      order: clip.order,
      assetId: clip.assetId,
      durationMs: clip.durationMs,
      camera: clip.camera,
      motion: clip.motion,
      text: clip.text.map((layer) => `${layer.kind}:${layer.content}`),
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function computeOutputStatus(video: VideoProject, sourceFingerprint?: string): VideoOutputStatus {
  if (!video.output) return "NONE";
  const current = timelineFingerprint(video);
  const rendered = sourceFingerprint ?? video.outputSourceFingerprint;
  if (!rendered) return "OUTDATED";
  return rendered === current ? "CURRENT" : "OUTDATED";
}

export function uniqueAssetIds(clips: VideoTimelineClip[]): string[] {
  return [...new Set(clips.map((clip) => clip.assetId).filter(Boolean))];
}
