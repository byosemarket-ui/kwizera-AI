import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-product-analysis-test-"));
}

const SAMPLE = {
  productId: "test-product-001",
  productName: "Test Analysis Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  model: "TB-001",
  sku: "SKU-TB-001",
  description: "A comprehensive test product for unit validation with sufficient detail",
  features: ["feature-a", "feature-b"],
  specifications: { weight: "1kg" },
  materials: ["plastic"],
  dimensions: "10x10x5cm",
  weight: "1kg",
  colors: ["black"],
  sizes: ["one-size"],
  packaging: "box",
  countryOfOrigin: "US",
  supplier: "Test Supplier",
  price: 99.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  tags: ["test"],
  keywords: ["test", "product"],
};

describe("AiProductAnalysisEngine", () => {
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
    await core.start("product-analysis-test");

    const engine = core.getManager().productIntelligenceFoundation!.getProductAnalysisEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().productIntelligenceFoundation!.getRegistry().getModule("product-analysis-engine");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes product and stores intelligence record", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().productIntelligenceFoundation!.getProductAnalysisEngine();
    const result = await engine.analyzeProduct(SAMPLE);

    expect(result.success).toBe(true);
    expect(result.record?.profile.productName).toBe("Test Analysis Product");
    expect(result.record?.scores.completenessScore).toBeGreaterThan(50);
    expect(result.record?.validated).toBe(true);

    await core.stop();
  });

  it("rejects incomplete product analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().productIntelligenceFoundation!.getProductAnalysisEngine();
    const result = await engine.analyzeProduct({ productId: "bad", productName: "X" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches products by brand and sku", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().productIntelligenceFoundation!.getProductAnalysisEngine();
    await engine.analyzeProduct(SAMPLE);

    const byBrand = engine.searchProducts({ brand: "TestBrand" });
    const bySku = engine.searchProducts({ sku: "SKU-TB-001" });

    expect(byBrand.length).toBe(1);
    expect(bySku[0]?.productId).toBe("test-product-001");

    await core.stop();
  });
});
