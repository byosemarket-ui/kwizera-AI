/**
 * Maps Step 3 production mode to FFmpeg render behavior.
 * Does not fake unavailable capabilities (e.g. CINEMATIC_3D without a real provider).
 */
import type { ProductionModeId } from "./production-mode-types.js";
import { cinematicProviderConfigured } from "./production-mode-types.js";
import type { VideoMotionId, VideoTimelineClip, VideoTransitionId } from "./types.js";

export interface ProductionRenderProfile {
  mode: ProductionModeId;
  motionStyle: "subtle" | "dynamic";
  preferFadeTransitions: boolean;
  providerHonestLabel: string;
  usesGenerativeVideo: boolean;
}

export function resolveProductionRenderProfile(mode?: ProductionModeId | null): ProductionRenderProfile {
  const resolved = mode ?? "AI_PRODUCT_MOTION";
  if (resolved === "CLASSIC_SHOWCASE") {
    return {
      mode: resolved,
      motionStyle: "subtle",
      preferFadeTransitions: true,
      providerHonestLabel: "Professional photo animation (FFmpeg)",
      usesGenerativeVideo: false,
    };
  }
  if (resolved === "CINEMATIC_3D") {
    const generative = cinematicProviderConfigured();
    return {
      mode: resolved,
      motionStyle: generative ? "dynamic" : "dynamic",
      preferFadeTransitions: true,
      providerHonestLabel: generative
        ? "Cinematic provider configured"
        : "Cinematic 3D unavailable — using professional FFmpeg motion (not synthetic 3D)",
      usesGenerativeVideo: generative,
    };
  }
  return {
    mode: "AI_PRODUCT_MOTION",
    motionStyle: "dynamic",
    preferFadeTransitions: false,
    providerHonestLabel: "AI product motion (FFmpeg still-to-video)",
    usesGenerativeVideo: false,
  };
}

export function applyProductionModeToClip(
  clip: VideoTimelineClip,
  profile: ProductionRenderProfile,
): VideoTimelineClip {
  let motion: VideoMotionId = clip.motion;
  let transitionOut: VideoTransitionId = clip.transitionOut;

  if (profile.preferFadeTransitions && clip.transitionOut === "cut" && clip.order > 1) {
    transitionOut = "fade";
  }

  if (profile.motionStyle === "subtle") {
    if (motion === "pan-left" || motion === "pan-right" || motion === "pan-up" || motion === "pan-down") {
      motion = "slow-zoom";
    }
    if (motion === "image-reveal") motion = "slow-zoom";
    return { ...clip, motion, transitionOut };
  }

  // Dynamic motion — upgrade static holds for commercial pacing.
  if (motion === "hold") {
    const purpose = clip.purpose.toUpperCase();
    if (/HOOK|REVEAL|INTRO/.test(purpose)) motion = "image-reveal";
    else if (/DETAIL|FEATURE|MACRO|CLOSE/.test(purpose)) motion = "slow-zoom";
    else motion = "slow-zoom";
  }
  return { ...clip, motion, transitionOut };
}
