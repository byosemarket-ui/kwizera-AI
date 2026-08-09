import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiAutonomousImprovementEngine } from "../../../../ai/autonomous-improvement/index.js";

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

describe("AiAutonomousImprovementEngine (Learning Step 8)", () => {
  it("applies safe improvements with rollback, blocks unsafe ones, never touches user projects", () => {
    const root = path.join(os.tmpdir(), `kwizera-autoimp-${Date.now()}`);
    roots.push(root);
    const engine = new AiAutonomousImprovementEngine();
    engine.initialize(root);

    const result = engine.runImprovementCycle({
      maxApply: 3,
      signals: [
        {
          source: "workflow-optimization",
          label: "Refine workflow",
          score: 80,
          moduleHint: "workflow",
          strategyHint: "workflow-refinement",
        },
        {
          source: "user-feedback",
          label: "Unsafe API break experiment",
          score: 99,
          detail: "break api",
          moduleHint: "planning",
        },
      ],
    });

    expect(result.applied.length).toBeGreaterThanOrEqual(1);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(result.userProjectsModified).toBe(false);
    expect(result.userDataDeleted).toBe(false);
    expect(result.autonomousIntelligenceCertificationDeferred).toBe(false);
    expect(result.rollbacksAvailable.length).toBe(result.applied.length);

    const id = result.applied[0]!.id;
    const rb = engine.rollback(id);
    expect(rb.success).toBe(true);

    const explained = engine.explain();
    expect(engine.getAiMeAwareness().canExplainEveryImprovement).toBe(true);
    expect(explained.recommendManual.length).toBeGreaterThan(0);

    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });
});
