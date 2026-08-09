import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiLocalResourceManagerEngine } from "../../../../ai/local-resource-manager/index.js";

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

describe("AiLocalResourceManagerEngine (Platform Step 4)", () => {
  it("monitors resources, schedules by mode, protects non-critical jobs, forecasts", () => {
    const root = path.join(os.tmpdir(), `kwizera-lrm-${Date.now()}`);
    roots.push(root);
    const engine = new AiLocalResourceManagerEngine();
    engine.initialize(root);

    engine.setMetricsOverride({
      cpuUsage: 40,
      gpuUsage: 30,
      ramUsage: 45,
      vramUsage: 20,
      diskUsage: 50,
      systemRamTotalMb: 16384,
      gpuMemoryTotalMb: 8192,
    });
    expect(engine.collectMetrics().cpuUsage).toBe(40);

    engine.setProductionMode("power-saving");
    expect(engine.getProductionMode()).toBe("power-saving");
    expect(engine.toQueueSnapshot(0).maxParallel).toBe(1);

    engine.setProductionMode("balanced");
    const decisions = engine.scheduleJobs([
      {
        jobId: "a",
        jobType: "rendering",
        priority: "critical",
        status: "waiting",
        estimatedDurationMs: 5000,
        dependsOnSatisfied: true,
      },
      {
        jobId: "b",
        jobType: "ai-learning",
        priority: "low",
        status: "waiting",
        estimatedDurationMs: 5000,
        dependsOnSatisfied: true,
        isBackground: true,
      },
      {
        jobId: "r",
        jobType: "video-generation",
        priority: "high",
        status: "running",
        estimatedDurationMs: 10_000,
        dependsOnSatisfied: true,
        progress: 20,
      },
    ]);
    expect(decisions.find((d) => d.jobId === "a")?.allowStart).toBe(true);
    expect(decisions.find((d) => d.jobId === "b")?.allowStart).toBe(false);

    const paused: string[] = [];
    engine.attachProductionQueue({ pause: (id) => paused.push(id) });
    engine.setMetricsOverride({
      cpuUsage: 96,
      gpuUsage: 95,
      ramUsage: 93,
      vramUsage: 90,
      diskUsage: 96,
      gpuTemperatureC: 88,
      systemRamTotalMb: 8192,
      gpuMemoryTotalMb: 4096,
    });
    engine.applyAutoProtection([
      {
        jobId: "bg1",
        jobType: "ai-learning",
        priority: "low",
        status: "running",
        estimatedDurationMs: 5000,
        dependsOnSatisfied: true,
        isBackground: true,
      },
      {
        jobId: "c1",
        jobType: "rendering",
        priority: "critical",
        status: "running",
        estimatedDurationMs: 5000,
        dependsOnSatisfied: true,
      },
    ]);
    expect(paused).toContain("bg1");
    expect(paused).not.toContain("c1");

    expect(engine.getAiMeAwareness().automationEngineDeferred).toBe(false);
    expect(engine.runQualityAssurance().criticalIssues).toHaveLength(0);
  });
});
