import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiFeedbackIntelligenceEngine } from "../../../../ai/feedback-intelligence/index.js";

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

describe("AiFeedbackIntelligenceEngine (Learning Step 4)", () => {
  it("analyzes feedback, learns preferences, preserves history, and never overwrites Professional Knowledge", () => {
    const root = path.join(os.tmpdir(), `kwizera-feedback-${Date.now()}`);
    roots.push(root);
    const engine = new AiFeedbackIntelligenceEngine();
    engine.initialize(root);

    const result = engine.ingestAndLearn(
      [
        {
          projectId: "p1",
          text: "Lighting is harsh and camera movement is shaky — please improve soft lighting.",
          source: "user-comment",
          rating: 2,
          accepted: true,
        },
        {
          projectId: "p1",
          text: "Love the music and CTA style.",
          source: "user-rating",
          rating: 5,
          accepted: true,
        },
      ],
      { userId: "u1" },
    );

    expect(result.analyzed).toHaveLength(2);
    expect(result.analyzed[0]!.topics).toEqual(expect.arrayContaining(["lighting", "camera-movement"]));
    expect(result.learningEntries.length).toBeGreaterThanOrEqual(1);
    expect(result.professionalKnowledgeOverwritten).toBe(false);
    expect(result.performanceAnalyticsDeferred).toBe(false);
    expect(result.preferenceProfile.preferredLightingStyle).toBeTruthy();
    expect(result.projectHistory.some((entry) => entry.projectId === "p1")).toBe(true);

    const explained = engine.explain(result.analyzed[0]!.id, "u1");
    expect(explained.whatWasLearned.length).toBeGreaterThan(10);
    expect(engine.getAiMeAwareness().canExplainWhatWasLearned).toBe(true);

    const before = engine.getAllFeedback().length;
    engine.ingestAndLearn([
      { projectId: "p1", text: "Narration pacing is too fast.", source: "video-revision", rating: 3 },
    ]);
    expect(engine.getAllFeedback().length).toBe(before + 1);

    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });
});
