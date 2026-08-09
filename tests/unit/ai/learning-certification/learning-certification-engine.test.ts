import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiLearningCertificationEngine } from "../../../../ai/learning-certification/index.js";

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

describe("AiLearningCertificationEngine (Learning Step 10)", () => {
  it("certifies Learning & Continuous Improvement Version 1.0 when all gates pass", () => {
    const root = path.join(os.tmpdir(), `kwizera-learncert-${Date.now()}`);
    roots.push(root);
    const engine = new AiLearningCertificationEngine();
    engine.initialize(root);

    const result = engine.runCertification();
    expect(result.subsystems).toHaveLength(12);
    expect(result.scenarios).toHaveLength(5);
    expect(result.certified).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.validationBypassed).toBe(false);
    expect(result.offlineFirst).toBe(true);
    expect(result.health.overallIntelligenceScore).toBeGreaterThanOrEqual(90);
    expect(result.certificationStatement).toContain("certified for production use");

    const injected = engine.runCertification({ injectSubsystemFailure: "download-manager" });
    expect(injected.issuesRepaired.length).toBeGreaterThanOrEqual(1);

    const final = engine.runCertification();
    expect(final.certified).toBe(true);
    expect(engine.getAiMeAwareness(final).learningContinuousImprovementV1Complete).toBe(true);

    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });
});
