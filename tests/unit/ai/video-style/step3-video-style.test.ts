import { describe, expect, it } from "vitest";
import {
  getProductionCapabilities,
  recommendCreativeTone,
  recommendProductionMode,
} from "../../../../ai/video-production/production-capabilities.js";
import {
  buildPlanPreview,
  buildScenePreviews,
  computeReadiness,
  sceneTextPreview,
} from "../../../../desktop/video-style/readiness.js";
import type { CreativePlanDto } from "../../../../desktop/deep-intelligence/live-api.js";

describe("STEP 3 production capabilities", () => {
  it("reports 3D mode unavailable without configured provider", async () => {
    const prev = process.env.KWIZERA_IMAGE_TO_VIDEO_PROVIDER;
    delete process.env.KWIZERA_IMAGE_TO_VIDEO_PROVIDER;
    const caps = await getProductionCapabilities({ uniqueViewCount: 5 });
    const cinematic = caps.find((c) => c.mode === "CINEMATIC_3D");
    expect(cinematic?.available).toBe(false);
    expect(cinematic?.reason.toLowerCase()).toContain("unavailable");
    if (prev) process.env.KWIZERA_IMAGE_TO_VIDEO_PROVIDER = prev;
  });

  it("recommends motion mode when multiple views exist", async () => {
    const caps = await getProductionCapabilities({ uniqueViewCount: 7 });
    const mode = recommendProductionMode(caps, 7);
    expect(["AI_PRODUCT_MOTION", "CLASSIC_SHOWCASE"]).toContain(mode);
  });

  it("recommends creative tone from category and objective", () => {
    expect(recommendCreativeTone("Footwear Oxford", "Product Showcase")).toBe("Premium");
    expect(recommendCreativeTone("Software", "Promote Sale")).toBe("Energetic");
  });
});

describe("STEP 3 plan preview", () => {
  const plan: CreativePlanDto = {
    id: "plan-1",
    projectId: "p1",
    version: 1,
    createdAt: "",
    modifiedAt: "",
    creativeBrief: "",
    creativeStrategy: "",
    marketingStrategy: "",
    callToAction: "Order Now",
    scenes: [
      { id: "s1", order: 1, durationSeconds: 2, purpose: "HOOK", assetId: "a1", view: "front", motion: "SLOW_PUSH_IN", transition: "cut" },
      { id: "s2", order: 2, durationSeconds: 2, purpose: "PRODUCT_REVEAL", assetId: "a2", view: "back", motion: "HOLD", transition: "cut" },
    ],
    commercial: {
      productName: "Oxford",
      pricing: { currentPrice: 16000, originalPrice: 20000, currency: "RWF", discountPercentage: 20 },
      promotion: { enabled: false, message: "" },
      destination: { website: "https://shop.example" },
      missing: [],
    },
  };

  it("calculates unique views from real scene data", () => {
    const preview = buildPlanPreview(plan, {
      manifestId: "m1",
      projectId: "p1",
      productId: "prod",
      marketingBriefId: "b1",
      briefVersion: 1,
      version: 1,
      platform: "tiktok",
      format: { aspectRatio: "9:16", width: 1080, height: 1920 },
      timeline: { durationMs: 30000, scenes: plan.scenes },
      script: plan.productionScript ?? {
        headline: "", hook: "", productName: "Oxford", mainMessage: "", supportingPoints: [], featureText: "", cta: "Order Now", narration: [],
      },
      missing: [],
      status: "DRAFT",
    }, 30, "TikTok");
    expect(preview?.sceneCount).toBe(2);
    expect(preview?.uniqueViewCount).toBe(2);
    expect(preview?.includesDiscount).toBe(true);
    expect(preview?.includesWebsite).toBe(true);
  });

  it("never renders [object Object] in scene text", () => {
    const text = sceneTextPreview({
      copy: { headline: "Chestnut Oxford", featureText: "Premium visual finish" },
    });
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Chestnut Oxford");
  });

  it("omits discount when not provided", () => {
    const noDiscount = buildPlanPreview({
      ...plan,
      commercial: {
        productName: "Oxford",
        pricing: { currentPrice: 16000, originalPrice: null, currency: "RWF", discountPercentage: null },
        promotion: { enabled: false, message: "" },
        destination: { website: "" },
        missing: [],
      },
    }, null, 30, "TikTok");
    expect(noDiscount?.includesDiscount).toBe(false);
    expect(noDiscount?.includesWebsite).toBe(false);
  });
});

describe("STEP 3 readiness", () => {
  it("blocks when 3D mode selected but unavailable", () => {
    const r = computeReadiness({
      projectId: "p1",
      handoff: {
        version: 1,
        step: "step-3-video-style",
        projectId: "p1",
        projectName: "Test",
        briefId: "b1",
        productId: "prod",
        assetIds: ["a1"],
        platformId: "tiktok",
        durationSeconds: 30,
        objective: "Product Showcase",
        language: "English",
        preparedAt: "",
      },
      selectedMode: "CINEMATIC_3D",
      modes: [{
        mode: "CINEMATIC_3D",
        label: "3D",
        description: "",
        available: false,
        provider: "none",
        reason: "Unavailable",
        limitations: [],
        recommended: false,
      }],
      plan: null,
      planPreview: null,
      generating: false,
    });
    expect(r.ready).toBe(false);
    expect(r.blockingIssues.some((i) => i.includes("unavailable"))).toBe(true);
  });

  it("allows continue when plan has valid scenes", () => {
    const r = computeReadiness({
      projectId: "p1",
      handoff: {
        version: 1,
        step: "step-3-video-style",
        projectId: "p1",
        projectName: "Test",
        briefId: "b1",
        productId: "prod",
        assetIds: ["a1", "a2"],
        platformId: "tiktok",
        durationSeconds: 30,
        objective: "Product Showcase",
        language: "English",
        preparedAt: "",
      },
      selectedMode: "AI_PRODUCT_MOTION",
      modes: [{
        mode: "AI_PRODUCT_MOTION",
        label: "Motion",
        description: "",
        available: true,
        provider: "ffmpeg",
        reason: "ok",
        limitations: [],
        recommended: true,
      }],
      plan: {
        id: "plan-1",
        projectId: "p1",
        version: 1,
        createdAt: "",
        modifiedAt: "",
        creativeBrief: "",
        creativeStrategy: "",
        marketingStrategy: "",
        scenes: [
          { id: "s1", order: 1, durationSeconds: 2, purpose: "HOOK", assetId: "a1", view: "front" },
        ],
      },
      planPreview: {
        ready: true,
        headline: "30-second TikTok video",
        sceneCount: 1,
        uniqueViewCount: 1,
        formatLabel: "1080 × 1920",
        includesPrice: false,
        includesDiscount: false,
        includesWebsite: false,
        includesCta: true,
        statusLabel: "VIDEO PLAN READY",
      },
      generating: false,
    });
    expect(r.ready).toBe(true);
  });
});

describe("STEP 3 scene previews", () => {
  it("builds thumbnail URLs from original asset IDs only", () => {
    const scenes = buildScenePreviews("project-abc", {
      id: "plan-1",
      projectId: "project-abc",
      version: 1,
      createdAt: "",
      modifiedAt: "",
      creativeBrief: "",
      creativeStrategy: "",
      marketingStrategy: "",
      scenes: [
        { id: "s1", order: 1, durationSeconds: 2, purpose: "HOOK", assetId: "asset-front", view: "front", motion: "SLOW_PUSH_IN", transition: "cut", text: "Oxford" },
      ],
    });
    expect(scenes[0]?.thumbnailUrl).toBe("/api/workspace/projects/project-abc/images/asset-front");
    expect(scenes[0]?.textPreview).toBe("Oxford");
  });
});
