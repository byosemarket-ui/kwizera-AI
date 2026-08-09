import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiWorkflowModelOptimizationEngine } from "../../../../ai/workflow-model-optimization/index.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      try {
        await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* ignore */
      }
    }),
  );
});

describe("AiWorkflowModelOptimizationEngine (Learning Step 7)", () => {
  it("optimizes workflows, selects quality-first models, and preserves history", () => {
    const root = path.join(os.tmpdir(), `kwizera-wmo-${Date.now()}`);
    roots.push(root);
    const engine = new AiWorkflowModelOptimizationEngine();
    engine.initialize(root);

    const result = engine.optimize({
      workflows: [
        {
          workflowId: "wf1",
          name: "Main Pipeline",
          version: 1,
          successCount: 3,
          failureCount: 2,
          avgExecutionMs: 220_000,
          avgQuality: 70,
          steps: ["rendering", "video-generation", "image-generation", "product-intelligence"],
        },
      ],
      models: [
        { modelId: "img-q", task: "image-generation", outputQuality: 90, processingSpeedScore: 60, stabilityScore: 92, errorRate: 1 },
        { modelId: "img-f", task: "image-generation", outputQuality: 70, processingSpeedScore: 95, stabilityScore: 75, errorRate: 8 },
        { modelId: "vid-q", task: "video-generation", outputQuality: 88, videoQuality: 89, processingSpeedScore: 55, stabilityScore: 90, errorRate: 2 },
      ],
      context: { qualityRequirement: 80, allowQualityTradeoffForSpeed: false },
    });

    expect(result.optimizedWorkflows.length).toBeGreaterThanOrEqual(1);
    expect(result.optimizedWorkflows[0]!.optimizedSteps[0]).toBe("product-intelligence");
    expect(result.modelSelections.find((s) => s.task === "image-generation")?.primaryModelId).toBe("img-q");
    expect(result.qualityNeverReducedAutomatically).toBe(true);
    expect(result.autonomousImprovementDeferred).toBe(false);
    expect(result.historyPreserved).toBe(true);
    expect(result.optimizationMemory.length).toBeGreaterThanOrEqual(1);

    const explained = engine.explain("wf1");
    expect(explained.predictedProductionQuality).toBeGreaterThan(0);
    expect(engine.getAiMeAwareness().canExplainModelSelection).toBe(true);

    const before = engine.getOptimizationMemory().length;
    engine.optimize({
      workflows: [
        {
          workflowId: "wf2",
          name: "Alt",
          avgExecutionMs: 200_000,
          avgQuality: 72,
          successCount: 2,
          failureCount: 1,
          steps: ["video-generation", "product-intelligence", "rendering"],
        },
      ],
      models: [{ modelId: "vid-q", task: "video-generation", outputQuality: 85 }],
    });
    expect(engine.getOptimizationMemory().length).toBeGreaterThanOrEqual(before);

    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });
});
