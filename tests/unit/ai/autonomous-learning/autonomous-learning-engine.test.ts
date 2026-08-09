import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiAutonomousLearningEngine } from "../../../../ai/autonomous-learning/index.js";

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

describe("AiAutonomousLearningEngine (Learning Step 6)", () => {
  it("learns online verified knowledge, rejects unverified/unrelated, and works offline", () => {
    const root = path.join(os.tmpdir(), `kwizera-autolearn-${Date.now()}`);
    roots.push(root);
    const engine = new AiAutonomousLearningEngine();
    engine.initialize(root);

    const online = engine.runAutonomousCycle({
      isOnline: () => true,
      candidates: [
        {
          title: "Soft Key Update",
          content: "Best practice for lighting quality",
          domainId: "lighting",
          origin: "professional-technique",
          sourceLabel: "manual",
          verified: true,
        },
        {
          title: "Bad Rumor",
          content: "unverified",
          domainId: "camera",
          origin: "ai-technology",
          sourceLabel: "rumor",
          verified: false,
        },
        {
          title: "Sports Betting",
          content: "cryptocurrency sports betting",
          domainId: "finance",
          origin: "online-trusted-source",
          sourceLabel: "bad",
          verified: true,
        },
      ],
    });

    expect(online.packsExpanded.length).toBeGreaterThanOrEqual(1);
    expect(online.rejectedUnverified).toContain("Bad Rumor");
    expect(online.rejectedUnrelated.length).toBeGreaterThanOrEqual(1);
    expect(online.previousKnowledgePreserved).toBe(true);
    expect(online.composition.defaultSignalsUsed).toBeGreaterThanOrEqual(1);
    expect(online.workflowModelOptimizationDeferred).toBe(false);
    expect(online.impactAnalyses.every((i) => i.breakingChangeRisk === false)).toBe(true);

    const offline = engine.runAutonomousCycle({ isOnline: () => false });
    expect(offline.onlineAvailable).toBe(false);
    expect(offline.offlineCompatible).toBe(true);
    expect(offline.selfLearningApplied.length).toBeGreaterThan(0);

    const explained = engine.explain(online.discovered.find((d) => d.accepted)?.id);
    expect(explained.whatWasLearned.length).toBeGreaterThan(10);
    expect(engine.getAiMeAwareness().canExplainNewlyLearned).toBe(true);

    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });

  it("composes self-signals from feedback and performance when wired", () => {
    const root = path.join(os.tmpdir(), `kwizera-autolearn-compose-${Date.now()}`);
    roots.push(root);

    const feedbackPort = {
      getLearningMemory: () => [
        { topics: ["camera-movement"], lesson: "Prefer slow dolly reveals." },
      ],
      getPreferenceProfile: () => ({ evolutionNotes: ["prefer soft lighting"] }),
    };
    const performancePort = {
      getSessions: () => [
        {
          bottlenecks: [
            { kind: "rendering-bottleneck", module: "rendering", detail: "slow render", severity: "high" },
          ],
          optimizations: [{ recommendation: "Use hardware encode." }],
        },
      ],
    };

    const engine = new AiAutonomousLearningEngine();
    engine.initialize(root, { feedback: feedbackPort, performance: performancePort });
    const cycle = engine.runAutonomousCycle({ isOnline: () => false, maxImports: 4 });
    expect(cycle.composition.depsWired.feedback).toBe(true);
    expect(cycle.composition.depsWired.performance).toBe(true);
    expect(cycle.composition.feedbackSignalsUsed + cycle.composition.performanceSignalsUsed).toBeGreaterThan(0);
    expect(cycle.offlineCompatible).toBe(true);
  });
});
