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
  KnowledgeSource,
  KnowledgeStorageType,
  KnowledgeValidationLevel,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-validation-test-"));
}

describe("AiKnowledgeValidationEngine", () => {
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
    await core.start("knowledge-validation-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const creative = foundation.getCreativeKnowledgeEngine();
    const validation = foundation.getKnowledgeValidationEngine();
    const storage = foundation.getStorageEngine();
    return { core, foundation, creative, validation, storage };
  }

  it("initializes with knowledge foundation startup", async () => {
    const { core, validation } = await startCore();
    expect(validation.isInitialized()).toBe(true);
    expect(validation.isStartupComplete()).toBe(true);

    const validationDir = path.join(storageRoot, "knowledge", "validation", "engine");
    expect(fs.existsSync(validationDir)).toBe(true);

    await core.stop();
  });

  it("validates trusted creative knowledge", async () => {
    const { core, creative, validation } = await startCore();

    await creative.analyzeCreative({
      creativeId: "val-test-creative",
      projectName: "Validation Test Creative",
      domain: KnowledgeCreativeDomain.AdvertisingDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Premium,
      platform: KnowledgeCreativePlatform.Instagram,
      brandName: "KWIZERA",
      visual: { balance: 90, contrast: 88 },
      storytelling: { attentionRetention: 90 },
      animation: { animationQuality: 88 },
      tags: ["kwizera", "validation"],
    });

    const result = await validation.validateKnowledge("creative-knowledge-val-test-creative");
    expect(result.valid).toBe(true);
    expect(result.scores.qualityScore).toBeGreaterThan(50);

    await core.stop();
  });

  it("rejects incomplete knowledge", async () => {
    const { core, validation, storage } = await startCore();

    await storage.storeRecord(
      {
        knowledgeId: "incomplete-test",
        knowledgeType: KnowledgeStorageType.Technical,
        category: "test",
        title: "Incomplete",
        description: "tiny",
        source: KnowledgeSource.System,
        qualityScore: 30,
        confidenceScore: 30,
      },
      "knowledge-validation-test"
    );

    const result = await validation.validateKnowledge("incomplete-test");
    expect(result.trusted).toBe(false);
    expect(
      result.validationLevel === KnowledgeValidationLevel.Draft ||
        result.validationLevel === KnowledgeValidationLevel.PendingValidation ||
        result.validationLevel === KnowledgeValidationLevel.Rejected
    ).toBe(true);

    await core.stop();
  });

  it("validates known and unknown sources", async () => {
    const { core, validation } = await startCore();

    const known = validation.validateSource(KnowledgeSource.KnowledgeModule);
    expect(known.valid).toBe(true);

    const unknown = validation.validateSource("invalid-source");
    expect(unknown.valid).toBe(false);

    await core.stop();
  });

  it("runs batch validation and integrity checks", async () => {
    const { core, creative, validation } = await startCore();

    await creative.analyzeCreative({
      creativeId: "batch-test",
      projectName: "Batch Test",
      domain: KnowledgeCreativeDomain.PosterDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Bold,
      platform: KnowledgeCreativePlatform.Facebook,
      brandName: "KWIZERA",
      visual: { balance: 80 },
      tags: ["test"],
    });

    const batch = await validation.validateAll();
    expect(batch.totalRecords).toBeGreaterThan(0);

    const integrity = await validation.validateIntegrity();
    expect(integrity.recordsChecked).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates project-state reports", async () => {
    const { core, creative, validation } = await startCore();

    await creative.analyzeCreative({
      creativeId: "report-test",
      projectName: "Report Test",
      domain: KnowledgeCreativeDomain.SocialMediaDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Playful,
      platform: KnowledgeCreativePlatform.TikTok,
      brandName: "KWIZERA",
      visual: { balance: 82 },
      tags: ["test"],
    });

    await validation.validateAll();
    const paths = await validation.generateReports();

    expect(fs.existsSync(paths.validationReportPath)).toBe(true);
    expect(fs.existsSync(paths.qualityReportPath)).toBe(true);
    expect(fs.existsSync(paths.integrityReportPath)).toBe(true);

    await core.stop();
  });

  it("writes logs to storage root logs directory", async () => {
    const { core, validation } = await startCore();
    const logDir = path.join(storageRoot, "logs");
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `knowledge-validation-engine-${date}.jsonl`);

    expect(fs.existsSync(logFile)).toBe(true);
    expect(validation.logger.getLogDirectory()).toBe(logDir);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, creative, validation } = await startCore();

    await creative.analyzeCreative({
      creativeId: "status-test",
      projectName: "Status Test",
      domain: KnowledgeCreativeDomain.AdvertisingDesign,
      creativeStyle: KnowledgeCreativeDirectionStyle.Premium,
      platform: KnowledgeCreativePlatform.Instagram,
      brandName: "KWIZERA",
      visual: { balance: 85 },
      tags: ["test"],
    });

    await validation.validateAll();
    const report = validation.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);

    await core.stop();
  });
});
