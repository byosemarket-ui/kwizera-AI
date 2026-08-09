import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeGenerationCertificationManager } from "../../../../ai/creative-generation-certification/creative-generation-certification-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => {
    try {
      await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* best-effort cleanup on Windows locks */
    }
  }));
});

describe("CreativeGenerationCertificationManager", () => {
  it("runs a shoe Product-to-Video scenario through Steps 1–9", { timeout: 600_000 }, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-creative-gen-cert-"));
    roots.push(root);
    const manager = new CreativeGenerationCertificationManager();
    await manager.initialize(root, { core: undefined as unknown as AiCoreManager });

    const result = await manager.certify({ autoRepair: true, kinds: ["shoe"] });
    expect(result.creativePipelineStep).toBe(10);
    expect(result.version).toBe("1.0");
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].kind).toBe("shoe");
    expect(result.scenarios[0].passed).toBe(true);
    expect(result.scenarios[0].platformExportCount).toBeGreaterThanOrEqual(6);
    expect(result.scenarios[0].productPreservationScore).toBeGreaterThanOrEqual(70);
    expect(result.scenarios[0].marketingQualityScore).toBeGreaterThanOrEqual(70);
    expect(Object.values(result.stages).every((item) => item.status === "passed")).toBe(true);
    expect(result.productionReady).toBe(false);
    expect(result.blockers.some((item) => item.includes("Full certification requires"))).toBe(true);

    const awareness = manager.getAiMeCreativeGenerationCertificationAwareness();
    expect(awareness.available).toBe(true);
    expect(awareness.canCertifyPipeline).toBe(true);

    const explained = await manager.explainCertification();
    expect(explained.scenarioSummaries[0].kind).toBe("shoe");
    expect(explained.summary.length).toBeGreaterThan(20);

    const health = await manager.runHealthCheck();
    expect(health.checks.some((item) => item.name === "runtime-initialized" && item.passed)).toBe(true);
  });
});
