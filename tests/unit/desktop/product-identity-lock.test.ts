import { describe, expect, it } from "vitest";
import type { ProductIntelligenceProfile } from "../../../ai/product-intelligence/types.ts";
import {
  buildProductIdentityLock,
  buildProductIntelligenceReview,
  computeAssetFingerprint,
  confirmIdentityLock,
  markIdentityLockStale,
  validateIdentityLock,
  ALLOWED_CREATIVE_CHANGES,
  PROTECTED_PRODUCT_ATTRIBUTES,
  PRODUCT_IDENTITY_LOCK_VERSION,
} from "../../../desktop/product-identity-lock/index.ts";

function sampleProfile(overrides: Partial<ProductIntelligenceProfile> = {}): ProductIntelligenceProfile {
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
    imageIds: ["a1", "a2"],
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
        { imageId: "a1", fileName: "a.png", role: "front" },
        { imageId: "a2", fileName: "b.png", role: "side" },
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
    ...overrides,
  };
}

describe("Product Identity Lock", () => {
  it("builds a review without exposing provider internals", () => {
    const review = buildProductIntelligenceReview(sampleProfile({
      productProvenance: {
        analysisType: "product-intelligence",
        analysisVersion: "step7-v1",
        provider: "secret-provider",
        timestamp: "2026-01-01T00:00:00.000Z",
        imageProfileIds: [],
      },
    }), "a1");
    expect(review.productIdentified).toBe("Leather boot");
    expect(review.keyColors).toContain("oak brown");
    expect(review.readyToConfirm).toBe(true);
    expect(JSON.stringify(review)).not.toMatch(/secret-provider|ollama|api.?key/i);
  });

  it("builds a lock with protected attributes and allowed creative changes", () => {
    const fingerprint = computeAssetFingerprint(["a1", "a2"], "a1");
    const lock = buildProductIdentityLock({
      projectId: "proj-1",
      profile: sampleProfile(),
      heroAssetId: "a1",
      productAssetIds: ["a1", "a2"],
      assetFingerprint: fingerprint,
    });
    expect(lock.version).toBe(PRODUCT_IDENTITY_LOCK_VERSION);
    expect(lock.status).toBe("PENDING_CONFIRMATION");
    expect(lock.protectedAttributes).toEqual([...PROTECTED_PRODUCT_ATTRIBUTES]);
    expect(lock.allowedCreativeChanges).toEqual([...ALLOWED_CREATIVE_CHANGES]);
    expect(lock.analysisCapability).toBe("VISION_ANALYSIS");
    expect(lock.heroAssetId).toBe("a1");
    expect(lock.colors[0]?.value).toBe("oak brown");
  });

  it("confirms lock and detects stale asset fingerprints", () => {
    const fingerprint = computeAssetFingerprint(["a1", "a2"], "a1");
    let lock = buildProductIdentityLock({
      projectId: "proj-1",
      profile: sampleProfile(),
      heroAssetId: "a1",
      productAssetIds: ["a1", "a2"],
      assetFingerprint: fingerprint,
    });
    lock = confirmIdentityLock(lock);
    expect(lock.status).toBe("LOCKED");
    expect(lock.lockedAt).toBeTruthy();

    const ok = validateIdentityLock({
      lock,
      projectId: "proj-1",
      productAssetIds: ["a1", "a2"],
      heroAssetId: "a1",
    });
    expect(ok.ok).toBe(true);
    expect(ok.stale).toBe(false);

    const stale = validateIdentityLock({
      lock,
      projectId: "proj-1",
      productAssetIds: ["a1", "a3"],
      heroAssetId: "a1",
    });
    expect(stale.stale).toBe(true);
    expect(stale.ok).toBe(false);

    const marked = markIdentityLockStale(lock);
    expect(marked.status).toBe("STALE");
    expect(marked.lockedAt).toBeNull();
  });

  it("marks vision-unavailable reviews honestly", () => {
    const review = buildProductIntelligenceReview(sampleProfile({
      aiInferenceStatus: "IMAGE_ANALYSIS_UNAVAILABLE",
    }), "a1");
    expect(review.visionUnavailable).toBe(true);
    expect(review.visionUnavailableMessage).toMatch(/not configured/i);
  });
});
