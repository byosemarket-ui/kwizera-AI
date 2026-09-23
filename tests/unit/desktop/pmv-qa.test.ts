import { describe, expect, it } from "vitest";
import type { ProductIntelligenceProfile } from "../../../ai/product-intelligence/types.ts";
import {
  buildProductIdentityLock,
  computeAssetFingerprint,
  confirmIdentityLock,
} from "../../../desktop/product-identity-lock/index.ts";
import {
  PMV_SCENE_REGEN_MAX_ATTEMPTS,
  buildTargetedRegeneration,
  qaCustomerLabel,
  runDeterministicPmvQa,
} from "../../../desktop/pmv-qa/index.ts";
import { produceStageLabel } from "../../../desktop/pmv-final/index.ts";
import type { PmvStoryboardSceneView } from "../../../desktop/pmv-creative/types.ts";

function sampleProfile(): ProductIntelligenceProfile {
  return {
    id: "profile-1",
    projectId: "proj-1",
    productId: "proj-1",
    productName: "Oak Boot",
    identifiedAs: "Leather boot",
    productType: "footwear",
    category: "Footwear",
    brand: "KWIZERA",
    description: "Premium oak leather boot",
    imageIds: ["hero-1", "side-1"],
    viewCount: 2,
    materials: ["leather"],
    colours: ["oak brown"],
    textures: ["smooth"],
    shapes: ["boot"],
    patterns: [],
    style: ["classic"],
    features: ["Goodyear welt"],
    functions: ["walking"],
    visibleLogos: ["KWIZERA mark"],
    qualityIndicators: ["clean edges"],
    sellingPoints: [{ point: "Durable sole", source: "user-provided", confidence: 0.9 }],
    targetAudience: "adults",
    marketingKeywords: ["boot"],
    sizes: ["42"],
    tags: [],
    specifications: {},
    quality: { score: 80, confidence: 0.82, notes: ["good coverage"] },
    relationships: [],
    multiView: {
      viewCount: 2,
      coverage: "multi-view",
      views: [
        { imageId: "hero-1", fileName: "a.png", role: "front" },
        { imageId: "side-1", fileName: "b.png", role: "side" },
      ],
      missingAngles: [],
    },
    imageAnalysis: {
      imageCount: 2,
      boundariesDetected: 2,
      backgroundsClassified: 1,
      shadowsNoted: 0,
      reflectionsNoted: 0,
      averageQuality: 80,
      resolutionNotes: [],
      missingAngles: [],
      duplicateImageIds: [],
      viewCoverage: [],
    },
    missingInformation: [],
    photoRecommendations: [],
    detailRecommendations: [],
    readyForCreativeGeneration: true,
    originalImagesUnmodified: true,
    analysisState: "ready",
    analysisVersion: "step7-v1",
    metadata: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    cached: false,
  };
}

function locked(): ReturnType<typeof confirmIdentityLock> {
  const productAssetIds = ["hero-1", "side-1"];
  const heroAssetId = "hero-1";
  const lock = buildProductIdentityLock({
    projectId: "proj-1",
    profile: sampleProfile(),
    heroAssetId,
    productAssetIds,
    assetFingerprint: computeAssetFingerprint(productAssetIds, heroAssetId),
  });
  return confirmIdentityLock(lock);
}

function scenes(): PmvStoryboardSceneView[] {
  return [
    {
      sceneId: "s1",
      order: 1,
      durationSeconds: 3,
      purpose: "hero",
      visual: "product",
      camera: "hero",
      motion: "hold",
      transition: "cut",
      text: "Chestnut Oxford",
      assetId: "hero-1",
      status: "GENERATED",
    },
    {
      sceneId: "s2",
      order: 2,
      durationSeconds: 3,
      purpose: "feature",
      visual: "detail",
      camera: "close-up",
      motion: "slow-zoom",
      transition: "cut",
      text: "Leather finish",
      assetId: "side-1",
      status: "GENERATED",
    },
    {
      sceneId: "s3",
      order: 3,
      durationSeconds: 3,
      purpose: "cta",
      visual: "end",
      camera: "medium",
      motion: "hold",
      transition: "fade",
      text: "Shop now",
      assetId: "hero-1",
      status: "GENERATED",
    },
  ];
}

describe("PMV QA Step 5", () => {
  it("passes Exact Product identity when timeline uses locked assets", () => {
    const qa = runDeterministicPmvQa({
      projectId: "proj-1",
      lock: locked(),
      productAssetIds: ["hero-1", "side-1"],
      heroAssetId: "hero-1",
      brandName: "Kwizera",
      website: "https://example.com",
      phone: "",
      cta: "Shop now",
      logoAssetId: null,
      audioSelected: false,
      productionMode: "AI_PRODUCT_MOTION",
      scenes: scenes(),
      timelineAssetIds: ["hero-1", "side-1", "hero-1"],
      output: {
        assetId: "out-1",
        url: "/api/video/out-1",
        width: 1080,
        height: 1920,
        durationMs: 15000,
        sizeBytes: 2_000_000,
        validationStatus: "TECHNICALLY_VALIDATED",
        validationChecks: {
          fileNonEmpty: true,
          hasVideoStream: true,
          durationValid: true,
          durationConsistent: true,
          productClear: true,
          productShownEarly: true,
          pacingOk: true,
          endCardPresent: true,
        },
        qualityReview: {
          score: 88,
          suggestions: [],
          checks: { ctaPresent: true, hasCtaScene: true, productClear: true, pacingOk: true },
          source: "deterministic",
          reviewedAt: new Date().toISOString(),
          blocking: false,
        },
        renderJobId: "job-1",
        textOverlay: "applied",
        sceneCount: 3,
        endCardPresent: true,
      },
      visionQaAvailable: false,
    });

    expect(qa.overallStatus).toBe("QA_PASSED");
    expect(qa.productIdentityStatus).toBe("PASS");
    expect(qa.technicalStatus).toBe("PASS");
    expect(qa.visionQaStatus).toBe("UNAVAILABLE");
    expect(qa.scenes.every((s) => s.status === "PASS")).toBe(true);
    expect(JSON.stringify(qa)).not.toMatch(/api.?key|ollama|qwen|provider/i);
  });

  it("fails only the scene outside the identity lock", () => {
    const badScenes = scenes();
    badScenes[1] = { ...badScenes[1]!, assetId: "foreign-asset", status: "GENERATED" };
    const qa = runDeterministicPmvQa({
      projectId: "proj-1",
      lock: locked(),
      productAssetIds: ["hero-1", "side-1"],
      heroAssetId: "hero-1",
      brandName: "Kwizera",
      website: "",
      phone: "",
      cta: "Buy",
      logoAssetId: null,
      audioSelected: false,
      productionMode: "AI_PRODUCT_MOTION",
      scenes: badScenes,
      timelineAssetIds: ["hero-1", "foreign-asset", "hero-1"],
      output: {
        assetId: "out-1",
        url: "/api/video/out-1",
        sizeBytes: 1000,
        validationStatus: "TECHNICALLY_VALIDATED",
        validationChecks: { fileNonEmpty: true, hasVideoStream: true },
        textOverlay: "applied",
      },
      visionQaAvailable: false,
    });

    expect(qa.overallStatus).toBe("QA_FAILED");
    expect(qa.scenes.filter((s) => s.status === "FAIL").map((s) => s.sceneId)).toEqual(["s2"]);
    expect(qa.scenes.filter((s) => s.status === "PASS").map((s) => s.sceneId)).toEqual(["s1", "s3"]);
    expect(qa.recommendedActions.some((a) => /only scene 2/i.test(a))).toBe(true);
  });

  it("builds targeted regeneration with bounded attempts", () => {
    const lock = locked();
    const qa = runDeterministicPmvQa({
      projectId: "proj-1",
      lock,
      productAssetIds: ["hero-1", "side-1"],
      heroAssetId: "hero-1",
      brandName: "Kwizera",
      website: "",
      phone: "",
      cta: "Buy",
      logoAssetId: null,
      audioSelected: false,
      productionMode: "AI_PRODUCT_MOTION",
      scenes: scenes().map((s, i) => (i === 1 ? { ...s, assetId: "x", status: "FAILED" } : s)),
      timelineAssetIds: ["hero-1", "x", "hero-1"],
      output: {
        url: "/v.mp4",
        sizeBytes: 10,
        validationStatus: "TECHNICALLY_VALIDATED",
        validationChecks: { fileNonEmpty: true },
      },
      visionQaAvailable: false,
    });
    const regen = buildTargetedRegeneration({
      projectId: "proj-1",
      scene: scenes()[1]!,
      qa,
      lock,
      productionMode: "AI_PRODUCT_MOTION",
      creativePlanVersion: 2,
      previousAttempt: 0,
    });
    expect(regen.preserveSuccessfulScenes).toBe(true);
    expect(regen.sceneId).toBe("s2");
    expect(regen.maxAttempts).toBe(PMV_SCENE_REGEN_MAX_ATTEMPTS);
    expect(regen.attempt).toBe(1);
    expect(regen.sourceAssetIds).toEqual(["hero-1", "side-1"]);
  });

  it("does not fake PASS when technical MP4 is missing", () => {
    const qa = runDeterministicPmvQa({
      projectId: "proj-1",
      lock: locked(),
      productAssetIds: ["hero-1", "side-1"],
      heroAssetId: "hero-1",
      brandName: "Kwizera",
      website: "",
      phone: "",
      cta: "Buy",
      logoAssetId: null,
      audioSelected: false,
      productionMode: "AI_PRODUCT_MOTION",
      scenes: scenes(),
      timelineAssetIds: ["hero-1"],
      output: null,
      visionQaAvailable: false,
    });
    expect(qa.overallStatus).toBe("QA_FAILED");
    expect(qa.technicalStatus).toBe("FAIL");
  });

  it("exposes customer-safe stage labels", () => {
    expect(produceStageLabel(0, "QA_IN_PROGRESS")).toMatch(/Checking/i);
    expect(produceStageLabel(0, "REGENERATING")).toMatch(/Fixing/i);
    expect(produceStageLabel(0, "DELIVERED")).toMatch(/delivered/i);
    expect(qaCustomerLabel("QA_PASSED")).toMatch(/passed/i);
    expect(qaCustomerLabel("NEEDS_REVIEW")).toMatch(/review/i);
  });
});
