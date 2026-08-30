import type { CreativePlan, PlanScene } from "../creative-planning/creative-planning-manager.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import type {
  VideoAspectRatio,
  VideoCameraId,
  VideoMotionId,
  VideoRenderPlan,
  VideoTextLayer,
  VideoTimelineClip,
  VideoTransitionId,
} from "./types.js";

const PREVIEW: Record<VideoAspectRatio, { width: number; height: number }> = {
  "16:9": { width: 640, height: 360 },
  "9:16": { width: 360, height: 640 },
  "1:1": { width: 480, height: 480 },
};

export function aspectFromPlatform(platform?: string): VideoAspectRatio {
  const value = (platform ?? "").toLowerCase();
  if (/tiktok|reel|short|9:16|vertical|instagram/.test(value)) return "9:16";
  if (/square|1:1/.test(value)) return "1:1";
  return "16:9";
}

export function buildRenderPlan(aspect: VideoAspectRatio, durationMs: number, preset: "preview" | "standard" = "preview"): VideoRenderPlan {
  const size = PREVIEW[aspect];
  return {
    width: size.width,
    height: size.height,
    aspectRatio: aspect,
    frameRate: 24,
    durationMs,
    videoCodec: "libx264",
    audioCodec: "none",
    outputFormat: "mp4",
    preset,
  };
}

export function mapCamera(scene: PlanScene): VideoCameraId {
  const text = `${scene.cameraDirection ?? ""} ${scene.camera ?? ""} ${scene.purpose}`.toLowerCase();
  if (/macro|detail|close/.test(text)) return "macro";
  if (/push-in|push in/.test(text)) return "push-in";
  if (/pull-out|pull out|zoom out/.test(text)) return "pull-out";
  if (/orbit/.test(text)) return "orbit";
  if (/top-down|top down/.test(text)) return "top-down";
  if (/side|reveal/.test(text)) return "side";
  if (/wide|hero/.test(text)) return "hero";
  if (/tilt/.test(text)) return "tilt";
  if (/pan/.test(text)) return "pan";
  if (/medium/.test(text)) return "medium";
  return "front";
}

export function mapMotion(camera: VideoCameraId): VideoMotionId {
  switch (camera) {
    case "push-in":
    case "macro":
    case "close-up":
      return "slow-zoom";
    case "pull-out":
    case "wide":
    case "hero":
      return "zoom-out";
    case "side":
    case "reveal":
      return "pan-left";
    case "orbit":
    case "pan":
      return "pan-right";
    case "top-down":
    case "tilt":
      return "pan-down";
    default:
      return "slow-zoom";
  }
}

export function mapSceneMotion(scene: PlanScene, camera: VideoCameraId): VideoMotionId {
  const motion = String(scene.motion ?? scene.animation ?? "").toUpperCase().replace(/[\s-]+/g, "_");
  if (motion === "HOLD" || motion === "STABLE_HOLD") return "hold";
  if (motion.includes("PAN")) return "pan-left";
  if (motion.includes("REVEAL")) return "image-reveal";
  if (motion.includes("ZOOM") || motion.includes("PUSH")) return "slow-zoom";
  return mapMotion(camera);
}

export function mapTransition(value?: string): VideoTransitionId {
  const text = (value ?? "cut").toLowerCase();
  if (/fade|dissolve/.test(text)) return "fade";
  return "cut";
}

export function sceneTextLayers(scene: PlanScene, startMs: number, durationMs: number): VideoTextLayer[] {
  const layers: VideoTextLayer[] = [];
  const add = (content: unknown, kind: VideoTextLayer["kind"], position: VideoTextLayer["position"]) => {
    const value = typeof content === "string" ? content.trim() : "";
    if (!value || value === "[object Object]") return;
    if (kind === "price" && !scene.copy?.priceOffer) return;
    layers.push({
      content: value.slice(0, 80),
      kind,
      startMs,
      durationMs,
      position,
    });
  };
  add(scene.copy?.headline || scene.text, "headline", "top");
  add(scene.copy?.featureText, "feature", "bottom");
  add(scene.copy?.benefitText, "benefit", "bottom");
  add(scene.copy?.supportingText, "supporting", "bottom");
  add(scene.copy?.priceOffer, "price", "bottom");
  add(scene.copy?.callToAction, "cta", "bottom");
  return layers.slice(0, 2);
}

export function originalAssetId(project: CreativeProject, preferred?: string): string | undefined {
  const originals = project.productImages.filter(isOriginalProductImage);
  if (preferred && originals.some((image) => image.id === preferred)) return preferred;
  return originals[0]?.id;
}

export function buildTimelineFromPlan(
  project: CreativeProject,
  plan: CreativePlan,
  options?: { preview?: boolean; existing?: VideoTimelineClip[] },
): VideoTimelineClip[] {
  const originals = project.productImages.filter(isOriginalProductImage);
  if (!originals.length) return [];
  const scenes = [...plan.scenes].sort((a, b) => a.order - b.order);
  const limited = options?.preview ? scenes.slice(0, Math.min(3, scenes.length)) : scenes;
  let cursor = 0;
  return limited.map((scene, index) => {
    const existing = options?.existing?.find((clip) => clip.userEdited && (clip.sceneId === scene.id || clip.order === index + 1));
    const plannedMs = Math.max(800, scene.durationMs ?? Math.round((scene.durationSeconds || 2) * 1000));
    const durationMs = existing?.durationMs ?? plannedMs;
    const previewDuration = options?.preview ? Math.min(durationMs, 2000) : durationMs;
    const assetId = originalAssetId(project, existing?.assetId || scene.assetId) ?? originals[0]!.id;
    const camera = existing?.camera ?? mapCamera(scene);
    const motion = existing?.motion ?? mapSceneMotion(scene, camera);
    const clip: VideoTimelineClip = existing
      ? {
        ...existing,
        order: index + 1,
        assetId,
        startMs: cursor,
        durationMs: previewDuration,
      }
      : {
        id: scene.id,
        sceneId: scene.id,
        order: index + 1,
        purpose: scene.purpose,
        assetId,
        startMs: cursor,
        durationMs: previewDuration,
        layer: "video",
        camera,
        motion,
        lighting: scene.lighting || "Keep lighting consistent with the source photograph.",
        background: "product still",
        transitionIn: mapTransition(scene.transition),
        transitionOut: index === limited.length - 1 ? "fade" : mapTransition(scene.transition),
        text: sceneTextLayers(scene, cursor, previewDuration),
        audioDirection: plan.audioDirection || "No generated audio until an audio provider is configured.",
        userEdited: false,
      };
    cursor += clip.durationMs;
    return clip;
  });
}

export function timelineDurationMs(clips: VideoTimelineClip[]): number {
  return clips.reduce((sum, clip) => sum + clip.durationMs, 0);
}
