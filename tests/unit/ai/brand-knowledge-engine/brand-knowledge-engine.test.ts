import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BrandMarketingStyle,
  createAiCore,
  KnowledgeBrandIndustry,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-brand-knowledge-test-"));
}

describe("AiBrandKnowledgeEngine", () => {
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
    await core.start("brand-knowledge-test");
    const engine = core.getManager().knowledgeFoundation!.getBrandKnowledgeEngine();
    return { core, engine };
  }

  it("initializes with knowledge foundation", async () => {
    const { core, engine } = await startCore();
    expect(engine.isStartupComplete()).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(storageRoot, "logs", `brand-knowledge-engine-${logDate}.jsonl`))
    ).toBe(true);

    await core.stop();
  });

  it("analyzes brand with identity and visual knowledge", async () => {
    const { core, engine } = await startCore();

    const result = await engine.analyzeBrand({
      brandId: "test-kwizera",
      brandName: "KWIZERA",
      industry: KnowledgeBrandIndustry.Creative,
      brandValues: ["innovation", "quality", "trust"],
      brandMission: "Empower creators",
      brandVision: "Lead AI creative industry",
      brandTargetAudience: "creative professionals",
      marketingStyle: BrandMarketingStyle.Premium,
      visual: {
        logo: "kwizera-logo",
        brandColors: ["#1a1a2e", "#e94560", "#ffffff"],
        typography: "Inter",
      },
      communication: {
        brandVoice: "confident-innovative",
        marketingTone: "professional-energetic",
      },
    });

    expect(result.success).toBe(true);
    expect(result.record?.profile.brandName).toBe("KWIZERA");
    expect(result.record?.scores.brandConsistencyScore).toBeGreaterThan(70);

    await core.stop();
  });

  it("detects relationships and learns patterns", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeBrand({
      brandId: "brand-a",
      brandName: "Brand A",
      industry: KnowledgeBrandIndustry.Technology,
      brandValues: ["innovation"],
      marketingStyle: BrandMarketingStyle.Professional,
      tags: ["kwizera"],
    });

    await engine.analyzeBrand({
      brandId: "brand-b",
      brandName: "Brand B",
      industry: KnowledgeBrandIndustry.Technology,
      brandValues: ["speed"],
      marketingStyle: BrandMarketingStyle.Professional,
      tags: ["kwizera"],
    });

    const rels = engine.detectRelationships("brand-a");
    expect(rels?.relatedCreativeStyles.length).toBeGreaterThanOrEqual(1);
    expect(engine.getLearnedPatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates recommendations and supports search", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeBrand({
      brandId: "rec-brand",
      brandName: "Weak Brand",
      brandValues: ["value"],
      visual: { brandColors: ["#111111"] },
      communication: { marketingTone: "casual", brandVoice: "generic" },
    });

    const recs = engine.getRecommendations("rec-brand");
    expect(recs.length).toBeGreaterThan(0);

    const search = await engine.searchBrands({ brandName: "Weak" });
    expect(search.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("rejects invalid and inconsistent brand knowledge", async () => {
    const { core, engine } = await startCore();

    const invalid = await engine.analyzeBrand({ brandName: "" });
    expect(invalid.success).toBe(false);

    const inconsistent = await engine.analyzeBrand({
      brandName: "Bad Brand",
      brandValues: [],
      visual: { brandColors: ["#000"] },
    });
    expect(inconsistent.success).toBe(false);

    await core.stop();
  });
});
