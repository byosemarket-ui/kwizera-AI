/**
 * STEP 7 — Intelligent camera / motion direction for AI PRODUCT MOTION.
 * Consumes STEP 6 framing + roles; maps to existing VideoMotionId for FFmpeg zoompan.
 * Does not create a parallel renderer.
 */
import type { CreativeToneId } from "./production-mode-types.js";
import type { ProductionRenderProfile } from "./production-render-profile.js";
import type {
  VideoAspectRatio,
  VideoMotionId,
  VideoTimelineClip,
  VideoTransitionId,
} from "./types.js";
import type { FormatFramingPlan, FramingInspection } from "../product-asset-preparation/framing.js";
import type { ProductionImageRole, ProductionRoleDecision } from "../product-asset-preparation/production-roles.js";

/** Conceptual motion vocabulary (maps onto existing FFmpeg VideoMotionId). */
export type DirectedMotionType =
  | "STATIC"
  | "SUBTLE_PUSH_IN"
  | "PUSH_IN"
  | "SUBTLE_PULL_BACK"
  | "PAN_LEFT"
  | "PAN_RIGHT"
  | "PAN_UP"
  | "PAN_DOWN"
  | "DIAGONAL_DRIFT"
  | "DETAIL_PUSH"
  | "HERO_REVEAL"
  | "PRODUCT_FOCUS"
  | "STABLE_HOLD";

export interface MotionTonePolicy {
  tone: CreativeToneId | "default";
  /** Relative ramp intensity 0.35–1.0 */
  intensity: number;
  /** Soft cap before framing safety clamp */
  preferredMaxZoom: number;
  preferFade: boolean;
  preferStable: boolean;
  allowPan: boolean;
}

export interface MotionRenderParams {
  maxZoom: number;
  /** Normalized 0–1 focus inside the cropped frame (product center). */
  focusX: number;
  focusY: number;
  intensity: number;
  directedType: DirectedMotionType;
  framingBasis: "measured-bbox" | "estimated-center" | "unavailable" | "none";
  safetyAdjusted: boolean;
  fallbackUsed: boolean;
}

export interface ClipMotionDiagnostics {
  sceneId: string;
  projectId?: string;
  assetId: string;
  directedType: DirectedMotionType;
  motionId: VideoMotionId;
  maxZoom: number;
  focusX: number;
  focusY: number;
  intensity: number;
  transitionOut: VideoTransitionId;
  framingBasis: MotionRenderParams["framingBasis"];
  safetyAdjusted: boolean;
  fallbackUsed: boolean;
  reason: string;
  previousMotion?: VideoMotionId;
}

export interface DirectedClipResult {
  clip: VideoTimelineClip & { motionPlan?: ClipMotionDiagnostics; motionParams?: MotionRenderParams };
  diagnostics: ClipMotionDiagnostics;
}

const ASPECT_KEY: Record<VideoAspectRatio, "9:16" | "16:9" | "1:1" | "4:5"> = {
  "9:16": "9:16",
  "16:9": "16:9",
  "1:1": "1:1",
};

export function toneMotionPolicy(tone?: CreativeToneId | null): MotionTonePolicy {
  switch (tone) {
    case "Luxury":
      return { tone, intensity: 0.45, preferredMaxZoom: 1.04, preferFade: true, preferStable: true, allowPan: false };
    case "Minimal":
      return { tone, intensity: 0.4, preferredMaxZoom: 1.04, preferFade: true, preferStable: true, allowPan: false };
    case "Premium":
      return { tone, intensity: 0.55, preferredMaxZoom: 1.06, preferFade: true, preferStable: false, allowPan: true };
    case "Energetic":
      return { tone, intensity: 0.85, preferredMaxZoom: 1.1, preferFade: false, preferStable: false, allowPan: true };
    case "Modern":
      return { tone, intensity: 0.65, preferredMaxZoom: 1.08, preferFade: false, preferStable: false, allowPan: true };
    default:
      return { tone: "default", intensity: 0.6, preferredMaxZoom: 1.08, preferFade: false, preferStable: false, allowPan: true };
  }
}

export function mapDirectedToVideoMotion(directed: DirectedMotionType): VideoMotionId {
  switch (directed) {
    case "STATIC":
    case "STABLE_HOLD":
      return "hold";
    case "SUBTLE_PULL_BACK":
      return "zoom-out";
    case "PAN_LEFT":
      return "pan-left";
    case "PAN_RIGHT":
      return "pan-right";
    case "PAN_UP":
      return "pan-up";
    case "PAN_DOWN":
      return "pan-down";
    case "DIAGONAL_DRIFT":
      return "pan-right";
    case "HERO_REVEAL":
      return "image-reveal";
    case "DETAIL_PUSH":
    case "PUSH_IN":
    case "SUBTLE_PUSH_IN":
    case "PRODUCT_FOCUS":
    default:
      return "slow-zoom";
  }
}

export function chooseDirectedMotion(input: {
  purpose: string;
  role?: ProductionImageRole | string | null;
  framing?: FormatFramingPlan | null;
  tone: MotionTonePolicy;
  profile: ProductionRenderProfile;
  previousMotion?: VideoMotionId | null;
  order: number;
  isLast: boolean;
}): { directed: DirectedMotionType; reason: string; fallbackUsed: boolean } {
  const purpose = input.purpose.toUpperCase();
  const role = String(input.role ?? "").toUpperCase();
  const nearEdge = Boolean(input.framing?.preferSafeComposition);
  const maxSafe = input.framing?.maxSafeEnlargement ?? 1.12;
  const tightlyCropped = maxSafe <= 1.06 || nearEdge;
  let fallbackUsed = !input.framing;

  if (input.isLast || /CTA|BRAND|CLOSE|END|COMPANY|CONTACT/.test(purpose)) {
    return { directed: "STABLE_HOLD", reason: "Closing/CTA scene prefers stable hold.", fallbackUsed };
  }

  if (tightlyCropped || input.tone.preferStable) {
    if (/HOOK|REVEAL|INTRO|HERO/.test(purpose) || role === "HERO_PRODUCT") {
      return {
        directed: tightlyCropped ? "STABLE_HOLD" : "SUBTLE_PUSH_IN",
        reason: tightlyCropped
          ? "Tight crop / edge risk — stable hold to protect product."
          : "Stable tone with subtle push for hero/hook.",
        fallbackUsed,
      };
    }
    return {
      directed: "STABLE_HOLD",
      reason: tightlyCropped ? "Product tightly framed — avoid aggressive zoom/pan." : "Tone prefers stable camera.",
      fallbackUsed,
    };
  }

  if (role === "DETAIL_CLOSE_UP" || /DETAIL|FEATURE|MACRO|CLOSE/.test(purpose)) {
    return { directed: "DETAIL_PUSH", reason: "Detail/feature scene uses controlled detail push.", fallbackUsed };
  }

  if (role === "HERO_PRODUCT" || role === "MAIN_REVEAL" || /HOOK|REVEAL|INTRO|HERO/.test(purpose)) {
    return {
      directed: input.order <= 1 ? "HERO_REVEAL" : "SUBTLE_PUSH_IN",
      reason: input.order <= 1 ? "Opening hero reveal for retention." : "Hero/main reveal push-in.",
      fallbackUsed,
    };
  }

  if (role === "WIDE_PRODUCT_VIEW" || /WIDE|LIFESTYLE|CONTEXT/.test(purpose)) {
    return { directed: "SUBTLE_PULL_BACK", reason: "Wide/context view uses subtle pull-back.", fallbackUsed };
  }

  if (input.tone.allowPan && input.profile.motionStyle === "dynamic") {
    const pan = choosePanWithContinuity(input.previousMotion, input.framing);
    if (pan) {
      return { directed: pan.directed, reason: pan.reason, fallbackUsed };
    }
  }

  if (input.profile.motionStyle === "subtle") {
    return { directed: "SUBTLE_PUSH_IN", reason: "Subtle motion profile.", fallbackUsed };
  }

  return { directed: "PRODUCT_FOCUS", reason: "Default product-focus push-in.", fallbackUsed };
}

function choosePanWithContinuity(
  previous?: VideoMotionId | null,
  framing?: FormatFramingPlan | null,
): { directed: DirectedMotionType; reason: string } | null {
  const center = framing?.productCenter;
  const offCenterX = center ? Math.abs(center.x - 0.5) > 0.12 : false;
  const offCenterY = center ? Math.abs(center.y - 0.5) > 0.12 : false;

  if (previous === "pan-left") {
    return { directed: "SUBTLE_PUSH_IN", reason: "Continuity — avoid reversing previous pan-left." };
  }
  if (previous === "pan-right") {
    return { directed: "SUBTLE_PUSH_IN", reason: "Continuity — avoid reversing previous pan-right." };
  }
  if (previous === "pan-up" || previous === "pan-down") {
    return { directed: "SUBTLE_PUSH_IN", reason: "Continuity — avoid reversing vertical pan." };
  }

  if (offCenterX && center) {
    return {
      directed: center.x < 0.5 ? "PAN_RIGHT" : "PAN_LEFT",
      reason: "Pan toward product from off-center composition.",
    };
  }
  if (offCenterY && center) {
    return {
      directed: center.y < 0.5 ? "PAN_DOWN" : "PAN_UP",
      reason: "Vertical pan toward product from off-center composition.",
    };
  }
  return null;
}

export function computeSafeMotionParams(input: {
  directed: DirectedMotionType;
  tone: MotionTonePolicy;
  framing?: FormatFramingPlan | null;
  framingBasis?: MotionRenderParams["framingBasis"];
  durationMs: number;
}): MotionRenderParams {
  const safeMax = input.framing?.maxSafeEnlargement ?? 1.12;
  const preferred = input.tone.preferredMaxZoom;
  let maxZoom = Math.min(preferred, safeMax);
  let safetyAdjusted = maxZoom < preferred;

  // Short scenes and stable holds need less zoom.
  if (input.directed === "STATIC" || input.directed === "STABLE_HOLD") {
    maxZoom = 1;
    safetyAdjusted = safetyAdjusted || preferred > 1;
  } else if (input.directed === "SUBTLE_PUSH_IN" || input.directed === "PRODUCT_FOCUS") {
    maxZoom = Math.min(maxZoom, 1 + (maxZoom - 1) * 0.7);
  } else if (input.directed === "DETAIL_PUSH" || input.directed === "PUSH_IN") {
    maxZoom = Math.min(maxZoom, safeMax);
  } else if (input.directed.startsWith("PAN_") || input.directed === "DIAGONAL_DRIFT") {
    // Pans use a fixed zoom plate — keep within safe enlargement.
    maxZoom = Math.min(Math.max(1.04, maxZoom), safeMax, 1.1);
  } else if (input.directed === "HERO_REVEAL") {
    maxZoom = Math.min(Math.max(1.04, maxZoom), safeMax);
  } else if (input.directed === "SUBTLE_PULL_BACK") {
    maxZoom = Math.min(1.12, safeMax);
  }

  if (input.durationMs < 1200) {
    maxZoom = Math.min(maxZoom, 1.05);
    safetyAdjusted = true;
  }

  const focusX = clamp01(input.framing?.productCenter.x ?? 0.5);
  const focusY = clamp01(input.framing?.productCenter.y ?? 0.5);

  return {
    maxZoom: Number(maxZoom.toFixed(3)),
    focusX: Number(focusX.toFixed(3)),
    focusY: Number(focusY.toFixed(3)),
    intensity: input.tone.intensity,
    directedType: input.directed,
    framingBasis: input.framingBasis ?? (input.framing ? input.framing.analysisBasis : "none"),
    safetyAdjusted,
    fallbackUsed: !input.framing,
  };
}

export function chooseTransitionOut(input: {
  clip: VideoTimelineClip;
  tone: MotionTonePolicy;
  profile: ProductionRenderProfile;
  preferStableFromPrep?: boolean;
  isLast: boolean;
}): VideoTransitionId {
  if (input.isLast) return "fade";
  if (input.tone.preferFade || input.profile.preferFadeTransitions || input.preferStableFromPrep) {
    return "fade";
  }
  if (input.clip.transitionOut === "fade") return "fade";
  // Opening hook: clean cut into next beat often feels stronger for Energetic/Modern.
  if (input.tone.tone === "Energetic" && input.clip.order <= 2) return "cut";
  return input.clip.transitionOut;
}

export function directClipMotion(input: {
  clip: VideoTimelineClip;
  profile: ProductionRenderProfile;
  creativeTone?: CreativeToneId | null;
  aspectRatio: VideoAspectRatio;
  framingInspection?: FramingInspection | null;
  role?: ProductionRoleDecision | null;
  previousMotion?: VideoMotionId | null;
  projectId?: string;
  isLast: boolean;
  userEdited?: boolean;
}): DirectedClipResult {
  if (input.userEdited || input.clip.userEdited) {
    const params: MotionRenderParams = {
      maxZoom: 1.08,
      focusX: 0.5,
      focusY: 0.5,
      intensity: 0.6,
      directedType: "PRODUCT_FOCUS",
      framingBasis: "none",
      safetyAdjusted: false,
      fallbackUsed: true,
    };
    const diagnostics: ClipMotionDiagnostics = {
      sceneId: input.clip.sceneId,
      projectId: input.projectId,
      assetId: input.clip.assetId,
      directedType: "PRODUCT_FOCUS",
      motionId: input.clip.motion,
      maxZoom: params.maxZoom,
      focusX: 0.5,
      focusY: 0.5,
      intensity: 0.6,
      transitionOut: input.clip.transitionOut,
      framingBasis: "none",
      safetyAdjusted: false,
      fallbackUsed: true,
      reason: "User-edited clip — preserve motion choices.",
      previousMotion: input.previousMotion ?? undefined,
    };
    return { clip: { ...input.clip, motionPlan: diagnostics, motionParams: params }, diagnostics };
  }

  const tone = toneMotionPolicy(input.creativeTone);
  const aspectKey = ASPECT_KEY[input.aspectRatio] ?? "9:16";
  const framing = input.framingInspection?.formats[aspectKey]
    ?? input.framingInspection?.formats["9:16"]
    ?? null;
  const chosen = chooseDirectedMotion({
    purpose: input.clip.purpose,
    role: input.role?.role ?? input.clip.imageRole,
    framing,
    tone,
    profile: input.profile,
    previousMotion: input.previousMotion,
    order: input.clip.order,
    isLast: input.isLast,
  });

  const params = computeSafeMotionParams({
    directed: chosen.directed,
    tone,
    framing,
    framingBasis: framing?.analysisBasis ?? (input.framingInspection ? "estimated-center" : "none"),
    durationMs: input.clip.durationMs,
  });

  let motion = mapDirectedToVideoMotion(chosen.directed);
  // Classic subtle profile still softens pans.
  if (input.profile.motionStyle === "subtle" && motion.startsWith("pan-")) {
    motion = "slow-zoom";
    params.maxZoom = Math.min(params.maxZoom, 1.05);
    params.safetyAdjusted = true;
  }

  const transitionOut = chooseTransitionOut({
    clip: input.clip,
    tone,
    profile: input.profile,
    preferStableFromPrep: input.framingInspection?.nearEdge || input.role?.role === "LOW_CONFIDENCE",
    isLast: input.isLast,
  });

  const diagnostics: ClipMotionDiagnostics = {
    sceneId: input.clip.sceneId,
    projectId: input.projectId,
    assetId: input.clip.assetId,
    directedType: chosen.directed,
    motionId: motion,
    maxZoom: params.maxZoom,
    focusX: params.focusX,
    focusY: params.focusY,
    intensity: params.intensity,
    transitionOut,
    framingBasis: params.framingBasis,
    safetyAdjusted: params.safetyAdjusted,
    fallbackUsed: chosen.fallbackUsed || params.fallbackUsed,
    reason: chosen.reason,
    previousMotion: input.previousMotion ?? undefined,
  };

  return {
    clip: {
      ...input.clip,
      motion,
      transitionOut,
      motionPlan: diagnostics,
      motionParams: params,
    },
    diagnostics,
  };
}

/** Apply STEP 7 direction across a timeline (continuity-aware). */
export function applyMotionDirectionToTimeline(input: {
  clips: VideoTimelineClip[];
  profile: ProductionRenderProfile;
  creativeTone?: CreativeToneId | null;
  aspectRatio: VideoAspectRatio;
  projectId?: string;
  framingByAssetId?: Map<string, FramingInspection | null | undefined>;
  roleByAssetId?: Map<string, ProductionRoleDecision | null | undefined>;
}): { clips: Array<VideoTimelineClip & { motionPlan?: ClipMotionDiagnostics; motionParams?: MotionRenderParams }>; diagnostics: ClipMotionDiagnostics[] } {
  const diagnostics: ClipMotionDiagnostics[] = [];
  let previousMotion: VideoMotionId | null = null;
  const clips = input.clips.map((clip, index) => {
    const result = directClipMotion({
      clip,
      profile: input.profile,
      creativeTone: input.creativeTone,
      aspectRatio: input.aspectRatio,
      framingInspection: input.framingByAssetId?.get(clip.assetId) ?? null,
      role: input.roleByAssetId?.get(clip.assetId) ?? null,
      previousMotion,
      projectId: input.projectId,
      isLast: index === input.clips.length - 1,
    });
    previousMotion = result.diagnostics.motionId;
    diagnostics.push(result.diagnostics);
    return result.clip;
  });
  return { clips, diagnostics };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}
