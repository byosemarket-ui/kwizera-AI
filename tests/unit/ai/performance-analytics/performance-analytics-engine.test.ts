import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiPerformanceAnalyticsEngine } from "../../../../ai/performance-analytics/index.js";

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

describe("AiPerformanceAnalyticsEngine (Learning Step 5)", () => {
  it("analyzes pipeline performance, detects bottlenecks, recommends models, and preserves history", () => {
    const root = path.join(os.tmpdir(), `kwizera-perf-${Date.now()}`);
    roots.push(root);
    const engine = new AiPerformanceAnalyticsEngine();
    engine.initialize(root);

    const result = engine.ingestSessions([
      {
        projectId: "p1",
        sources: ["image-generation", "video-generation", "rendering"],
        timings: {
          imageGenerationMs: 50_000,
          videoGenerationMs: 100_000,
          renderingMs: 70_000,
          overallPipelineMs: 230_000,
        },
        resources: { cpuPercent: 92, gpuPercent: 95, ramMb: 10_000, diskSpeedMBps: 50 },
        quality: { imageQuality: 75, videoQuality: 72, renderingQuality: 70, marketingQuality: 74 },
        models: [
          { modelId: "a", task: "image-generation", speedScore: 90, outputQuality: 70, failureRate: 5 },
          { modelId: "b", task: "image-generation", speedScore: 60, outputQuality: 92, accuracyScore: 90, failureRate: 1 },
        ],
        errorCount: 1,
      },
    ]);

    expect(result.sessions).toHaveLength(1);
    expect(result.bottlenecks.length).toBeGreaterThan(0);
    expect(result.optimizations.length).toBeGreaterThan(0);
    expect(result.bestModels["image-generation"]).toBe("b");
    expect(result.autonomousLearningDeferred).toBe(false);
    expect(result.historyPreserved).toBe(true);

    const explained = engine.explain(result.sessions[0]!.id);
    expect(explained.predictedProductionTimeMs).toBeGreaterThan(0);
    expect(engine.getAiMeAwareness().canExplainBottlenecks).toBe(true);

    const before = engine.getSessions().length;
    engine.ingestSessions([
      {
        projectId: "p1",
        sources: ["audio-generation"],
        timings: { overallPipelineMs: 90_000, audioGenerationMs: 20_000 },
        resources: { cpuPercent: 40, gpuPercent: 30 },
        quality: { audioQuality: 88 },
      },
    ]);
    expect(engine.getSessions().length).toBe(before + 1);

    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });
});
