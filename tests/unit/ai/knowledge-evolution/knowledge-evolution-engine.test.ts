import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiKnowledgeEvolutionEngine } from "../../../../ai/knowledge-evolution/index.js";

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

describe("AiKnowledgeEvolutionEngine (Learning Step 3)", () => {
  it("detects updates, preserves versions, deprecates safely, and explains changes", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-evolution-"));
    roots.push(root);
    const engine = new AiKnowledgeEvolutionEngine();
    engine.initialize(root);
    await engine.runStartup();

    const created = await engine.evolve([
      {
        title: "Camera Dolly Reveal",
        content: "Technique: Use a slow dolly-in for product reveals.\nBest practice: Keep product framing stable.",
        domainId: "camera-movement",
        verified: true,
        changeKindHint: "new-technique",
      },
    ]);
    expect(created.newKnowledgeAdded).toHaveLength(1);
    expect(created.previousVersionsPreserved).toBe(true);
    expect(created.feedbackIntelligenceDeferred).toBe(false);

    const evolved = await engine.evolve([
      {
        title: "Camera Dolly Reveal",
        content: "Technique: Use a slow dolly-in for product reveals.\nBest practice: Keep product framing stable.\nRecommendation: Prefer slider moves for tabletop kits.",
        domainId: "camera-movement",
        verified: true,
        changeKindHint: "updated-best-practice",
      },
    ]);
    expect(evolved.comparisons.some((item) => item.classification === "updated")).toBe(true);
    expect(evolved.updatedPacks[0].version).toBe(2);

    await engine.evolve([
      {
        title: "Legacy Crash Zoom",
        content: "Old workflow for product intros.",
        domainId: "camera-movement",
        verified: true,
      },
    ]);
    const replaceLegacy = await engine.evolve([
      {
        title: "Controlled Push-In",
        content: "Updated workflow replacing crash zooms for product marketing.",
        domainId: "camera-movement",
        verified: true,
        deprecatesTitle: "Legacy Crash Zoom",
      },
    ]);
    expect(replaceLegacy.deprecatedKnowledge.some((item) => item.title === "Legacy Crash Zoom")).toBe(true);
    expect(replaceLegacy.newKnowledgeAdded.some((item) => item.title === "Controlled Push-In")).toBe(true);

    const itemId = evolved.updatedPacks[0].itemId;
    const explained = engine.explainEvolution(itemId);
    expect(explained.whatChanged.length).toBeGreaterThan(10);
    expect(engine.compareVersions(itemId).recommendLatest).toBe(true);
    expect(engine.getAiMeKnowledgeEvolutionAwareness().canExplainWhatChanged).toBe(true);

    const blocked = await engine.evolve([{ title: "Rumor", content: "unverified", verified: false }]);
    expect(blocked.issuesFound.some((item) => /unverified/i.test(item))).toBe(true);
  });
});
