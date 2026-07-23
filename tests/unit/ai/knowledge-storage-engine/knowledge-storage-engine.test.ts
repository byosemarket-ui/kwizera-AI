import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeStorageType,
  KnowledgeStorageValidationCode,
  KnowledgeVerificationStatus,
  KNOWLEDGE_STORAGE_TYPE_DEFINITIONS,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-storage-test-"));
}

describe("AiKnowledgeStorageEngine", () => {
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
    await core.start("knowledge-storage-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const storage = foundation.getStorageEngine();
    return { core, foundation, storage };
  }

  it("initializes with knowledge foundation startup", async () => {
    const { core, storage } = await startCore();
    expect(storage.isInitialized()).toBe(true);
    expect(storage.isStartupComplete()).toBe(true);

    const recordsRoot = path.join(storageRoot, "knowledge", "records");
    expect(fs.existsSync(recordsRoot)).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(fs.existsSync(path.join(storageRoot, "logs", `knowledge-storage-engine-${logDate}.jsonl`))).toBe(
      true
    );

    await core.stop();
  });

  it("prepares storage directories for all knowledge types", async () => {
    const { core, storage } = await startCore();
    const recordsRoot = path.join(storageRoot, "knowledge", "records");

    expect(KNOWLEDGE_STORAGE_TYPE_DEFINITIONS).toHaveLength(13);
    for (const def of KNOWLEDGE_STORAGE_TYPE_DEFINITIONS) {
      expect(fs.existsSync(path.join(recordsRoot, def.subdirectory))).toBe(true);
    }

    expect(storage.buildStatusReport().supportedTypes).toBe(13);
    await core.stop();
  });

  it("stores and retrieves knowledge records with classification", async () => {
    const { core, storage } = await startCore();

    const result = await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Marketing,
      category: "marketing",
      title: "KWIZERA Launch Campaign Knowledge",
      description: "Marketing knowledge for KWIZERA AI STUDIO launch campaign targeting creative professionals.",
      source: "marketing-memory-engine",
      tags: ["kwizera", "launch"],
      qualityScore: 90,
      confidenceScore: 88,
      sourceReliability: 85,
    });

    expect(result.success).toBe(true);
    expect(result.record?.classification.topic).toBeTruthy();
    expect(result.record?.classification.importance).toBe("high");

    const read = await storage.getRecord(result.record!.knowledgeId);
    expect(read.success).toBe(true);
    expect(read.record?.title).toBe("KWIZERA Launch Campaign Knowledge");

    await core.stop();
  });

  it("rejects invalid and duplicate knowledge", async () => {
    const { core, storage } = await startCore();

    const invalid = await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Technical,
      category: "",
      title: "",
      description: "",
      source: "",
    });
    expect(invalid.success).toBe(false);

    await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Workflow,
      category: "workflow",
      title: "Workflow Knowledge Probe",
      description: "Workflow knowledge for validation duplicate detection.",
      source: "test",
    });

    const duplicate = await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Workflow,
      category: "workflow",
      title: "Workflow Knowledge Probe",
      description: "Workflow knowledge for validation duplicate detection.",
      source: "test",
    });
    expect(duplicate.success).toBe(false);
    expect(duplicate.validation?.code).toBe(KnowledgeStorageValidationCode.DuplicateRecord);

    await core.stop();
  });

  it("maintains version history and supports rollback", async () => {
    const { core, storage } = await startCore();

    const created = await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Reasoning,
      category: "reasoning",
      title: "Reasoning Knowledge Version Test",
      description: "Initial reasoning knowledge for version management validation.",
      source: "reasoning-engine",
    });

    const knowledgeId = created.record!.knowledgeId;
    const updated = await storage.updateRecord(knowledgeId, {
      description: "Updated reasoning knowledge description",
      qualityScore: 95,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    expect(updated.version).toBe(2);
    expect(storage.listVersions(knowledgeId).length).toBeGreaterThanOrEqual(2);

    const rollback = await storage.rollbackToVersion(knowledgeId, 1);
    expect(rollback.success).toBe(true);
    expect(rollback.version).toBeGreaterThanOrEqual(3);

    await core.stop();
  });

  it("rejects unverified knowledge marked as trusted", async () => {
    const { core, storage } = await startCore();

    const result = await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Business,
      category: "business",
      title: "Low Quality Business Knowledge",
      description: "Should not allow verified status at low quality.",
      source: "test",
      qualityScore: 30,
      confidenceScore: 25,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    expect(result.success).toBe(false);
    await core.stop();
  });

  it("runs integrity check and builds status report", async () => {
    const { core, storage } = await startCore();

    await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Industry,
      category: "industry",
      title: "Creative Software Industry Knowledge",
      description: "Industry knowledge about creative software market trends.",
      source: "test",
    });

    const integrity = storage.runIntegrityCheck();
    expect(integrity.verified).toBe(true);

    const report = storage.buildStatusReport();
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.engineStatus).toBe("operational");

    await core.stop();
  });
});
