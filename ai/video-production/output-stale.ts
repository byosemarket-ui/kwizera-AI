import { createHash } from "node:crypto";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
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

export function listOriginalAssetIds(images: Array<Parameters<typeof isOriginalProductImage>[0] & { id: string }>): string[] {
  return images.filter(isOriginalProductImage).map((image) => image.id);
}

export function timelineUsesStaleAssets(
  images: Parameters<typeof listOriginalAssetIds>[0],
  timeline: VideoTimelineClip[],
): boolean {
  const originalIds = new Set(listOriginalAssetIds(images));
  if (!originalIds.size) return timeline.length > 0;
  return timeline.some((clip) => !originalIds.has(clip.assetId));
}
