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
  KnowledgeTier,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-optimization-test-"));
}

describe("AiKnowledgeOptimizationEngine", () => {
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
    await core.start("knowledge-optimization-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const creative = foundation.getCreativeKnowledgeEngine();
    const optimization = foundation.getKnowledgeOptimizationEngine();
    return { core, foundation, creative, optimization };
  }

  async function seedCreative(
    creative: Awaited<ReturnType<typeof startCore>>["creative"]
  ) {
    await creative.analyzeCreative({
      creativeId: "opt-test-creative",
      projectName: "Optimization Test Creative",
      domain: KnowledgeCreativeDomain.AdvertisingDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Premium,
      platform: KnowledgeCreativePlatform.Instagram,
      brandName: "KWIZERA",
      visual: { balance: 85, contrast: 80 },
      storytelling: { attentionRetention: 88 },
      animation: { animationQuality: 85 },
      tags: ["kwizera", "optimization", "test"],
    });
  }

  it("initializes with knowledge foundation startup", async () => {
    const { core, optimization } = await startCore();
    expect(optimization.isInitialized()).toBe(true);
    expect(optimization.isStartupComplete()).toBe(true);

    const optimizationDir = path.join(storageRoot, "knowledge", "optimization", "engine");
    expect(fs.existsSync(optimizationDir)).toBe(true);

    await core.stop();
  });

  it("analyzes knowledge system metrics", async () => {
    const { core, creative, optimization } = await startCore();
    await seedCreative(creative);

    const analysis = await optimization.analyzeKnowledge();
    expect(analysis.totalRecords).toBeGreaterThan(0);
    expect(analysis.indexQualityScore).toBeGreaterThan(0);
    expect(analysis.durationMs).toBeGreaterThanOrEqual(0);

    await core.stop();
  });

  it("classifies knowledge into tiers", async () => {
    const { core, creative, optimization } = await startCore();
    await seedCreative(creative);

    const tiers = optimization.classifyTiers();
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers.some((t) => t.tier === KnowledgeTier.Creative || t.tier === KnowledgeTier.Core)).toBe(
      true
    );

    await core.stop();
  });

  it("detects duplicate records by fingerprint", async () => {
    const { core, creative, optimization } = await startCore();
    await seedCreative(creative);

    const duplicates = optimization.detectDuplicates();
    expect(Array.isArray(duplicates)).toBe(true);

    await core.stop();
  });

  it("creates recovery points before optimization", async () => {
    const { core, creative, optimization } = await startCore();
    await seedCreative(creative);

    const point = optimization.createRecoveryPoint("test-recovery");
    expect(point.recoveryPointId).toContain("rp-");
    expect(optimization.listRecoveryPoints().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("runs full optimization with integrity verification", async () => {
    const { core, creative, optimization } = await startCore();
    await seedCreative(creative);

    const result = await optimization.runOptimization();
    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.recoveryPointId).toContain("rp-");

    const integrity = await optimization.verifyIntegrity();
    expect(integrity.valid).toBe(true);
    expect(integrity.recordsIntact).toBe(true);
    expect(integrity.indexesValid).toBe(true);

    await core.stop();
  });

  it("optimizes cache for frequently used knowledge", async () => {
    const { core, foundation, creative, optimization } = await startCore();
    await seedCreative(creative);

    const retrieval = foundation.getRetrievalEngine();
    await retrieval.retrieve("opt-test-creative", "knowledge-optimization-test");
    await retrieval.retrieve("opt-test-creative", "knowledge-optimization-test");
    await retrieval.retrieve("opt-test-creative", "knowledge-optimization-test");

    optimization.classifyTiers();
    const cacheResult = await optimization.optimizeCache();
    expect(cacheResult.priorityIds.length).toBeGreaterThanOrEqual(0);

    const priorityFile = path.join(
      storageRoot,
      "knowledge",
      "optimization",
      "engine",
      "cache-priority.json"
    );
    expect(fs.existsSync(priorityFile)).toBe(true);

    await core.stop();
  });

  it("writes logs to storage root logs directory", async () => {
    const { core, optimization } = await startCore();
    const logDir = path.join(storageRoot, "logs");
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `knowledge-optimization-engine-${date}.jsonl`);

    expect(fs.existsSync(logFile)).toBe(true);
    expect(optimization.logger.getLogDirectory()).toBe(logDir);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, creative, optimization } = await startCore();
    await seedCreative(creative);
    await optimization.runOptimization();

    const report = optimization.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);
    expect(report.totalOptimizations).toBeGreaterThan(0);

    await core.stop();
  });
});
