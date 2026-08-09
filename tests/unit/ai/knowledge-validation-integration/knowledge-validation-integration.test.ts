import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KnowledgeValidationIntegrationEngine } from "../../../../ai/knowledge-validation-integration/index.js";

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

describe("KnowledgeValidationIntegrationEngine (Learning Step 2)", () => {
  it("validates, dedupes, versions, indexes, and never overwrites prior snapshots", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-kvi-"));
    roots.push(root);
    const engine = new KnowledgeValidationIntegrationEngine();
    engine.initialize(root);
    await engine.runStartup();

    const candidate = {
      title: "Camera Exposure Rule",
      content: "Rule: Never crush product highlights.\nBest practice: Prefer base ISO for product video.\nExample: f/5.6 product set.",
      sourceTrustScore: 88,
      authorityScore: 85,
      domainHint: "camera" as const,
    };

    const first = await engine.integrateCandidates([candidate]);
    expect(first.accepted).toHaveLength(1);
    expect(first.knowledgeFoundationOverwrite).toBe(false);
    expect(first.evolutionDeferred).toBe(true);
    expect(first.packsUpdated[0].version).toBe(1);

    const dup = await engine.integrateCandidates([candidate]);
    expect(dup.duplicatesReused).toHaveLength(1);

    const updated = await engine.integrateCandidates([
      {
        ...candidate,
        content: `${candidate.content}\nRecommendation: Raise shutter before raising ISO.`,
      },
    ]);
    expect(updated.accepted[0].version).toBe(2);
    expect(updated.versionHistoryUpdated.length).toBeGreaterThan(0);
    expect(engine.searchImportedKnowledge("exposure highlights").length).toBeGreaterThan(0);
    expect(engine.explainDecision(first.accepted[0].id).confidence).toBeGreaterThan(50);

    const junk = await engine.integrateCandidates([
      {
        title: "Spam",
        content: "Buy now limited offer click here sponsored",
        sourceTrustScore: 10,
        authorityScore: 10,
      },
    ]);
    expect(junk.rejected.length).toBe(1);
    expect(engine.getAiMeKnowledgeValidationIntegrationAwareness().knowledgeEvolutionDeferred).toBe(true);
  });
});
