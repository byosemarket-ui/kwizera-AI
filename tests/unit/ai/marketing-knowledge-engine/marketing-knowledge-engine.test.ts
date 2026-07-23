import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeCampaignType,
  KnowledgeMarketingGoal,
  KnowledgeMarketingPlatform,
  MarketingStyle,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-marketing-knowledge-test-"));
}

describe("AiMarketingKnowledgeEngine", () => {
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
    await core.start("marketing-knowledge-test");
    const engine = core.getManager().knowledgeFoundation!.getMarketingKnowledgeEngine();
    return { core, engine };
  }

  it("initializes with knowledge foundation", async () => {
    const { core, engine } = await startCore();
    expect(engine.isStartupComplete()).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(storageRoot, "logs", `marketing-knowledge-engine-${logDate}.jsonl`))
    ).toBe(true);

    await core.stop();
  });

  it("analyzes conversion campaign with customer understanding", async () => {
    const { core, engine } = await startCore();

    const result = await engine.analyzeCampaign({
      campaignId: "test-conversion",
      campaignName: "Test Conversion Campaign",
      campaignType: KnowledgeCampaignType.Conversion,
      marketingGoal: KnowledgeMarketingGoal.Conversion,
      product: "KWIZERA Pro",
      brandName: "KWIZERA",
      platform: KnowledgeMarketingPlatform.Instagram,
      audience: "creative professionals",
      brand: { brandConsistency: 90 },
      campaign: { marketingStyle: MarketingStyle.StoryDriven, brandingConsistency: 88 },
      customer: {
        customerIntent: "improve workflow",
        customerNeeds: ["speed", "quality", "consistency"],
        buyingTriggers: ["demo", "testimonials"],
        trustFactors: ["case studies"],
        decisionFactors: ["ROI"],
      },
      storytelling: { hookTiming: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.record?.customer.customerNeeds.length).toBeGreaterThanOrEqual(2);
    expect(result.record?.scores.conversionReadinessScore).toBeGreaterThan(60);

    await core.stop();
  });

  it("detects relationships and learns patterns", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeCampaign({
      campaignId: "camp-a",
      campaignName: "Campaign A",
      brandName: "KWIZERA",
      platform: KnowledgeMarketingPlatform.Instagram,
      campaign: { marketingStyle: MarketingStyle.StoryDriven },
      tags: ["kwizera"],
    });

    await engine.analyzeCampaign({
      campaignId: "camp-b",
      campaignName: "Campaign B",
      brandName: "KWIZERA",
      platform: KnowledgeMarketingPlatform.Instagram,
      campaign: { marketingStyle: MarketingStyle.StoryDriven },
      tags: ["kwizera"],
    });

    const rels = engine.detectRelationships("camp-a");
    expect(rels?.relatedCampaigns.length).toBeGreaterThanOrEqual(1);
    expect(rels?.relatedBrands.length).toBeGreaterThanOrEqual(1);
    expect(engine.getLearnedPatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates recommendations and supports search", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeCampaign({
      campaignId: "rec-camp",
      campaignName: "Low Structure Campaign",
      brandName: "KWIZERA",
      campaign: { brandingConsistency: 55 },
      storytelling: { hookTiming: 10 },
    });

    const recs = engine.getRecommendations("rec-camp");
    expect(recs.length).toBeGreaterThan(0);

    const search = await engine.searchCampaigns({ brand: "KWIZERA" });
    expect(search.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("rejects invalid and low-quality analysis", async () => {
    const { core, engine } = await startCore();

    const invalid = await engine.analyzeCampaign({ campaignName: "" });
    expect(invalid.success).toBe(false);

    const low = await engine.analyzeCampaign({
      campaignName: "Bad Campaign",
      brand: { brandConsistency: 15 },
      campaign: { brandingConsistency: 15 },
      customer: {
        customerNeeds: [],
        buyingTriggers: [],
        trustFactors: [],
        decisionFactors: [],
      },
      structure: { hook: "", callToAction: "", benefits: [], socialProof: "" },
      storytelling: { hookTiming: 20 },
    });
    expect(low.success).toBe(false);

    await core.stop();
  });
});
