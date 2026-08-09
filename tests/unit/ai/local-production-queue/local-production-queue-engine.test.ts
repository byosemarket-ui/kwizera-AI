import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiLocalProductionQueueEngine } from "../../../../ai/local-production-queue/index.js";

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

describe("AiLocalProductionQueueEngine (Platform Step 3)", () => {
  it("queues dependent jobs in order, pauses/resumes, recovers failures, keeps history", () => {
    const root = path.join(os.tmpdir(), `kwizera-lpq-${Date.now()}`);
    roots.push(root);
    const engine = new AiLocalProductionQueueEngine();
    engine.initialize(root);
    engine.setResourceOverride({
      cpuUsage: 25,
      gpuUsage: 15,
      ramUsage: 25,
      vramUsage: 10,
      diskUsage: 20,
    });

    const chain = engine.enqueueCreativeChain("proj-unit", "high");
    expect(chain).toHaveLength(6);

    engine.start(chain[1]!.jobId);
    expect(engine.getJob(chain[1]!.jobId)?.status).toBe("waiting");

    engine.runQueueCycle();
    for (const job of chain) {
      expect(engine.getJob(job.jobId)?.status).toBe("completed");
    }
    const order = engine.getExecutionOrder().filter((id) => chain.some((c) => c.jobId === id));
    expect(order).toEqual(chain.map((c) => c.jobId));

    const pauseTarget = engine.enqueue({
      jobType: "audio-generation",
      title: "Pause Unit",
      estimatedDurationMs: 80_000,
      parallelSafe: true,
    });
    engine.start(pauseTarget.jobId);
    expect(engine.pause(pauseTarget.jobId)?.status).toBe("paused");
    const resumed = engine.resume(pauseTarget.jobId);
    expect(["running", "completed"]).toContain(resumed?.status);

    const failTarget = engine.enqueue({
      jobType: "rendering",
      title: "Fail Unit",
      parallelSafe: true,
    });
    engine.start(failTarget.jobId);
    engine.failJob(failTarget.jobId, "disk full");
    expect(engine.getJob(failTarget.jobId)?.suggestedCause).toBeTruthy();
    expect(engine.retry(failTarget.jobId)?.retryCount).toBeGreaterThanOrEqual(1);

    expect(engine.getHistory().length).toBeGreaterThan(0);
    expect(engine.getAiMeAwareness().localResourceManagerDeferred).toBe(false);
    expect(engine.runQualityAssurance().criticalIssues).toHaveLength(0);
  });
});
