import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeProductCategory,
  KnowledgeProductMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-product-knowledge-test-"));
}

describe("AiProductKnowledgeEngine", () => {
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

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("product-knowledge-test");
    const engine = core.getManager().knowledgeFoundation!.getProductKnowledgeEngine();
    return { core, engine };
  }

  it("initializes with knowledge foundation", async () => {
    const { core, engine } = await startCore();
    expect(engine.isStartupComplete()).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(storageRoot, "logs", `product-knowledge-engine-${logDate}.jsonl`))
    ).toBe(true);

    await core.stop();
  });

  it("analyzes product with category understanding", async () => {
    const { core, engine } = await startCore();

    const result = await engine.analyzeProduct({
      productId: "test-electronics",
      productName: "KWIZERA Pro",
      category: KnowledgeProductCategory.Electronics,
      brand: "KWIZERA",
      features: ["AI-powered", "fast", "reliable"],
      description: "Professional AI creative workstation for marketing teams",
      brandKnowledge: { brandConsistency: 90 },
      visual: { productVisibility: 92, productQuality: 88 },
    });

    expect(result.success).toBe(true);
    expect(result.record?.profile.category).toBe(KnowledgeProductCategory.Electronics);
    expect(result.record?.scores.productQualityScore).toBeGreaterThan(60);

    await core.stop();
  });

  it("detects relationships and learns patterns", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeProduct({
      productId: "prod-a",
      productName: "Product A",
      category: KnowledgeProductCategory.Electronics,
      brand: "KWIZERA",
      features: ["feature-1", "feature-2"],
      description: "KWIZERA electronics product for professionals",
      tags: ["kwizera"],
    });

    await engine.analyzeProduct({
      productId: "prod-b",
      productName: "Product B",
      category: KnowledgeProductCategory.Electronics,
      brand: "KWIZERA",
      features: ["feature-1", "feature-3"],
      description: "KWIZERA electronics product for teams",
      tags: ["kwizera"],
    });

    const rels = engine.detectRelationships("prod-a");
    expect(rels?.relatedProducts.length).toBeGreaterThanOrEqual(1);
    expect(rels?.relatedBrands.length).toBeGreaterThanOrEqual(1);
    expect(engine.getLearnedPatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates recommendations and supports search", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeProduct({
      productId: "rec-prod",
      productName: "Low Visibility Product",
      category: KnowledgeProductCategory.Shoes,
      brand: "KWIZERA",
      features: ["comfortable", "durable"],
      description: "Affordable shoes for everyday wear",
      visual: { productVisibility: 55, productQuality: 60 },
      marketing: { callToAction: "Buy" },
    });

    const recs = engine.getRecommendations("rec-prod");
    expect(recs.length).toBeGreaterThan(0);

    const search = await engine.searchProducts({ brand: "KWIZERA" });
    expect(search.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("rejects invalid and incomplete product knowledge", async () => {
    const { core, engine } = await startCore();

    const invalid = await engine.analyzeProduct({ productName: "", brand: "" });
    expect(invalid.success).toBe(false);

    const low = await engine.analyzeProduct({
      productName: "Bad Product",
      brand: "Unknown Brand",
      features: [],
      visual: { productVisibility: 15, productQuality: 15 },
      brandKnowledge: { brandConsistency: 15 },
      marketing: { callToAction: "", uniqueSellingPoints: [] },
      customer: { customerNeeds: [], customerInterests: [], preferredPlatforms: [] },
    });
    expect(low.success).toBe(false);

    await core.stop();
  });
});
