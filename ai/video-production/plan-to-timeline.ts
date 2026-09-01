import type { CreativePlan, PlanScene } from "../creative-planning/creative-planning-manager.js";
import { buildConfirmedCommercial, priceSceneCopy, type ConfirmedCommercial } from "../creative-planning/commercial.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import { profileForPlatform, type VideoPlatformProfile } from "./platform-profiles.js";
import type {
  VideoAspectRatio,
  VideoCameraId,
  VideoMotionId,
  VideoPlatformId,
  VideoRenderPlan,
  VideoTextLayer,
  VideoTimelineClip,
  VideoTransitionId,
} from "./types.js";

const PREVIEW_SIZE: Record<VideoAspectRatio, { width: number; height: number }> = {
  "16:9": { width: 426, height: 240 },
  "9:16": { width: 240, height: 426 },
  "1:1": { width: 320, height: 320 },
};

const STANDARD_SIZE: Record<VideoAspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

export function aspectFromPlatform(platform?: string): VideoAspectRatio {
  return profileForPlatform(platform).aspectRatio;
}

export function buildRenderPlan(
  aspect: VideoAspectRatio,
  durationMs: number,
  preset: "preview" | "standard" = "preview",
  platform?: VideoPlatformId,
): VideoRenderPlan {
  const profile = platform ? profileForPlatform(platform) : null;
  const size = preset === "standard"
    ? profile
      ? { width: profile.width, height: profile.height }
      : STANDARD_SIZE[aspect]
    : PREVIEW_SIZE[aspect];
  return {
    width: size.width,
    height: size.height,
    aspectRatio: profile?.aspectRatio ?? aspect,
    frameRate: preset === "standard" ? 24 : 15,
    durationMs,
    videoCodec: "libx264",
    audioCodec: "none",
    outputFormat: "mp4",
    preset,
    platform: profile?.id ?? platform,
    x264Preset: preset === "standard" ? "medium" : "ultrafast",
    crf: preset === "standard" ? 23 : 28,
  };
}

export function buildRenderPlanForProfile(
  profile: VideoPlatformProfile,
  durationMs: number,
  preset: "preview" | "standard" = "preview",
): VideoRenderPlan {
  return buildRenderPlan(profile.aspectRatio, durationMs, preset, profile.id);
}

export function mapCamera(scene: PlanScene): VideoCameraId {
  const text = `${scene.cameraDirection ?? ""} ${scene.camera ?? ""} ${scene.purpose} ${scene.view ?? ""}`.toLowerCase();
  if (/macro|detail|close/.test(text)) return "macro";
  if (/push-in|push in|hero/.test(text)) return "push-in";
  if (/pull-out|pull out|zoom out/.test(text)) return "pull-out";
  if (/orbit/.test(text)) return "orbit";
  if (/top-down|top down|top/.test(text)) return "top-down";
  if (/side|left|right/.test(text)) return "side";
  if (/rear|back/.test(text)) return "rear";
  if (/wide|lifestyle/.test(text)) return "wide";
  if (/tilt/.test(text)) return "tilt";
  if (/pan/.test(text)) return "pan";
  if (/medium/.test(text)) return "medium";
  if (/reveal/.test(text)) return "reveal";
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
    case "rear":
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
  if (motion.includes("PAN_LEFT") || motion === "GENTLE_PAN") return "pan-left";
  if (motion.includes("PAN_RIGHT")) return "pan-right";
  if (motion.includes("PAN_UP")) return "pan-up";
  if (motion.includes("PAN_DOWN")) return "pan-down";
  if (motion.includes("REVEAL")) return "image-reveal";
  if (motion.includes("ZOOM") || motion.includes("PUSH") || motion.includes("CLOSE")) return "slow-zoom";
  if (motion.includes("PULL")) return "zoom-out";
  return mapMotion(camera);
}

export function mapTransition(value?: string): VideoTransitionId {
  const text = (value ?? "cut").toLowerCase();
  if (/fade|dissolve/.test(text)) return "fade";
  return "cut";
}

function bottomLineForScene(scene: PlanScene): string {
  const purpose = scene.purpose.toUpperCase();
  if (purpose.includes("PRICE") || purpose.includes("PROMO")) {
    return scene.copy?.priceOffer?.trim() ?? "";
  }
  if (purpose.includes("CTA") || purpose.includes("CALL")) {
    return scene.copy?.callToAction?.trim() ?? scene.copy?.supportingText?.trim() ?? "";
  }
  return (
    scene.copy?.featureText?.trim()
    || scene.copy?.benefitText?.trim()
    || scene.copy?.supportingText?.trim()
    || scene.copy?.priceOffer?.trim()
    || scene.copy?.callToAction?.trim()
    || ""
  );
}

export function sceneTextLayers(
  scene: PlanScene,
  startMs: number,
  durationMs: number,
  commercial?: ConfirmedCommercial,
): VideoTextLayer[] {
  const layers: VideoTextLayer[] = [];
  const purpose = scene.purpose.toUpperCase();
  if (/price|promo|offer/i.test(purpose) && commercial) {
    const price = priceSceneCopy(commercial);
    if (price.oldPrice) {
      layers.push({ content: `WAS ${price.oldPrice}`.slice(0, 80), kind: "price_was", startMs, durationMs, position: "bottom" });
    }
    if (price.newPrice) {
      layers.push({ content: `NOW ${price.newPrice}`.slice(0, 80), kind: "price", startMs, durationMs, position: "bottom" });
    } else if (scene.copy?.priceOffer?.trim()) {
      layers.push({ content: scene.copy.priceOffer.trim().slice(0, 80), kind: "price", startMs, durationMs, position: "bottom" });
    }
    if (price.saveLabel) {
      layers.push({ content: price.saveLabel.slice(0, 80), kind: "price_save", startMs, durationMs, position: "bottom" });
    }
    if (layers.length) return layers.slice(0, 3);
  }
  const headline = typeof scene.copy?.headline === "string"
    ? scene.copy.headline.trim()
    : typeof scene.text === "string"
      ? scene.text.trim()
      : "";
  if (headline && headline !== "[object Object]") {
    layers.push({
      content: headline.slice(0, 80),
      kind: "headline",
      startMs,
      durationMs,
      position: "top",
    });
  }
  const bottom = bottomLineForScene(scene);
  if (bottom && bottom !== "[object Object]") {
    const kind = /price|promo/i.test(scene.purpose) ? "price" : /cta|call/i.test(scene.purpose) ? "cta" : "supporting";
    layers.push({
      content: bottom.slice(0, 80),
      kind,
      startMs,
      durationMs,
      position: "bottom",
    });
  }
  return layers.slice(0, 3);
}

export function originalAssetId(project: CreativeProject, preferred?: string, sceneIndex = 0): string | undefined {
  const originals = project.productImages.filter(isOriginalProductImage);
  if (!originals.length) return undefined;
  if (preferred && originals.some((image) => image.id === preferred)) return preferred;
  return originals[sceneIndex % originals.length]?.id;
}

/** Rebind creative plan scenes to current project originals when stored asset IDs are stale. */
export function rebindCreativePlanScenes<T extends { scenes: Array<{ assetId?: string; order: number }> }>(
  project: CreativeProject,
  plan: T,
): T {
  const originals = project.productImages.filter(isOriginalProductImage);
  if (!originals.length) return plan;
  const originalIds = new Set(originals.map((image) => image.id));
  let changed = false;
  const scenes = [...plan.scenes]
    .sort((a, b) => a.order - b.order)
    .map((scene, index) => {
      if (scene.assetId && originalIds.has(scene.assetId)) return scene;
      const nextId = originals[index % originals.length]!.id;
      if (scene.assetId !== nextId) changed = true;
      return { ...scene, assetId: nextId };
    });
  return changed ? { ...plan, scenes } : plan;
}

export function buildTimelineFromPlan(
  project: CreativeProject,
  plan: CreativePlan,
  options?: { existing?: VideoTimelineClip[] },
): VideoTimelineClip[] {
  const originals = project.productImages.filter(isOriginalProductImage);
  if (!originals.length) return [];
  const commercial = buildConfirmedCommercial({
    productName: project.productInformation?.name ?? project.productInformation?.title ?? project.name,
    currentPrice: project.productInformation?.price ?? project.productInformation?.currentPrice,
    originalPrice: project.productInformation?.originalPrice ?? project.productInformation?.oldPrice,
    currency: project.productInformation?.currency,
    website: project.productInformation?.website,
    phone: project.productInformation?.phone ?? project.productInformation?.contact,
    email: project.productInformation?.email,
    cta: project.productInformation?.callToAction ?? project.productInformation?.cta,
  });
  const scenes = [...plan.scenes].sort((a, b) => a.order - b.order);
  let cursor = 0;
  return scenes.map((scene, index) => {
    const existing = options?.existing?.find((clip) => clip.userEdited && clip.sceneId === scene.id);
    const plannedMs = Math.max(800, scene.durationMs ?? Math.round((scene.durationSeconds || 2) * 1000));
    const durationMs = existing?.durationMs ?? plannedMs;
    const assetId = originalAssetId(project, existing?.assetId || scene.assetId, index) ?? originals[0]!.id;
    const camera = existing?.camera ?? mapCamera(scene);
    const motion = existing?.motion ?? mapSceneMotion(scene, camera);
    const clip: VideoTimelineClip = existing
      ? {
        ...existing,
        order: index + 1,
        purpose: scene.purpose,
        assetId,
        imageRole: scene.imageRole ?? scene.view ?? existing.imageRole,
        view: scene.view ?? existing.view,
        startMs: cursor,
        durationMs,
        text: existing.userEdited && existing.text.length ? existing.text : sceneTextLayers(scene, cursor, durationMs, commercial),
      }
      : {
        id: scene.id,
        sceneId: scene.id,
        order: index + 1,
        purpose: scene.purpose,
        assetId,
        imageRole: scene.imageRole ?? scene.view,
        view: scene.view,
        startMs: cursor,
        durationMs,
        layer: "video",
        camera,
        motion,
        lighting: scene.lighting || "Keep lighting consistent with the source photograph.",
        background: "product still",
        transitionIn: mapTransition(scene.transition),
        transitionOut: index === scenes.length - 1 ? "fade" : mapTransition(scene.transition),
        text: sceneTextLayers(scene, cursor, durationMs, commercial),
        audioDirection: plan.audioDirection || "No generated audio until an audio provider is configured.",
        userEdited: false,
      };
    cursor += clip.durationMs;
    return clip;
  });
}

/** Preview renders use a subset of the approved timeline without mutating stored clips. */
export function sliceTimelineForRender(
  clips: VideoTimelineClip[],
  preset: "preview" | "standard",
): VideoTimelineClip[] {
  if (preset === "standard") return clips;
  const limited = clips.slice(0, Math.min(2, clips.length));
  let cursor = 0;
  return limited.map((clip) => {
    const durationMs = Math.min(clip.durationMs, 2000);
    const next = { ...clip, startMs: cursor, durationMs };
    cursor += durationMs;
    return next;
  });
}

export function timelineDurationMs(clips: VideoTimelineClip[]): number {
  return clips.reduce((sum, clip) => sum + clip.durationMs, 0);
}
