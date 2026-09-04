import type { VideoTextLayer, VideoTextTypography } from "../video-production/types.js";
import { toLegacyPosition } from "./placement.js";
import type { TextRole, TypographyDecision, TypographyItem } from "./types.js";
import type { VideoTimelineClip } from "../video-production/types.js";

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

export function typographyItemToRenderPayload(item: TypographyItem): VideoTextTypography {
  return {
    fontId: item.font.id,
    family: item.font.family,
    fontSizePx: item.size.fontSizePx,
    normalizedX: item.layout.normalizedX,
    normalizedY: item.layout.normalizedY,
    alignment: item.layout.alignment,
    region: item.layout.region,
    color: item.visual.color,
    contrastStrategy: item.visual.contrastStrategy,
    panelColor: item.visual.panelColor,
    contrastRatio: item.visual.contrastRatio,
    readabilityPassed: item.visual.readabilityPassed,
    lines: item.lines.length ? item.lines : [item.text].filter(Boolean),
    hierarchy: item.hierarchy,
    hierarchyLevel: item.hierarchyLevel,
    importanceScore: item.importanceScore,
    weightName: item.font.weightName,
    maxWidthPx: item.size.maxWidthPx,
    emphasis: item.emphasis.map((span) => ({
      text: span.text,
      kind: span.kind,
      strength: span.strength,
    })),
    boundingArea: item.boundingArea,
  };
}

export function typographyItemToLayer(
  item: TypographyItem,
  startMs: number,
  durationMs: number,
): VideoTextLayer {
  const lines = item.lines.length ? item.lines : [item.text];
  return {
    content: lines.join(" ").slice(0, 120),
    kind: kindFromRole(item.role),
    startMs,
    durationMs,
    position: toLegacyPosition(item.layout.region),
    typographyRole: item.role,
    typographyRegion: item.layout.region,
    typography: typographyItemToRenderPayload(item),
  };
}

export function applyTypographyDecisionToTimeline(
  clips: VideoTimelineClip[],
  decision: TypographyDecision,
): VideoTimelineClip[] {
  if (!decision.scenes.length) return clips;
  return clips.map((clip) => {
    if (clip.userEdited && clip.text.length) return clip;
    const mapped = typographySceneToLayers(decision, clip.sceneId, clip.startMs, clip.durationMs);
    return mapped.length ? { ...clip, text: mapped } : clip;
  });
}

/** Strip absolute font paths and local image paths from persisted/API typography plans. */
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
          weightName: item.font.weightName,
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
