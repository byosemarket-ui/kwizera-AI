/**
 * STEP 8 — ENGINE 1 acceptance unit checks (mode identity + progress honesty helpers).
 */
import { describe, expect, it } from "vitest";
import { resolveProductionRenderProfile } from "../../../../ai/video-production/production-render-profile.js";
import { displayProductionProgress } from "../../../../desktop/final-review/final-review-engine.js";
import { applyMotionDirectionToTimeline } from "../../../../ai/video-production/motion-direction.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";

describe("STEP 8 ENGINE 1 acceptance foundations", () => {
  it("AI_PRODUCT_MOTION profile is distinct from CLASSIC_SHOWCASE", () => {
    const motion = resolveProductionRenderProfile("AI_PRODUCT_MOTION");
    const classic = resolveProductionRenderProfile("CLASSIC_SHOWCASE");
    expect(motion.mode).toBe("AI_PRODUCT_MOTION");
    expect(motion.motionStyle).toBe("dynamic");
    expect(motion.providerHonestLabel).toMatch(/AI product motion/i);
    expect(classic.motionStyle).toBe("subtle");
    expect(classic.providerHonestLabel).not.toBe(motion.providerHonestLabel);
  });

  it("progress never reports 100 before verified output", () => {
    expect(displayProductionProgress({
      verified: false,
      uiStage: "rendering",
      jobProgress: 100,
      localProgress: 100,
    })).toBeLessThan(100);
    expect(displayProductionProgress({
      verified: false,
      uiStage: "awaiting-output",
      jobProgress: 100,
      localProgress: 90,
    })).toBeLessThanOrEqual(95);
    expect(displayProductionProgress({
      verified: true,
      uiStage: "completed",
      jobProgress: 100,
      localProgress: 100,
    })).toBe(100);
  });

  it("ENGINE 1 timeline receives directed motion plans", () => {
    const clips: VideoTimelineClip[] = [
      {
        id: "1", sceneId: "1", order: 1, purpose: "HOOK", assetId: "a",
        startMs: 0, durationMs: 2500, layer: "video", camera: "front", motion: "hold",
        lighting: "", background: "", transitionIn: "cut", transitionOut: "cut", text: [], audioDirection: "",
      },
      {
        id: "2", sceneId: "2", order: 2, purpose: "CTA", assetId: "a",
        startMs: 2500, durationMs: 2500, layer: "video", camera: "front", motion: "slow-zoom",
        lighting: "", background: "", transitionIn: "cut", transitionOut: "cut", text: [], audioDirection: "",
      },
    ];
    const directed = applyMotionDirectionToTimeline({
      clips,
      profile: resolveProductionRenderProfile("AI_PRODUCT_MOTION"),
      creativeTone: "Premium",
      aspectRatio: "9:16",
      projectId: "p1",
    });
    expect(directed.clips.every((c) => c.motionPlan && c.motionParams)).toBe(true);
    expect(directed.clips[1]!.motion).toBe("hold");
  });
});
