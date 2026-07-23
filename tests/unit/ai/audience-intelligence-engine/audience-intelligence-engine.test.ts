import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  AudienceCategory,
  AudiencePlatform,
  createAiCore,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-audience-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "aud-test-product",
  productName: "Audience Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring audience intelligence validation",
  features: ["automation", "analytics", "collaboration"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.B2B,
  tags: ["test"],
  keywords: ["saas", "test"],
};

describe("AiTargetAudienceIntelligenceEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("initializes and registers with product intelligence foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("audience-test");

    const engine = core
      .getManager()
      .productIntelligenceFoundation!.getTargetAudienceIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("audience-intelligence");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes audience after analysis and understanding", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
    await foundation.getProductUnderstandingEngine().understandProduct({
      productId: "aud-test-product",
      marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });

    const result = await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
      productId: "aud-test-product",
      preferredLanguage: "en",
      preferredPlatforms: [AudiencePlatform.Website],
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.audienceRelevanceScore).toBeGreaterThan(55);
    expect(result.record?.psychological.customerNeeds.length).toBeGreaterThan(1);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.demographics.ageGroup).toBeUndefined();

    await core.stop();
  });

  it("rejects audience analysis without prior understanding", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getTargetAudienceIntelligenceEngine()
      .analyzeAudience({ productId: "missing-product" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches audiences by industry and marketing goal", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
    await foundation.getProductUnderstandingEngine().understandProduct({
      productId: "aud-test-product",
    });
    await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
      productId: "aud-test-product",
    });

    const byProduct = foundation
      .getTargetAudienceIntelligenceEngine()
      .searchAudiences({ productId: "aud-test-product" });
    expect(byProduct.length).toBeGreaterThan(0);

    const byType = foundation
      .getTargetAudienceIntelligenceEngine()
      .searchAudiences({ audienceType: AudienceCategory.B2BProfessional });
    expect(byType.length).toBeGreaterThan(0);

    await core.stop();
  });
});
