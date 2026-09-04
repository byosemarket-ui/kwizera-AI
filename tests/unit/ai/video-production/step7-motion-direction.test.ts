/**
 * STEP 7 — intelligent camera / motion direction tests.
 */
import { describe, expect, it } from "vitest";
import { buildFramingInspection } from "../../../../ai/product-asset-preparation/framing.js";
import { buildZoompanFilter } from "../../../../ai/video-production/ffmpeg-renderer.js";
import {
  applyMotionDirectionToTimeline,
  chooseDirectedMotion,
  computeSafeMotionParams,
  directClipMotion,
  mapDirectedToVideoMotion,
  toneMotionPolicy,
} from "../../../../ai/video-production/motion-direction.js";
import { resolveProductionRenderProfile } from "../../../../ai/video-production/production-render-profile.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";

function baseClip(overrides: Partial<VideoTimelineClip> = {}): VideoTimelineClip {
  return {
    id: "s1",
    sceneId: "s1",
    order: 1,
    purpose: "HOOK",
    assetId: "asset-a",
    startMs: 0,
    durationMs: 2500,
    layer: "video",
    camera: "front",
    motion: "hold",
    lighting: "studio",
    background: "product still",
    transitionIn: "cut",
    transitionOut: "cut",
    text: [],
    audioDirection: "none",
    ...overrides,
  };
}

describe("STEP 7 motion direction", () => {
  it("maps directed vocabulary onto existing VideoMotionId", () => {
    expect(mapDirectedToVideoMotion("HERO_REVEAL")).toBe("image-reveal");
    expect(mapDirectedToVideoMotion("STABLE_HOLD")).toBe("hold");
    expect(mapDirectedToVideoMotion("DETAIL_PUSH")).toBe("slow-zoom");
    expect(mapDirectedToVideoMotion("PAN_LEFT")).toBe("pan-left");
  });

  it("TEST portrait/landscape framing yields format-aware safe zoom", () => {
    const portrait = buildFramingInspection({
      width: 1080,
      height: 1920,
      productBox: { x: 200, y: 400, width: 680, height: 900 },
    });
    const landscape = buildFramingInspection({
      width: 1920,
      height: 1080,
      productBox: { x: 400, y: 200, width: 1100, height: 700 },
    });
    expect(portrait.formats["9:16"].maxSafeEnlargement).toBeGreaterThan(1);
    expect(landscape.formats["16:9"].recommendedCrop.width).toBeGreaterThan(0);
    expect(portrait.formats["9:16"].protectedProductArea.width).toBeGreaterThan(0);
  });

  it("TEST tightly cropped product forces stable hold", () => {
    const framing = buildFramingInspection({
      width: 800,
      height: 800,
      productBox: { x: 10, y: 10, width: 780, height: 780 },
      visibilityCutoff: true,
    });
    const chosen = chooseDirectedMotion({
      purpose: "HERO",
      role: "HERO_PRODUCT",
      framing: framing.formats["1:1"],
      tone: toneMotionPolicy("Modern"),
      profile: resolveProductionRenderProfile("AI_PRODUCT_MOTION"),
      order: 1,
      isLast: false,
    });
    expect(chosen.directed === "STABLE_HOLD" || chosen.directed === "SUBTLE_PUSH_IN").toBe(true);
  });

  it("TEST centered vs off-center influences pan choice", () => {
    const off = buildFramingInspection({
      width: 1000,
      height: 1000,
      productBox: { x: 50, y: 300, width: 300, height: 400 },
    });
    const chosen = chooseDirectedMotion({
      purpose: "FEATURE",
      role: "ALTERNATE_ANGLE",
      framing: off.formats["1:1"],
      tone: toneMotionPolicy("Modern"),
      profile: resolveProductionRenderProfile("AI_PRODUCT_MOTION"),
      order: 2,
      isLast: false,
    });
    expect(["PAN_LEFT", "PAN_RIGHT", "PAN_UP", "PAN_DOWN", "PRODUCT_FOCUS", "SUBTLE_PUSH_IN", "DETAIL_PUSH"]).toContain(chosen.directed);
  });

  it("TEST safe zoom clamps to framing maxSafeEnlargement", () => {
    const framing = buildFramingInspection({
      width: 640,
      height: 640,
      productBox: { x: 80, y: 80, width: 480, height: 480 },
      visibilityCutoff: true,
    });
    const params = computeSafeMotionParams({
      directed: "PUSH_IN",
      tone: toneMotionPolicy("Energetic"),
      framing: framing.formats["1:1"],
      durationMs: 3000,
    });
    expect(params.maxZoom).toBeLessThanOrEqual(framing.formats["1:1"].maxSafeEnlargement + 0.001);
    expect(params.maxZoom).toBeLessThanOrEqual(1.1);
  });

  it("TEST luxury vs energetic tone policies differ", () => {
    const luxury = toneMotionPolicy("Luxury");
    const energetic = toneMotionPolicy("Energetic");
    expect(luxury.preferredMaxZoom).toBeLessThan(energetic.preferredMaxZoom);
    expect(luxury.intensity).toBeLessThan(energetic.intensity);
    expect(luxury.preferStable).toBe(true);
    expect(energetic.allowPan).toBe(true);
  });

  it("TEST motion continuity avoids reversing pan", () => {
    const framing = buildFramingInspection({
      width: 1200,
      height: 800,
      productBox: { x: 100, y: 150, width: 500, height: 500 },
    });
    const chosen = chooseDirectedMotion({
      purpose: "FEATURE",
      role: "ALTERNATE_ANGLE",
      framing: framing.formats["16:9"],
      tone: toneMotionPolicy("Modern"),
      profile: resolveProductionRenderProfile("AI_PRODUCT_MOTION"),
      previousMotion: "pan-left",
      order: 3,
      isLast: false,
    });
    expect(chosen.directed).not.toBe("PAN_RIGHT");
    expect(mapDirectedToVideoMotion(chosen.directed)).not.toBe("pan-right");
  });

  it("TEST one-image and multi-image timelines receive directed motion", () => {
    const profile = resolveProductionRenderProfile("AI_PRODUCT_MOTION");
    const one = applyMotionDirectionToTimeline({
      clips: [baseClip({ purpose: "HOOK" }), baseClip({ id: "s2", sceneId: "s2", order: 2, purpose: "CTA", startMs: 2500 })],
      profile,
      creativeTone: "Premium",
      aspectRatio: "9:16",
      projectId: "p1",
    });
    expect(one.clips).toHaveLength(2);
    expect(one.clips[0]!.motionPlan?.directedType).toBeTruthy();
    expect(one.clips[1]!.motion).toBe("hold");
    expect(one.clips[0]!.motionParams?.maxZoom).toBeGreaterThanOrEqual(1);

    const multi = applyMotionDirectionToTimeline({
      clips: [
        baseClip({ purpose: "HOOK", assetId: "a" }),
        baseClip({ id: "s2", sceneId: "s2", order: 2, purpose: "DETAIL", assetId: "b", startMs: 2500 }),
        baseClip({ id: "s3", sceneId: "s3", order: 3, purpose: "FEATURE", assetId: "c", startMs: 5000 }),
        baseClip({ id: "s4", sceneId: "s4", order: 4, purpose: "CTA", assetId: "a", startMs: 7500 }),
      ],
      profile,
      creativeTone: "Energetic",
      aspectRatio: "9:16",
      projectId: "p2",
      roleByAssetId: new Map([
        ["a", { role: "HERO_PRODUCT", confidence: 80, safeToUse: true, recommendedUsage: "hero", reason: "t", analysisBasis: "heuristic" }],
        ["b", { role: "DETAIL_CLOSE_UP", confidence: 75, safeToUse: true, recommendedUsage: "detail", reason: "t", analysisBasis: "heuristic" }],
      ]),
    });
    expect(multi.diagnostics).toHaveLength(4);
    expect(multi.clips[0]!.motionPlan?.directedType).toMatch(/HERO_REVEAL|SUBTLE_PUSH_IN|STABLE_HOLD/);
    expect(multi.clips[1]!.motionPlan?.directedType).toBe("DETAIL_PUSH");
    expect(multi.clips[3]!.motion).toBe("hold");
  });

  it("TEST fallback when framing unavailable stays conservative", () => {
    const result = directClipMotion({
      clip: baseClip({ purpose: "FEATURE" }),
      profile: resolveProductionRenderProfile("AI_PRODUCT_MOTION"),
      creativeTone: "Minimal",
      aspectRatio: "9:16",
      framingInspection: null,
      isLast: false,
    });
    expect(result.diagnostics.fallbackUsed).toBe(true);
    expect(result.clip.motionParams!.maxZoom).toBeLessThanOrEqual(1.08);
  });

  it("TEST renderer zoompan receives maxZoom and focus", () => {
    const filter = buildZoompanFilter("slow-zoom", 48, 1080, 1920, {
      maxZoom: 1.05,
      focusX: 0.42,
      focusY: 0.55,
      intensity: 0.5,
    });
    expect(filter).toContain("zoompan=");
    expect(filter).toContain("1.05");
    expect(filter).toContain("0.420");
    expect(filter).toContain("0.550");
  });

  it("TEST classic subtle profile softens pans after direction", () => {
    const framing = buildFramingInspection({
      width: 1200,
      height: 800,
      productBox: { x: 50, y: 200, width: 400, height: 400 },
    });
    const result = directClipMotion({
      clip: baseClip({ purpose: "FEATURE", imageRole: "ALTERNATE_ANGLE" }),
      profile: resolveProductionRenderProfile("CLASSIC_SHOWCASE"),
      creativeTone: "Modern",
      aspectRatio: "16:9",
      framingInspection: framing,
      isLast: false,
    });
    expect(result.clip.motion === "slow-zoom" || result.clip.motion === "hold").toBe(true);
  });

  it("TEST 9:16 opening prefers hero reveal / push", () => {
    const result = directClipMotion({
      clip: baseClip({ purpose: "HOOK", order: 1 }),
      profile: resolveProductionRenderProfile("AI_PRODUCT_MOTION"),
      creativeTone: "Modern",
      aspectRatio: "9:16",
      role: { role: "HERO_PRODUCT", confidence: 90, safeToUse: true, recommendedUsage: "hero", reason: "front", analysisBasis: "heuristic" },
      framingInspection: buildFramingInspection({
        width: 1080,
        height: 1350,
        productBox: { x: 220, y: 280, width: 640, height: 800 },
      }),
      isLast: false,
    });
    expect(["HERO_REVEAL", "SUBTLE_PUSH_IN", "STABLE_HOLD"]).toContain(result.diagnostics.directedType);
    expect(result.clip.motionParams).toBeTruthy();
  });
});
