/**
 * STEP 9 — Smart Camera, framing & format adaptation unit tests.
 */
import { describe, expect, it } from "vitest";
import { buildFramingInspection } from "../../../../ai/product-asset-preparation/framing.js";
import { stillFilter } from "../../../../ai/video-production/ffmpeg-renderer.js";
import {
  applySmartCameraToTimeline,
  buildSmartCameraPlan,
  chooseSmartCameraMode,
  occupancyTargetFor,
  planAllFormats,
  validateCameraPlanGeometry,
} from "../../../../ai/video-production/smart-camera.js";
import { resolveProductionRenderProfile } from "../../../../ai/video-production/production-render-profile.js";
import { applyMotionDirectionToTimeline } from "../../../../ai/video-production/motion-direction.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";

function clip(overrides: Partial<VideoTimelineClip> = {}): VideoTimelineClip {
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
    motion: "slow-zoom",
    lighting: "studio",
    background: "product still",
    transitionIn: "cut",
    transitionOut: "cut",
    text: [],
    audioDirection: "none",
    ...overrides,
  };
}

describe("STEP 9 smart camera", () => {
  it("TEST A — full product shoe framing keeps protected bounds", () => {
    const framing = buildFramingInspection({
      width: 1200,
      height: 800,
      productBox: { x: 200, y: 250, width: 800, height: 350 },
    });
    const plan = buildSmartCameraPlan({
      projectId: "p-shoe",
      clip: clip({ purpose: "HOOK", imageRole: "HERO_PRODUCT" }),
      aspectRatio: "9:16",
      framingInspection: framing,
      productCategory: "Footwear",
      motionParams: {
        maxZoom: 1.06,
        focusX: 0.5,
        focusY: 0.5,
        intensity: 0.55,
        directedType: "HERO_REVEAL",
        framingBasis: "measured-bbox",
        safetyAdjusted: false,
        fallbackUsed: false,
      },
    });
    expect(plan.mode).toMatch(/PRODUCT_HERO|PRODUCT_REVEAL|FULL_PRODUCT/);
    expect(plan.productVisibilityRequired).toBe(true);
    expect(plan.cropFocusX).toBeGreaterThan(0.2);
    expect(plan.cropFocusX).toBeLessThan(0.8);
    expect(plan.zoomEnd).toBeLessThanOrEqual(framing.formats["9:16"].maxSafeEnlargement + 0.001);
    const geometry = validateCameraPlanGeometry(plan);
    expect(geometry.ok || geometry.issues.every((i) => /clip protected/.test(i))).toBe(true);
  });

  it("TEST B — detail close-up uses intentional focus", () => {
    const framing = buildFramingInspection({
      width: 1000,
      height: 1000,
      productBox: { x: 200, y: 200, width: 600, height: 600 },
    });
    const plan = buildSmartCameraPlan({
      clip: clip({ purpose: "DETAIL_SCENE", order: 3 }),
      aspectRatio: "1:1",
      framingInspection: framing,
      role: { role: "DETAIL_CLOSE_UP", confidence: 80, safeToUse: true, recommendedUsage: "detail", reason: "t", analysisBasis: "heuristic" },
      motionParams: {
        maxZoom: 1.1,
        focusX: 0.5,
        focusY: 0.5,
        intensity: 0.7,
        directedType: "DETAIL_PUSH",
        framingBasis: "measured-bbox",
        safetyAdjusted: false,
        fallbackUsed: false,
      },
    });
    expect(plan.mode).toBe("DETAIL_CLOSE_UP");
    expect(plan.productVisibilityRequired).toBe(false);
    expect(plan.focusPoint.y).toBeLessThan(0.6);
  });

  it("TEST C–F — each format receives its own composition", () => {
    const framing = buildFramingInspection({
      width: 1600,
      height: 900,
      productBox: { x: 100, y: 150, width: 700, height: 600 },
    });
    const plans = planAllFormats({
      projectId: "p-formats",
      clip: clip({ purpose: "PRODUCT_REVEAL" }),
      framingInspection: framing,
      productCategory: "Footwear",
      motionParams: {
        maxZoom: 1.08,
        focusX: 0.4,
        focusY: 0.45,
        intensity: 0.6,
        directedType: "SUBTLE_PUSH_IN",
        framingBasis: "measured-bbox",
        safetyAdjusted: false,
        fallbackUsed: false,
      },
    });
    expect(plans["9:16"].targetFormat).toBe("9:16");
    expect(plans["16:9"].targetFormat).toBe("16:9");
    expect(plans["1:1"].targetFormat).toBe("1:1");
    expect(plans["4:5"].targetFormat).toBe("4:5");
    // Crop focuses must not all be identical blindly-centered copies when product is off-center.
    const focuses = [plans["9:16"], plans["16:9"], plans["1:1"], plans["4:5"]].map((p) => `${p.cropFocusX}:${p.cropFocusY}:${p.occupancyTarget}`);
    expect(new Set(focuses).size).toBeGreaterThan(1);
    expect(plans["9:16"].occupancyTarget).toBeGreaterThan(plans["16:9"].occupancyTarget);
  });

  it("TEST G — multi-image timeline continuity softens zoom jumps", () => {
    const framing = buildFramingInspection({
      width: 1080,
      height: 1350,
      productBox: { x: 220, y: 280, width: 640, height: 800 },
    });
    const framingByAssetId = new Map([
      ["a", framing],
      ["b", framing],
      ["c", framing],
    ]);
    const directed = applyMotionDirectionToTimeline({
      clips: [
        clip({ purpose: "HOOK", assetId: "a" }),
        clip({ id: "s2", sceneId: "s2", order: 2, purpose: "FEATURE", assetId: "b", startMs: 2500 }),
        clip({ id: "s3", sceneId: "s3", order: 3, purpose: "DETAIL_SCENE", assetId: "c", startMs: 5000 }),
        clip({ id: "s4", sceneId: "s4", order: 4, purpose: "CTA", assetId: "a", startMs: 7500 }),
      ],
      profile: resolveProductionRenderProfile("AI_PRODUCT_MOTION"),
      creativeTone: "Premium",
      aspectRatio: "9:16",
      projectId: "p-multi",
      framingByAssetId,
    });
    const camera = applySmartCameraToTimeline({
      clips: directed.clips,
      profileAspectRatio: "9:16",
      projectId: "p-multi",
      framingByAssetId,
      productCategory: "Footwear",
    });
    expect(camera.plans).toHaveLength(4);
    expect(camera.clips.every((c) => c.cameraPlan?.projectId === "p-multi")).toBe(true);
    expect(camera.clips[0]!.motionParams?.cropFocusX).toBeDefined();
    expect(camera.plans[3]!.mode).toBe("FULL_PRODUCT");
  });

  it("TEST H — typography reserved zones bias crop focus", () => {
    const framing = buildFramingInspection({
      width: 1080,
      height: 1920,
      productBox: { x: 200, y: 100, width: 680, height: 900 },
    });
    const plan = buildSmartCameraPlan({
      clip: clip({ purpose: "HOOK" }),
      aspectRatio: "9:16",
      framingInspection: framing,
    });
    expect(plan.reservedTextZones.top).toBeGreaterThan(0);
    expect(plan.reservedTextZones.bottom).toBeGreaterThan(0);
  });

  it("TEST I — invalid coordinates are corrected", () => {
    const plan = buildSmartCameraPlan({
      clip: clip(),
      aspectRatio: "1:1",
      framingInspection: null,
      motionParams: {
        maxZoom: 9,
        focusX: Number.NaN,
        focusY: -2,
        intensity: 0.5,
        directedType: "PUSH_IN",
        framingBasis: "none",
        safetyAdjusted: false,
        fallbackUsed: true,
      },
    });
    expect(plan.validationStatus === "fallback" || plan.validationStatus === "corrected").toBe(true);
    expect(plan.cropFocusX).toBeGreaterThanOrEqual(0);
    expect(plan.cropFocusX).toBeLessThanOrEqual(1);
    expect(plan.zoomEnd).toBeLessThanOrEqual(1.35);
    expect(validateCameraPlanGeometry(plan).ok).toBe(true);
  });

  it("TEST J — missing bounds uses deterministic fallback", () => {
    const plan = buildSmartCameraPlan({
      clip: clip({ purpose: "FEATURE" }),
      aspectRatio: "16:9",
      framingInspection: null,
    });
    expect(plan.fallbackUsed).toBe(true);
    expect(plan.validationStatus).toBe("fallback");
    expect(plan.cropFocusX).toBeGreaterThanOrEqual(0);
    expect(plan.cropFocusY).toBeLessThanOrEqual(1);
  });

  it("TEST K — project identity stays on camera plans", () => {
    const a = applySmartCameraToTimeline({
      clips: [clip({ assetId: "aa" })],
      profileAspectRatio: "9:16",
      projectId: "project-A",
    });
    const b = applySmartCameraToTimeline({
      clips: [clip({ assetId: "bb" })],
      profileAspectRatio: "9:16",
      projectId: "project-B",
    });
    expect(a.plans[0]!.projectId).toBe("project-A");
    expect(b.plans[0]!.projectId).toBe("project-B");
    expect(a.plans[0]!.assetId).not.toBe(b.plans[0]!.assetId);
  });

  it("FFmpeg stillFilter uses subject-aware crop focus", async () => {
    const vf = await stillFilter(
      {
        imagePath: "C:\\tmp\\x.png",
        clip: {
          ...clip(),
          motionParams: {
            maxZoom: 1.05,
            focusX: 0.42,
            focusY: 0.55,
            intensity: 0.5,
            directedType: "SUBTLE_PUSH_IN",
            framingBasis: "measured-bbox",
            safetyAdjusted: false,
            fallbackUsed: false,
            cropFocusX: 0.31,
            cropFocusY: 0.62,
          },
        },
      },
      {
        width: 1080,
        height: 1920,
        aspectRatio: "9:16",
        frameRate: 24,
        durationMs: 2500,
        videoCodec: "libx264",
        audioCodec: "none",
        outputFormat: "mp4",
        preset: "standard",
      },
      { motion: false, fade: false, text: false },
    );
    expect(vf).toContain("crop=1080:1920:(iw-ow)*0.310:(ih-oh)*0.620");
    expect(vf).not.toMatch(/crop=1080:1920$/);
  });

  it("primary purpose token wins over concatenated beat strings", () => {
    expect(chooseSmartCameraMode({
      purpose: "HOOK|REVEAL|FEATURE|DETAIL|OFFER|CTA",
      order: 1,
      isLast: false,
      role: "HERO_PRODUCT",
    })).toBe("PRODUCT_HERO");
    expect(chooseSmartCameraMode({
      purpose: "FEATURE",
      order: 3,
      isLast: false,
    })).toBe("FEATURE_FOCUS");
  });

  it("mode + occupancy helpers are format aware", () => {
    expect(chooseSmartCameraMode({ purpose: "CTA", order: 5, isLast: true })).toBe("FULL_PRODUCT");
    expect(occupancyTargetFor({ format: "9:16", mode: "PRODUCT_HERO", productCategory: "shoe" }))
      .toBeGreaterThan(occupancyTargetFor({ format: "16:9", mode: "WIDE_CONTEXT" }));
  });
});
