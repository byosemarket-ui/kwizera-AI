/**
 * STEP 2F — Apply director decisions onto existing timeline clips.
 * Does not rewrite storyboard identity/order; adjusts intensity + transitions only.
 */
import type { VideoTimelineClip, VideoTransitionId } from "../video-production/types.js";
import type { AudioVisualCreativePlan, IntensityLevel } from "./types.js";

const INTENSITY_SCALE: Record<IntensityLevel, number> = {
  LOW: 0.55,
  MEDIUM: 0.8,
  HIGH: 1.0,
};

export function applyDirectorPlanToClips(
  clips: VideoTimelineClip[],
  plan: AudioVisualCreativePlan,
): VideoTimelineClip[] {
  return clips.map((clip) => {
    const decision = plan.scenes.find((s) => s.sceneId === clip.sceneId || s.clipId === clip.id);
    if (!decision) return clip;
    const scale = INTENSITY_SCALE[decision.motionIntensity];
    const transitionOut = decision.transitionType as VideoTransitionId;
    const next = { ...clip, transitionOut };
    if (next.motionParams) {
      next.motionParams = {
        ...next.motionParams,
        intensity: Number(Math.min(1, (next.motionParams.intensity ?? 0.7) * scale).toFixed(4)),
        maxZoom: Number((1 + ((next.motionParams.maxZoom ?? 1.08) - 1) * scale).toFixed(4)),
      };
    }
    if (next.motionPlan) {
      next.motionPlan = {
        ...next.motionPlan,
        intensity: next.motionParams?.intensity ?? next.motionPlan.intensity,
        maxZoom: next.motionParams?.maxZoom ?? next.motionPlan.maxZoom,
        transitionOut,
        reason: `${next.motionPlan.reason} | AV Director: ${decision.reasoning}`,
      };
    }
    return next;
  });
}
