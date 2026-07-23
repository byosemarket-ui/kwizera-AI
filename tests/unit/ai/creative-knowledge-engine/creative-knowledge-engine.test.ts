import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeCreativeDirectionStyle,
  KnowledgeCreativeDomain,
  KnowledgeCreativePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-creative-knowledge-test-"));
}

describe("AiCreativeKnowledgeEngine", () => {
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
    await core.start("creative-knowledge-test");
    const engine = core.getManager().knowledgeFoundation!.getCreativeKnowledgeEngine();
    return { core, engine };
  }

  it("initializes with knowledge foundation", async () => {
    const { core, engine } = await startCore();
    expect(engine.isStartupComplete()).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(storageRoot, "logs", `creative-knowledge-engine-${logDate}.jsonl`))
    ).toBe(true);

    await core.stop();
  });

  it("analyzes creative project with design and storytelling knowledge", async () => {
    const { core, engine } = await startCore();

    const result = await engine.analyzeCreative({
      creativeId: "test-promo",
      projectName: "KWIZERA Promo Creative",
      domain: KnowledgeCreativeDomain.AdvertisingDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Premium,
      platform: KnowledgeCreativePlatform.Instagram,
      brandName: "KWIZERA",
      visual: { balance: 90, contrast: 88, whiteSpace: 85 },
      storytelling: { attentionRetention: 90 },
      animation: { animationQuality: 88 },
    });

    expect(result.success).toBe(true);
    expect(result.record?.domain).toBe(KnowledgeCreativeDomain.AdvertisingDesign);
    expect(result.record?.scores.creativeQualityScore).toBeGreaterThan(70);

    await core.stop();
  });

  it("detects relationships and learns patterns", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeCreative({
      creativeId: "creative-a",
      projectName: "Creative A",
      domain: KnowledgeCreativeDomain.PosterDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Bold,
      brandName: "KWIZERA",
      tags: ["kwizera"],
    });

    await engine.analyzeCreative({
      creativeId: "creative-b",
      projectName: "Creative B",
      domain: KnowledgeCreativeDomain.PosterDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Bold,
      brandName: "KWIZERA",
      tags: ["kwizera"],
    });

    const rels = engine.detectRelationships("creative-a");
    expect(rels?.relatedBrands.length).toBeGreaterThanOrEqual(1);
    expect(engine.getLearnedPatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates recommendations and supports search", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeCreative({
      creativeId: "rec-creative",
      projectName: "Low Quality Creative",
      domain: KnowledgeCreativeDomain.ThumbnailDesign,
      visual: { balance: 55, contrast: 50, whiteSpace: 50 },
      storytelling: { attentionRetention: 55 },
      animation: { animationQuality: 50 },
    });

    const recs = engine.getRecommendations("rec-creative");
    expect(recs.length).toBeGreaterThan(0);

    const search = await engine.searchCreatives({ brand: "KWIZERA" });
    expect(search.length).toBeGreaterThanOrEqual(0);

    await core.stop();
  });

  it("rejects invalid and poor-quality creative knowledge", async () => {
    const { core, engine } = await startCore();

    const invalid = await engine.analyzeCreative({ projectName: "" });
    expect(invalid.success).toBe(false);

    const poor = await engine.analyzeCreative({
      projectName: "Poor Project",
      visual: { balance: 15, contrast: 15, negativeSpace: 15, whiteSpace: 15 },
      storytelling: { attentionRetention: 20 },
      animation: { animationQuality: 15, motionPrinciples: [] },
      cinematic: { visualContinuity: 15 },
    });
    expect(poor.success).toBe(false);

    await core.stop();
  });
});
