import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeAccessOperation,
  KnowledgeCategory,
  KnowledgeLifecycleState,
  KnowledgeModuleStatus,
  KnowledgeSource,
  KnowledgeVerificationStatus,
  PREPARED_KNOWLEDGE_CATEGORIES,
  SUPPORTED_KNOWLEDGE_SOURCES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-foundation-test-"));
}

describe("AiKnowledgeFoundation", () => {
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

  it("initializes with AI Core and writes logs to storage logs directory", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-foundation-test");

    const foundation = core.getManager().knowledgeFoundation!;
    expect(foundation.isInitialized()).toBe(true);
    expect(foundation.isStartupComplete()).toBe(true);
    expect(foundation.getLifecycleState()).toBe(KnowledgeLifecycleState.Ready);

    const logDir = foundation.logger.getLogDirectory();
    expect(logDir).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(logDir!)).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(fs.existsSync(path.join(storageRoot, "logs", `knowledge-foundation-${logDate}.jsonl`))).toBe(
      true
    );

    await core.stop();
  });

  it("creates knowledge registry with all prepared categories", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().knowledgeFoundation!;
    const modules = foundation.getRegistry().getAllModules();

    expect(modules).toHaveLength(PREPARED_KNOWLEDGE_CATEGORIES.length);
    expect(modules.every((m) => !m.implemented)).toBe(true);
    expect(modules.find((m) => m.knowledgeId === "product-knowledge")?.category).toBe(
      KnowledgeCategory.Product
    );
    expect(fs.existsSync(foundation.getKnowledgeRoot())).toBe(true);

    await core.stop();
  });

  it("persists registry across application restart", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("persist-test");
    const registryPath = path.join(storageRoot, "knowledge", "registry", "knowledge-registry.json");
    expect(fs.existsSync(registryPath)).toBe(true);
    await core.stop("persist-test");
    AiCore.resetInstance();

    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("persist-test-restart");
    const foundation = core2.getManager().knowledgeFoundation!;
    expect(foundation.getRegistry().getPreparedCount()).toBe(PREPARED_KNOWLEDGE_CATEGORIES.length);
    expect(foundation.getRegistry().verifyChecksum()).toBe(true);
    await core2.stop();
  });

  it("coordinates centralized knowledge access", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().knowledgeFoundation!;
    const read = await foundation.requestAccess({
      requesterId: "test-module",
      category: KnowledgeCategory.Video,
      operation: KnowledgeAccessOperation.Read,
    });
    expect(read.granted).toBe(true);
    expect(read.storagePath).toContain("videos");

    const validate = await foundation.requestAccess({
      requesterId: "test-module",
      category: KnowledgeCategory.Workflow,
      operation: KnowledgeAccessOperation.Validate,
    });
    expect(validate.granted).toBe(true);

    await core.stop();
  });

  it("validates knowledge quality metadata", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().knowledgeFoundation!;
    const result = foundation.validateKnowledge({
      qualityScore: 90,
      confidenceScore: 88,
      verificationStatus: KnowledgeVerificationStatus.Pending,
      source: KnowledgeSource.Project,
      versionHistory: [
        {
          version: 1,
          timestamp: new Date().toISOString(),
          changeSummary: "Test knowledge",
          source: KnowledgeSource.Project,
        },
      ],
      relationshipLinks: ["project-memory"],
    });

    expect(result.valid).toBe(true);
    expect(result.verificationStatus).toBe(KnowledgeVerificationStatus.Verified);

    await core.stop();
  });

  it("registers future knowledge modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().knowledgeFoundation!;
    foundation.registerKnowledgeModule({
      knowledgeId: "product-knowledge",
      knowledgeName: "Product Knowledge",
      version: "0.1.0",
      status: KnowledgeModuleStatus.Registered,
      dependencies: ["knowledge-engine", "memory-engine"],
      source: KnowledgeSource.Product,
      qualityScore: 70,
      confidenceScore: 65,
      accessPermissions: [],
      category: KnowledgeCategory.Product,
      storageLocation: path.join(foundation.getKnowledgeRoot(), "products"),
      implemented: false,
    });

    const registered = foundation.getRegistry().getModule("product-knowledge");
    expect(registered?.status).toBe(KnowledgeModuleStatus.Registered);
    expect(registered?.version).toBe("0.1.0");
    expect(foundation.getRegistry().getRegisteredCount()).toBeGreaterThan(0);

    await core.stop();
  });

  it("integrates with memory engine and core AI systems", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().knowledgeFoundation!;
    const report = foundation.buildStatusReport();

    expect(report.integrationStatus.memoryEngine).toBe(true);
    expect(report.integrationStatus.aiCore).toBe(true);
    expect(report.integrationStatus.readyCount).toBeGreaterThanOrEqual(8);
    expect(SUPPORTED_KNOWLEDGE_SOURCES.length).toBeGreaterThanOrEqual(10);

    await core.stop();
  });

  it("runs health check and builds status report with readiness score", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().knowledgeFoundation!;
    const health = await foundation.runHealthCheck();
    const report = foundation.buildStatusReport();

    expect(health.score).toBeGreaterThanOrEqual(80);
    expect(health.integrationReady).toBe(true);
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.foundationStatus).toBe("operational");

    await core.stop();
  });

  it("registers knowledge-engine plugin with module manager", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const entry = core.getManager().registry.getEntry("knowledge-engine");
    expect(entry?.status).toBe("initialized");

    await core.stop();
  });
});
