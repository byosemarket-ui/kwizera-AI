import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiAutonomousIntelligenceValidationEngine } from "../../../../ai/autonomous-intelligence-validation/index.js";

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

describe("AiAutonomousIntelligenceValidationEngine (Learning Step 9)", () => {
  it("validates capabilities, safety, scenarios, scores readiness, and repairs failures", () => {
    const root = path.join(os.tmpdir(), `kwizera-aiv-${Date.now()}`);
    roots.push(root);
    const engine = new AiAutonomousIntelligenceValidationEngine();
    engine.initialize(root);

    const clean = engine.runValidation();
    expect(clean.capabilityValidations).toHaveLength(10);
    expect(clean.scenarioSimulations).toHaveLength(4);
    expect(clean.safetyValidations.every((s) => s.passed)).toBe(true);
    expect(clean.learningValidations.every((l) => l.learnedCorrectly)).toBe(true);
    expect(clean.certifiedForProduction).toBe(true);
    expect(clean.learningCertificationDeferred).toBe(false);
    expect(clean.userDataDeleted).toBe(false);
    expect(clean.readiness.productionReadinessScore).toBeGreaterThanOrEqual(85);

    const injected = engine.runValidation({ injectCapabilityFailure: "decision-improvement" });
    expect(injected.issuesRepaired.length).toBeGreaterThanOrEqual(1);
    expect(
      injected.capabilityValidations.some((c) => c.capability === "decision-improvement" && c.status === "repaired"),
    ).toBe(true);

    const explained = engine.explain(clean.runId);
    expect(explained.longTermHealthPrediction.length).toBeGreaterThan(10);
    expect(engine.getAiMeAwareness().canExplainEveryValidationResult).toBe(true);

    engine.runValidation();
    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });
});
