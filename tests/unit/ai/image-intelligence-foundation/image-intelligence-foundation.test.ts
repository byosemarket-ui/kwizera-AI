import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  ImageIntelligenceAccessOperation,
  ImageIntelligenceCategory,
  ImageIntelligenceLifecycleState,
  ImageIntelligenceModuleStatus,
  PREPARED_IMAGE_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-image-intelligence-test-"));
}

describe("AiImageIntelligenceFoundation", () => {
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
    await core.start("image-intelligence-foundation-test");

    const foundation = core.getManager().imageIntelligenceFoundation!;
    expect(foundation.isInitialized()).toBe(true);
    expect(foundation.isStartupComplete()).toBe(true);
    expect(foundation.getLifecycleState()).toBe(ImageIntelligenceLifecycleState.Ready);

    const logDir = foundation.logger.getLogDirectory();
    expect(logDir).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(logDir!)).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(storageRoot, "logs", `image-intelligence-foundation-${logDate}.jsonl`))
    ).toBe(true);

    await core.stop();
  });

  it("creates registry with all prepared modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    const modules = foundation.getRegistry().getAllModules();

    expect(modules).toHaveLength(PREPARED_IMAGE_INTELLIGENCE_MODULES.length);
    expect(modules.every((m) => !m.implemented)).toBe(true);
    expect(modules.find((m) => m.moduleId === "image-analysis-engine")?.category).toBe(
      ImageIntelligenceCategory.ImageAnalysis
    );
    expect(fs.existsSync(foundation.getIntelligenceRoot())).toBe(true);

    await core.stop();
  });

  it("registers sample module and grants access", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    const existing = foundation.getRegistry().getModule("image-analysis-engine")!;

    foundation.registerImageIntelligenceModule({
      ...existing,
      version: "0.1.0",
      status: ImageIntelligenceModuleStatus.Registered,
      qualityScore: 90,
      confidenceScore: 88,
      implemented: false,
    });

    const registered = foundation.getRegistry().getModule("image-analysis-engine");
    expect(registered?.status).toBe(ImageIntelligenceModuleStatus.Registered);
    expect(registered?.version).toBe("0.1.0");

    const access = await foundation.requestAccess({
      requesterId: "unit-test",
      category: ImageIntelligenceCategory.ImageAnalysis,
      operation: ImageIntelligenceAccessOperation.Read,
    });
    expect(access.granted).toBe(true);

    await core.stop();
  });

  it("reports integration with memory, knowledge, and product intelligence engines", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    const status = foundation.buildStatusReport();

    expect(status.integrationStatus.memoryEngine).toBe(true);
    expect(status.integrationStatus.knowledgeEngine).toBe(true);
    expect(status.integrationStatus.productIntelligenceEngine).toBe(true);
    expect(status.integrationStatus.aiCore).toBe(true);
    expect(status.readinessScore).toBe(100);

    await core.stop();
  });

  it("registers image-engine plugin slot", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const entry = core.getManager().registry.getEntry("image-engine");
    expect(entry?.status).toBe("initialized");

    await core.stop();
  });
});
