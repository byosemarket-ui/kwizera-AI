import type { VideoTextLayer, VideoTimelineClip } from "../video-production/types.js";
import { toLegacyPosition } from "./placement.js";
import type { TextRole, TypographyDecision, TypographyItem } from "./types.js";

function kindFromRole(role: TextRole): VideoTextLayer["kind"] {
  if (role === "price") return "price";
  if (role === "previousPrice") return "price_was";
  if (role === "discount") return "price_save";
  if (role === "cta") return "cta";
  if (role === "benefit") return "benefit";
  if (role === "productFeature") return "feature";
  if (role === "headline" || role === "title" || role === "hook" || role === "productName") return "headline";
  return "supporting";
}

export function typographyItemToLayer(
  item: TypographyItem,
  startMs: number,
  durationMs: number,
): VideoTextLayer {
  return {
    content: item.lines.join(" ").slice(0, 80),
    kind: kindFromRole(item.role),
    startMs,
    durationMs,
    position: toLegacyPosition(item.layout.region),
    typographyRole: item.role,
    typographyRegion: item.layout.region,
  };
}

export function applyTypographyDecisionToTimeline(
  clips: VideoTimelineClip[],
  decision: TypographyDecision,
): VideoTimelineClip[] {
  if (decision.projectId && clips.some((clip) => clip.sceneId) && !decision.scenes.length) {
    return clips;
  }
  return clips.map((clip) => {
    if (clip.userEdited && clip.text.length) return clip;
    const mapped = typographySceneToLayers(decision, clip.sceneId, clip.startMs, clip.durationMs);
    return mapped.length ? { ...clip, text: mapped } : clip;
  });
}

export function publicTypographyDecision(decision: TypographyDecision): TypographyDecision {
  return {
    ...decision,
    scenes: decision.scenes.map((scene) => ({
      ...scene,
      items: scene.items.map((item) => ({
        ...item,
        font: {
          id: item.font.id,
          family: item.font.family,
          style: item.font.style,
          weight: item.font.weight,
          personality: item.font.personality,
        },
      })),
    })),
  };
}

export function typographySceneToLayers(
  decision: TypographyDecision,
  sceneId: string,
  startMs: number,
  durationMs: number,
): VideoTextLayer[] {
  const scene = decision.scenes.find((item) => item.sceneId === sceneId);
  if (!scene) return [];
  return scene.items
    .sort((a, b) => a.hierarchy - b.hierarchy)
    .slice(0, 3)
    .map((item) => typographyItemToLayer(item, startMs, durationMs));
}
