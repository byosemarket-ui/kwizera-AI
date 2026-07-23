import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  ProductIntelligenceAccessOperation,
  ProductIntelligenceCategory,
  ProductIntelligenceLifecycleState,
  ProductIntelligenceModuleStatus,
  PREPARED_PRODUCT_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-product-intelligence-test-"));
}

describe("AiProductIntelligenceFoundation", () => {
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
    await core.start("product-intelligence-foundation-test");

    const foundation = core.getManager().productIntelligenceFoundation!;
    expect(foundation.isInitialized()).toBe(true);
    expect(foundation.isStartupComplete()).toBe(true);
    expect(foundation.getLifecycleState()).toBe(ProductIntelligenceLifecycleState.Ready);

    const logDir = foundation.logger.getLogDirectory();
    expect(logDir).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(logDir!)).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(storageRoot, "logs", `product-intelligence-foundation-${logDate}.jsonl`))
    ).toBe(true);

    await core.stop();
  });

  it("creates registry with all prepared modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    const modules = foundation.getRegistry().getAllModules();

    expect(modules).toHaveLength(PREPARED_PRODUCT_INTELLIGENCE_MODULES.length);
    expect(modules.every((m) => !m.implemented)).toBe(true);
    expect(modules.find((m) => m.moduleId === "product-analysis-engine")?.category).toBe(
      ProductIntelligenceCategory.ProductAnalysis
    );
    expect(fs.existsSync(foundation.getIntelligenceRoot())).toBe(true);

    await core.stop();
  });

  it("registers sample module and grants access", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    const existing = foundation.getRegistry().getModule("product-analysis-engine")!;

    foundation.registerProductIntelligenceModule({
      ...existing,
      version: "0.1.0",
      status: ProductIntelligenceModuleStatus.Registered,
      qualityScore: 90,
      confidenceScore: 88,
      implemented: false,
    });

    const registered = foundation.getRegistry().getModule("product-analysis-engine");
    expect(registered?.status).toBe(ProductIntelligenceModuleStatus.Registered);
    expect(registered?.version).toBe("0.1.0");

    const access = await foundation.requestAccess({
      requesterId: "unit-test",
      category: ProductIntelligenceCategory.ProductAnalysis,
      operation: ProductIntelligenceAccessOperation.Read,
    });
    expect(access.granted).toBe(true);

    await core.stop();
  });

  it("reports integration with memory and knowledge engines", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    const status = foundation.buildStatusReport();

    expect(status.integrationStatus.memoryEngine).toBe(true);
    expect(status.integrationStatus.knowledgeEngine).toBe(true);
    expect(status.integrationStatus.aiCore).toBe(true);
    expect(status.readinessScore).toBe(100);

    await core.stop();
  });

  it("registers product-engine plugin slot", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const entry = core.getManager().registry.getEntry("product-engine");
    expect(entry?.status).toBe("initialized");

    await core.stop();
  });
});
