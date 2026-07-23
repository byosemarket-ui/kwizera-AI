import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-product-understanding-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "pu-test-product",
  productName: "Understanding Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A comprehensive SaaS product for marketing teams requiring deep understanding validation",
  features: ["automation", "analytics", "collaboration"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  tags: ["test"],
  keywords: ["saas", "test"],
};

describe("AiProductUnderstandingEngine", () => {
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
    await core.start("product-understanding-test");

    const engine = core.getManager().productIntelligenceFoundation!.getProductUnderstandingEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().productIntelligenceFoundation!.getRegistry().getModule("product-understanding-engine");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("understands product after analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);

    const result = await foundation.getProductUnderstandingEngine().understandProduct({
      productId: "pu-test-product",
      marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.understandingScore).toBeGreaterThan(55);
    expect(result.record?.customer.customerNeeds.length).toBeGreaterThan(0);
    expect(result.record?.validated).toBe(true);

    await core.stop();
  });

  it("rejects understanding without prior analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getProductUnderstandingEngine()
      .understandProduct({ productId: "missing-product" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches understanding by purpose and audience", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
    await foundation.getProductUnderstandingEngine().understandProduct({
      productId: "pu-test-product",
    });

    const engine = foundation.getProductUnderstandingEngine();
    const record = engine.getUnderstanding("pu-test-product")!;
    const byPurpose = engine.searchUnderstanding({ purpose: "marketing" });
    const byAudience = engine.searchUnderstanding({
      targetAudience: record.customer.targetCustomer.split(" ")[0],
    });

    expect(byPurpose.length).toBeGreaterThan(0);
    expect(byAudience.length).toBeGreaterThan(0);

    await core.stop();
  });
});
