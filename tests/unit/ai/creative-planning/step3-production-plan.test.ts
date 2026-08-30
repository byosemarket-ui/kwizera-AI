import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { buildConfirmedCommercial, priceSceneCopy } from "../../../../ai/creative-planning/commercial.js";
import { planProductScenes } from "../../../../ai/creative-planning/scene-planner.js";
import { planStoryBeats } from "../../../../ai/creative-planning/story-structure.js";
import { buildTimelineFromPlan, sliceTimelineForRender } from "../../../../ai/video-production/plan-to-timeline.js";
import { sanitizeRenderText } from "../../../../ai/video-production/ffmpeg-renderer.js";
import type { CanonicalProduct } from "../../../../ai/product-record/types.js";
import type { CanonicalViewKind } from "../../../../ai/product-record/view-kinds.js";
import type { AuthoritativeMarketingBrief } from "../../../../ai/marketing-brief/types.js";
import type { CreativeProject, ValidationResult } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("story beats adapt to duration, platform, and views", () => {
  it("uses a short hook-product-cta arc for 6s and a longer arc for 30s", () => {
    expect(planStoryBeats({ durationMs: 6000, platform: "tiktok", uniqueViewCount: 5, hasPrice: false, hasPromotion: false }))
      .toEqual(["HOOK", "PRODUCT_REVEAL", "CTA"]);
    expect(planStoryBeats({ durationMs: 15000, platform: "instagram", uniqueViewCount: 1, hasPrice: false, hasPromotion: false }))
      .toEqual(["HOOK", "PRODUCT_REVEAL", "CTA"]);
    const thirty = planStoryBeats({ durationMs: 30000, platform: "youtube", uniqueViewCount: 5, hasPrice: true, hasPromotion: false });
    expect(thirty[0]).toBe("HOOK");
    expect(thirty).toContain("DETAIL");
    expect(thirty).toContain("EXPLORATION");
    expect(thirty).toContain("PRICE");
    expect(thirty.at(-1)).toBe("CTA");
    expect(thirty.length).toBeGreaterThan(4);
  });
});

describe("commercial data is never invented", () => {
  it("omits price, discount, and website unless provided and valid", () => {
    const empty = buildConfirmedCommercial({ productName: "Oxford" });
    expect(empty.pricing.currentPrice).toBeNull();
    expect(empty.pricing.discountPercentage).toBeNull();
    expect(empty.destination.website).toBe("");
    expect(priceSceneCopy(empty)).toEqual({});
    expect(empty.missing.some((item) => item.toLowerCase().includes("price"))).toBe(true);

    const offer = buildConfirmedCommercial({
      productName: "Oxford",
      currentPrice: 35000,
      originalPrice: 45000,
      currency: "RWF",
    });
    expect(offer.pricing.discountPercentage).toBe(22);
    expect(priceSceneCopy(offer).saveLabel).toBe("SAVE 22%");
    expect(priceSceneCopy(offer).oldPrice).toContain("45,000");

    const invalid = buildConfirmedCommercial({ currentPrice: 50000, originalPrice: 40000, currency: "RWF" });
    expect(invalid.pricing.discountPercentage).toBeNull();
    expect(invalid.issues.length).toBeGreaterThan(0);
  });
});

describe("STEP 3 scene plan and production manifest", () => {
  it("assigns distinct product views, real asset IDs, and persists user edits", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step3-"));
    roots.push(storageRoot);
    const manager = new CreativePlanningManager();
    await manager.initialize(storageRoot);

    const canonical = canonicalProduct("project-oxford", "Brown Oxford Shoe", [
      ["asset_front", "front.png", "front", "user"],
      ["asset_left", "left.png", "left", "ai"],
      ["asset_back", "back.png", "back", "ai"],
      ["asset_detail", "detail.png", "detail", "ai"],
      ["asset_sole", "sole.png", "material_detail", "ai"],
    ]);
    const brief = briefFixture("project-oxford", "brief_oxford", {
      duration: "15s",
      platforms: ["instagram"],
      name: "Brown Oxford Shoe",
    });
    manager.attachCanonicalProduct(fakeCanonical(canonical));
    manager.attachMarketingBrief(fakeBrief(brief));

    const project = projectFixture("project-oxford", "Brown Oxford Shoe", [
      "asset_front", "asset_left", "asset_back", "asset_detail", "asset_sole",
    ]);
    const result = await manager.createPlan(project, valid());
    const plan = result.plan!;
    expect(plan.scenes.length).toBeGreaterThanOrEqual(4);
    expect(plan.scenes.every((scene) => scene.assetId && !scene.assetId.includes("blob:"))).toBe(true);
    expect(plan.scenes.every((scene) => Number.isInteger(scene.durationMs) && (scene.durationMs ?? 0) >= 800)).toBe(true);
    expect(plan.scenes[0]?.assetId).toBe("asset_front");
    expect(plan.scenes.some((scene) => scene.assetId === "asset_left" || scene.view === "left")).toBe(true);
    expect(plan.scenes.some((scene) => scene.assetId === "asset_detail" || scene.view === "detail")).toBe(true);
    expect(plan.scenes.filter((scene) => scene.assetId === "asset_sole").length).toBeLessThanOrEqual(1);
    expect(plan.scenes.every((scene) => scene.selectionReason)).toBe(true);
    expect(plan.productionScript?.productName).toBe("Brown Oxford Shoe");
    expect(plan.productionScript?.priceLine).toBeFalsy();
    expect(JSON.stringify(plan)).not.toContain("[object Object]");

    const timelineMs = plan.scenes.reduce((sum, scene) => sum + (scene.durationMs ?? 0), 0);
    expect(plan.timelineDurationMs).toBe(timelineMs);

    const edited = plan.scenes.map((scene, index) => index === 1
      ? { ...scene, assetId: "asset_back", text: "Hand-finished leather", durationSeconds: 4, userEdited: true }
      : scene);
    const updated = await manager.updatePlan(project.id, { scenes: edited });
    expect(updated.scenes[1]?.assetId).toBe("asset_back");
    expect(updated.scenes[1]?.text).toBe("Hand-finished leather");
    expect(updated.scenes[1]?.durationMs).toBe(4000);
    expect(updated.scenes[1]?.fieldSources?.assetId).toBe("USER_DEFINED");

    const regenerated = (await manager.createPlan(project, valid())).plan!;
    const kept = regenerated.scenes.find((scene) => scene.id === updated.scenes[1]?.id) ?? regenerated.scenes[1];
    expect(kept?.assetId).toBe("asset_back");
    expect(kept?.text).toBe("Hand-finished leather");

    const withPrice = await manager.updatePlan(project.id, {
      commercial: buildConfirmedCommercial({
        productName: "Brown Oxford Shoe",
        currentPrice: 35000,
        originalPrice: 45000,
        currency: "RWF",
        website: "example.com",
        promotionMessage: "Special Offer",
      }),
    });
    expect(withPrice.commercial?.pricing.discountPercentage).toBe(22);
    expect(withPrice.commercial?.destination.website).toBe("example.com");

    const restored = new CreativePlanningManager();
    await restored.initialize(storageRoot);
    expect((await restored.getPlan(project.id))?.scenes[1]?.text).toBe("Hand-finished leather");
    const manifest = await restored.getManifest(project.id);
    expect(manifest?.projectId).toBe(project.id);
    expect(manifest?.timeline.scenes.every((scene) => scene.assetId)).toBe(true);
    expect(manifest?.timeline.durationMs).toBe(manifest?.timeline.scenes.reduce((sum, scene) => sum + (scene.durationMs ?? 0), 0));

    const finalized = await manager.finalize(project.id);
    expect(finalized.manifest.status).toBe("READY_FOR_VIDEO_PRODUCTION");
    expect(JSON.stringify(finalized.manifest)).not.toContain("[object Object]");
  });

  it("does not keep legacy user-edited scenes that no longer match the story beat", () => {
    const project = projectFixture("project-oxford", "Oxford", ["asset_front", "asset_left", "asset_detail"]);
    const scenes = planProductScenes(project, null, [], [
      {
        id: "legacy-1",
        order: 1,
        durationSeconds: 3,
        purpose: "Product introduction",
        visual: "old",
        narration: "old",
        camera: "medium",
        lighting: "",
        composition: "",
        animation: "",
        assetId: "asset_front",
        userEdited: true,
      },
    ], {
      canonical: canonicalProduct("project-oxford", "Oxford", [
        ["asset_front", "front.png", "front", "user"],
        ["asset_left", "left.png", "left", "ai"],
        ["asset_detail", "detail.png", "detail", "ai"],
      ]),
      brief: briefFixture("project-oxford", "brief_x", { duration: "15s", platforms: ["instagram"], name: "Oxford" }),
    });
    expect(scenes[0]?.purpose).toBe("HOOK");
    expect(scenes[0]?.id).not.toBe("legacy-1");
    expect(scenes.some((scene) => scene.purpose === "CTA")).toBe(true);
    expect(new Set(scenes.map((scene) => scene.assetId)).size).toBeGreaterThan(1);
  });

  it("keeps project A assets and commercial data out of project B", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step3-iso-"));
    roots.push(storageRoot);
    const manager = new CreativePlanningManager();
    await manager.initialize(storageRoot);

    const canonicalA = canonicalProduct("project-a", "Product A", [["a-front", "a-front.png", "front", "user"]]);
    const canonicalB = canonicalProduct("project-b", "Product B", [["b-front", "b-front.png", "front", "user"]]);
    manager.attachCanonicalProduct({
      isInitialized: () => true,
      get: async (id: string) => id === "project-a" ? canonicalA : id === "project-b" ? canonicalB : null,
      sync: async (id: string) => id === "project-a" ? canonicalA : id === "project-b" ? canonicalB : null,
    } as never);
    manager.attachMarketingBrief({
      isInitialized: () => true,
      get: async (id: string) => id === "project-a"
        ? briefFixture("project-a", "brief_a", { name: "Product A", website: "a.example", price: 1000 })
        : briefFixture("project-b", "brief_b", { name: "Product B" }),
      updateSettings: async () => briefFixture("project-b", "brief_b", { name: "Product B" }),
    } as never);

    const projectA = projectFixture("project-a", "Product A", ["a-front"]);
    const projectB = projectFixture("project-b", "Product B", ["b-front"]);
    const planA = (await manager.createPlan(projectA, valid())).plan!;
    const planB = (await manager.createPlan(projectB, valid())).plan!;
    expect(planA.scenes.every((scene) => scene.assetId === "a-front")).toBe(true);
    expect(planB.scenes.every((scene) => scene.assetId === "b-front")).toBe(true);
    expect(planA.productionScript?.productName).toBe("Product A");
    expect(planB.productionScript?.productName).toBe("Product B");
    expect(JSON.stringify(planB)).not.toContain("a-front");
    expect(JSON.stringify(planB)).not.toContain("a.example");
    expect(JSON.stringify(planB)).not.toContain("1000");

    const manifestA = await manager.getManifest("project-a");
    const manifestB = await manager.getManifest("project-b");
    expect(manifestA?.productId).not.toBe(manifestB?.productId);
    expect(manifestB?.timeline.scenes.some((scene) => scene.assetId === "a-front")).toBe(false);
  });

  it("uses planned millisecond durations in the video timeline outside preview", () => {
    const project = projectFixture("project-oxford", "Oxford", ["asset_front", "asset_left"]);
    const scenes = planProductScenes(project, null, [], [], {
      canonical: canonicalProduct("project-oxford", "Oxford", [
        ["asset_front", "front.png", "front", "user"],
        ["asset_left", "left.png", "left", "ai"],
      ]),
      brief: briefFixture("project-oxford", "brief_x", { duration: "15s", platforms: ["instagram"], name: "Oxford" }),
    });
    const plan = {
      id: "plan-1",
      projectId: project.id,
      createdAt: "",
      modifiedAt: "",
      version: 1,
      analyses: { product: "", brand: "", campaign: "", audience: "", platform: "", language: "" },
      creativeBrief: "",
      marketingStrategy: "",
      creativeStrategy: "",
      storyboard: "",
      script: "",
      scenes,
      cameraPlan: "",
      lightingPlan: "",
      colourStyle: "",
      compositionGuide: "",
      animationPlan: "",
      prompts: { image: "", video: "", audio: "" },
      workflow: [],
    };
    const full = buildTimelineFromPlan(project, plan);
    const preview = sliceTimelineForRender(full, "preview");
    expect(preview.every((clip) => clip.durationMs <= 2000)).toBe(true);
    const planned = scenes.reduce((sum, scene) => sum + (scene.durationMs ?? 0), 0);
    expect(full.reduce((sum, clip) => sum + clip.durationMs, 0)).toBe(planned);
    expect(full.some((clip) => clip.durationMs > 2000 || scenes.length <= 3)).toBe(true);
    expect(full[0]?.assetId).toBe("asset_front");
  });
});

describe("FFmpeg text sanitization", () => {
  it("strips objects, quotes, and control characters without inventing copy", () => {
    expect(sanitizeRenderText({ broken: true })).toBe("");
    expect(sanitizeRenderText("[object Object]")).toBe("");
    expect(sanitizeRenderText("Shop now: Kigali")).toBe("Shop now  Kigali");
    expect(sanitizeRenderText("It's ready\nnow")).toContain("ready");
    expect(sanitizeRenderText("Amakuru yawe")).toBe("Amakuru yawe");
  });
});

function valid(): ValidationResult {
  return { valid: true, errors: [] };
}

function projectFixture(id: string, name: string, assetIds: string[]): CreativeProject {
  const now = new Date().toISOString();
  return {
    id,
    name,
    createdAt: now,
    modifiedAt: now,
    productImages: assetIds.map((assetId) => ({
      id: assetId,
      fileName: `${assetId}.png`,
      mimeType: "image/png",
      sizeBytes: 24,
      uploadedAt: now,
      url: `/${assetId}.png`,
    })),
    productInformation: { name, category: "Shoes", description: `${name} product` },
    brandInformation: { name: "KWIZERA" },
    campaignInformation: { name: "Launch", objective: "Product awareness", callToAction: "Shop now" },
    targetAudience: "Shoppers",
    language: "en",
    platform: "instagram",
    workspaceSettings: {},
  };
}

function canonicalProduct(
  projectId: string,
  name: string,
  assets: Array<[string, string, CanonicalViewKind, "ai" | "user"]>,
): CanonicalProduct {
  const now = new Date().toISOString();
  return {
    version: 1,
    productId: projectId,
    projectId,
    projectName: name,
    identity: { name, brand: "KWIZERA", category: "shoes", productType: "shoe" },
    originalAssets: assets.map(([assetId, fileName]) => ({
      assetId,
      productId: projectId,
      originalFilename: fileName,
      storedFileName: fileName,
      originalRelativePath: `projects/${projectId}/assets/${fileName}`,
      productionUrl: `/assets/${fileName}`,
      mimeType: "image/png",
      fileSize: 24,
      width: 800,
      height: 800,
      uploadedAt: now,
      processingStatus: "READY",
      fileAccessible: true,
    })),
    processedAssets: [],
    productionAssets: [],
    finalOutputs: [],
    productViews: assets.map(([assetId, , view, source]) => ({
      assetId,
      view,
      confidence: source === "user" ? 1 : 0.8,
      source,
    })),
    assetMap: {},
    visualAnalysis: { features: [], materials: [], colours: [], analyzedAt: null },
    productFeatures: [],
    marketingData: { sellingPoints: ["Leather finish"], targetAudience: "", keywords: [] },
    productionData: {
      readiness: "READY",
      readyReason: "Originals present",
      analysisCompleted: true,
      requiredAssetsPresent: true,
      pathsValid: true,
    },
    intelligence: null,
    updatedAt: now,
  };
}

function briefFixture(projectId: string, briefId: string, options: {
  duration?: string;
  platforms?: string[];
  name: string;
  website?: string;
  price?: number;
}): AuthoritativeMarketingBrief {
  const now = new Date().toISOString();
  return {
    version: 1,
    briefId,
    productId: projectId,
    projectId,
    projectName: options.name,
    briefVersion: 1,
    activeVersion: 1,
    createdAt: now,
    updatedAt: now,
    status: "READY_FOR_SCRIPT",
    campaign: {
      objective: "Product awareness",
      objectiveCode: "PRODUCT_AWARENESS",
      platforms: options.platforms ?? ["instagram"],
      audience: { general: "Shoppers", location: "", ageRange: "", gender: "", customerType: "", interests: [] },
      cta: "Shop now",
      tone: "confident",
      language: "en",
      lockedFields: [],
    },
    output: {
      aspectRatio: "9:16",
      duration: options.duration ?? "15s",
      contentFormat: "SHORT_PRODUCT_VIDEO",
      pacing: "fast",
      hookStyle: "product-first",
    },
    marketing: {
      positioning: "",
      angle: "everyday style",
      mainSellingPoint: { text: "Refined everyday style", source: "USER_DEFINED", confidence: 1 },
      supportingPoints: [{ text: "Hand-finished leather", source: "INFERRED", confidence: 0.6 }],
      message: "Refined everyday style",
      cta: "Shop now",
    },
    creative: { tone: "confident", style: "" },
    productAssets: {},
    intelligence: null,
    recommendations: [],
    acceptedRecommendationIds: [],
    rejectedRecommendationIds: [],
    versions: [],
    userDefined: {
      website: options.website,
      currentPrice: options.price,
    },
  };
}

function fakeCanonical(product: CanonicalProduct) {
  return {
    isInitialized: () => true,
    get: async () => product,
    sync: async () => product,
  } as never;
}

function fakeBrief(brief: AuthoritativeMarketingBrief) {
  return {
    isInitialized: () => true,
    get: async () => brief,
    updateSettings: async () => brief,
  } as never;
}
