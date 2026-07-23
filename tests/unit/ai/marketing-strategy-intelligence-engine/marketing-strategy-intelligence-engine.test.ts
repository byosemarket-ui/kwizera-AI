import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MarketingObjective,
  StrategyMarketingPlatform,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductUnderstandingMarketingGoal,
  StrategyType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-marketing-strategy-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "ms-test-product",
  productName: "Marketing Strategy Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring marketing strategy intelligence validation",
  features: ["automation", "analytics", "collaboration"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  tags: ["test"],
  keywords: ["saas", "test"],
};

describe("AiMarketingStrategyIntelligenceEngine", () => {
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
    await core.start("marketing-strategy-test");

    const engine = core
      .getManager()
      .productIntelligenceFoundation!.getMarketingStrategyIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("marketing-strategy-intelligence");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("prepares marketing strategy after analysis and understanding", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
    await foundation.getProductUnderstandingEngine().understandProduct({
      productId: "ms-test-product",
      marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });
    await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
      productId: "ms-test-product",
    });

    const result = await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
      productId: "ms-test-product",
      marketingObjective: MarketingObjective.ProductPromotion,
      preferredPlatforms: [StrategyMarketingPlatform.YouTube, StrategyMarketingPlatform.Website],
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.strategyQualityScore).toBeGreaterThan(55);
    expect(result.record?.selectedStrategies.some((s) => s.priority === "primary")).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.audienceId).toBeTruthy();
    expect(result.record?.campaignDirection.campaignReady).toBe(true);

    await core.stop();
  });

  it("rejects strategy without prior understanding", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getMarketingStrategyIntelligenceEngine()
      .prepareMarketingStrategy({
        productId: "missing-product",
        marketingObjective: MarketingObjective.BrandAwareness,
      });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches strategies by goal and strategy type", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
    await foundation.getProductUnderstandingEngine().understandProduct({
      productId: "ms-test-product",
    });
    await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
      productId: "ms-test-product",
    });
    await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
      productId: "ms-test-product",
      marketingObjective: MarketingObjective.LeadGeneration,
    });

    const byGoal = foundation
      .getMarketingStrategyIntelligenceEngine()
      .searchStrategies({ marketingGoal: MarketingObjective.LeadGeneration });
    expect(byGoal.length).toBeGreaterThan(0);

    const primaryType = byGoal[0].selectedStrategies.find((s) => s.priority === "primary")?.strategyType;
    if (primaryType) {
      const byType = foundation
        .getMarketingStrategyIntelligenceEngine()
        .searchStrategies({ strategyType: primaryType as StrategyType });
      expect(byType.length).toBeGreaterThan(0);
    }

    await core.stop();
  });
});
