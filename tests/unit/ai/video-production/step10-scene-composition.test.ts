/**
 * STEP 10 — Intelligent visual composition unit tests.
 */
import { describe, expect, it } from "vitest";
import { choosePlacement } from "../../../../ai/typography/placement.js";
import { keepCurrencyWithAmount } from "../../../../ai/typography/price-typography.js";
import {
  applyCompositionToTimeline,
  buildSceneCompositionPlan,
  classifyBias,
  compositionHintForTypography,
  mapProductProtectionToFrame,
  preferredTextSidesForBias,
  regionAwayFromProduct,
  candidateRegionsForSides,
} from "../../../../ai/video-production/scene-composition.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";
import type { TypographyItem } from "../../../../ai/typography/types.js";

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
    cameraPlan: {
      sceneId: "s1",
      assetId: "asset-a",
      mode: "PRODUCT_HERO",
      targetFormat: "9:16",
      cropFocusX: 0.32,
      cropFocusY: 0.48,
      zoomStart: 1,
      zoomEnd: 1.05,
      focusPoint: { x: 0.32, y: 0.48 },
      productVisibilityRequired: true,
      occupancyTarget: 0.5,
      validationStatus: "valid",
      fallbackUsed: false,
      reason: "test",
    },
    motionParams: {
      maxZoom: 1.05,
      focusX: 0.32,
      focusY: 0.48,
      intensity: 0.55,
      directedType: "SUBTLE_PUSH_IN",
      framingBasis: "measured-bbox",
      safetyAdjusted: false,
      fallbackUsed: false,
      cropFocusX: 0.32,
      cropFocusY: 0.48,
    },
    ...overrides,
  };
}

function fakeItem(overrides: Partial<TypographyItem> & { role: TypographyItem["role"]; region: TypographyItem["layout"]["region"] }): TypographyItem {
  return {
    id: overrides.id ?? `item-${overrides.role}`,
    role: overrides.role,
    text: overrides.text ?? "Sample",
    lines: [overrides.text ?? "Sample"],
    font: {
      id: "f1",
      family: "Test",
      style: "regular",
      weight: 400,
      weightName: "regular",
      personality: "modern-clean",
    },
    layout: {
      region: overrides.region,
      normalizedX: overrides.layout?.normalizedX ?? 0.5,
      normalizedY: overrides.layout?.normalizedY ?? 0.12,
      alignment: "center",
    },
    size: { fontSizePx: 32, maxLines: 2, maxWidthPx: 800 },
    visual: {
      color: "#FFFFFF",
      contrastStrategy: "outline",
      contrastRatio: 8,
      readabilityPassed: true,
      ...overrides.visual,
    },
    hierarchy: 1,
    hierarchyLevel: "PRIMARY",
    importanceScore: 90,
    emphasis: [],
    boundingArea: overrides.boundingArea ?? { x: 0.2, y: 0.08, width: 0.6, height: 0.08 },
    confidence: 80,
  };
}

describe("STEP 10 scene composition", () => {
  it("TEST A — product centered: text avoids product area", () => {
    const mapped = mapProductProtectionToFrame({
      protectedBounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      productCenter: { x: 0.5, y: 0.5 },
      cropFocusX: 0.5,
      cropFocusY: 0.5,
      zoomEnd: 1.04,
    });
    expect(mapped.bias).toBe("center");
    const region = choosePlacement({
      role: "headline",
      productCentered: true,
      hierarchy: 1,
      productOccupiedRegion: mapped.frameProtected,
    });
    expect(region).not.toBe("center");
  });

  it("TEST B — product left: text prefers right-side space", () => {
    const mapped = mapProductProtectionToFrame({
      protectedBounds: { x: 0.05, y: 0.2, width: 0.4, height: 0.55 },
      productCenter: { x: 0.25, y: 0.48 },
      cropFocusX: 0.5,
      cropFocusY: 0.5,
      zoomEnd: 1.05,
    });
    expect(mapped.bias).toBe("left");
    const sides = preferredTextSidesForBias(mapped.bias, "HOOK");
    expect(sides).toContain("right");
    const region = choosePlacement({
      role: "headline",
      productCentered: false,
      hierarchy: 1,
      productOccupiedRegion: mapped.frameProtected,
      preferredTextSides: sides,
    });
    expect(["top-right", "center-right", "top-center", "upper-center", "bottom-right"]).toContain(region);
  });

  it("TEST C — product right: text prefers left-side space", () => {
    const mapped = mapProductProtectionToFrame({
      protectedBounds: { x: 0.55, y: 0.2, width: 0.4, height: 0.55 },
      productCenter: { x: 0.75, y: 0.48 },
      cropFocusX: 0.5,
      cropFocusY: 0.5,
    });
    expect(mapped.bias).toBe("right");
    const region = choosePlacement({
      role: "headline",
      productCentered: false,
      hierarchy: 1,
      productOccupiedRegion: mapped.frameProtected,
      preferredTextSides: preferredTextSidesForBias("right", "FEATURE"),
    });
    expect(["top-left", "center-left", "top-center", "upper-center", "bottom-left"]).toContain(region);
  });

  it("TEST D–G — format-aware composition plans", () => {
    for (const format of ["9:16", "16:9", "1:1", "4:5"] as const) {
      const plan = buildSceneCompositionPlan({
        projectId: "p1",
        clip: clip({ purpose: "PRODUCT_REVEAL" }),
        format,
        cameraPlan: {
          ...clip().cameraPlan!,
          targetFormat: format,
          protectedProductBounds: { x: 0.2, y: 0.25, width: 0.5, height: 0.5 },
        } as never,
      });
      expect(plan.format).toBe(format);
      expect(plan.projectId).toBe("p1");
      expect(plan.product.frameProtected.width).toBeGreaterThan(0.2);
    }
  });

  it("TEST H — RWF stays connected", () => {
    expect(keepCurrencyWithAmount("25000 RWF")).toMatch(/RWF/);
    expect(keepCurrencyWithAmount("RWF 25,000")).toMatch(/25/);
  });

  it("TEST I — CTA importance and non-collision with product region", () => {
    const product = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    const region = choosePlacement({
      role: "cta",
      productCentered: true,
      hierarchy: 1,
      productOccupiedRegion: product,
    });
    expect(["bottom-center", "lower-center", "bottom-left", "bottom-right"]).toContain(region);
    const away = regionAwayFromProduct(product, candidateRegionsForSides(["bottom"], "cta"));
    expect(away).toBeTruthy();
  });

  it("TEST J/K — dark/bright regions still produce readable flags in plan", () => {
    const dark = fakeItem({
      role: "headline",
      region: "top-center",
      visual: { color: "#FFFFFF", contrastStrategy: "outline", readabilityPassed: true, contrastRatio: 7 },
    });
    const bright = fakeItem({
      role: "cta",
      region: "bottom-center",
      text: "Shop Now",
      layout: { region: "bottom-center", normalizedX: 0.5, normalizedY: 0.86, alignment: "center" },
      boundingArea: { x: 0.25, y: 0.8, width: 0.5, height: 0.08 },
      visual: { color: "#111111", contrastStrategy: "panel", readabilityPassed: true, contrastRatio: 6 },
    });
    const plan = buildSceneCompositionPlan({
      projectId: "p-contrast",
      clip: clip({ purpose: "CTA" }),
      format: "9:16",
      typographyItems: [dark, bright],
      sourceOccupied: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
    });
    expect(plan.elements.every((e) => e.readabilityPassed !== false)).toBe(true);
  });

  it("TEST L — product collision flagged for critical text over product", () => {
    const bad = fakeItem({
      role: "headline",
      region: "center",
      layout: { region: "center", normalizedX: 0.5, normalizedY: 0.5, alignment: "center" },
      boundingArea: { x: 0.35, y: 0.4, width: 0.3, height: 0.1 },
    });
    const plan = buildSceneCompositionPlan({
      projectId: "p-collide",
      clip: clip({ purpose: "HOOK" }),
      format: "9:16",
      typographyItems: [bad],
      sourceOccupied: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      cameraPlan: {
        ...clip().cameraPlan!,
        cropFocusX: 0.5,
        cropFocusY: 0.5,
        focusPoint: { x: 0.5, y: 0.5 },
      },
    });
    expect(plan.elements[0]!.overlapsProduct).toBe(true);
    expect(plan.compositionValid).toBe(false);
  });

  it("TEST M — multiple text elements tracked without identity leak", () => {
    const items = [
      fakeItem({ role: "headline", region: "top-center", text: "Nyungwe Trail Boot" }),
      fakeItem({
        role: "price",
        region: "bottom-center",
        text: "NOW 89,000 RWF",
        layout: { region: "bottom-center", normalizedX: 0.5, normalizedY: 0.86, alignment: "center" },
        boundingArea: { x: 0.2, y: 0.8, width: 0.6, height: 0.08 },
      }),
      fakeItem({
        role: "cta",
        region: "lower-center",
        text: "Order Now",
        layout: { region: "lower-center", normalizedX: 0.5, normalizedY: 0.72, alignment: "center" },
        boundingArea: { x: 0.25, y: 0.68, width: 0.5, height: 0.08 },
      }),
    ];
    const plan = buildSceneCompositionPlan({
      projectId: "project-A",
      clip: clip({ purpose: "PRICE_OR_OFFER", assetId: "a1" }),
      format: "9:16",
      typographyItems: items,
      sourceOccupied: { x: 0.28, y: 0.28, width: 0.44, height: 0.44 },
    });
    expect(plan.elements).toHaveLength(3);
    expect(plan.projectId).toBe("project-A");
    expect(plan.assetId).toBe("a1");
  });

  it("TEST N — motion-aware protection expands with zoom", () => {
    const still = mapProductProtectionToFrame({
      protectedBounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      cropFocusX: 0.5,
      cropFocusY: 0.5,
      zoomEnd: 1,
      motionAware: true,
    });
    const zoomed = mapProductProtectionToFrame({
      protectedBounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      cropFocusX: 0.5,
      cropFocusY: 0.5,
      zoomEnd: 1.12,
      motionAware: true,
    });
    expect(zoomed.frameProtected.width * zoomed.frameProtected.height)
      .toBeGreaterThanOrEqual(still.frameProtected.width * still.frameProtected.height);
  });

  it("TEST O — multi-project isolation", () => {
    const a = applyCompositionToTimeline({
      projectId: "PA",
      clips: [clip({ assetId: "aa" })],
      format: "9:16",
    });
    const b = applyCompositionToTimeline({
      projectId: "PB",
      clips: [clip({ assetId: "bb", sceneId: "s2", id: "s2" })],
      format: "9:16",
    });
    expect(a.plans[0]!.projectId).toBe("PA");
    expect(b.plans[0]!.projectId).toBe("PB");
    expect(a.plans[0]!.assetId).not.toBe(b.plans[0]!.assetId);
  });

  it("TEST P — invalid composition rejected", () => {
    const plan = buildSceneCompositionPlan({
      projectId: "",
      clip: clip({ sceneId: "", assetId: "" }),
      format: "9:16",
    });
    expect(plan.compositionValid).toBe(false);
    expect(plan.issues.length).toBeGreaterThan(0);
  });

  it("TEST Q — typography placement API reused via composition hint", () => {
    const hint = compositionHintForTypography({
      sourceOccupied: { x: 0.1, y: 0.2, width: 0.35, height: 0.5 },
      cropFocusX: 0.28,
      cropFocusY: 0.45,
      motionMaxZoom: 1.06,
    });
    expect(hint.productOccupiedRegion.width).toBeGreaterThan(0);
    expect(hint.preferredTextSides.length).toBeGreaterThan(0);
    expect(classifyBias(hint.productOccupiedRegion.x + hint.productOccupiedRegion.width / 2, 0.5)).toBeTruthy();
  });

  it("TEST R — motion/camera fields preserved on composition plan", () => {
    const plan = buildSceneCompositionPlan({
      projectId: "p-r",
      clip: clip(),
      format: "9:16",
    });
    expect(plan.product.cameraMode).toBe("PRODUCT_HERO");
    expect(plan.product.motionDirected).toBe("SUBTLE_PUSH_IN");
    expect(plan.product.cropFocusX).toBeCloseTo(0.32, 2);
  });
});
