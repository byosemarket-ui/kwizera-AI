import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  COMPOSITION_DOMAIN_ID,
  createAiCore,
  LIGHTING_DOMAIN_ID,
  PROFESSIONAL_COMPOSITION_TOPICS,
  PROFESSIONAL_LIGHTING_TOPICS,
  REQUIRED_COMPOSITION_TOPIC_IDS,
  REQUIRED_LIGHTING_TOPIC_IDS,
} from "@ai";

describe("Professional Lighting & Composition Knowledge (Expansion Step 3)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-lighting-composition-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("installs lighting and composition topics with AI Me capabilities", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("lighting-composition-expansion");
    const foundation = core.getManager().knowledgeFoundation!;
    const lc = foundation.getProfessionalLightingCompositionKnowledge();

    expect(REQUIRED_LIGHTING_TOPIC_IDS.length).toBe(20);
    expect(REQUIRED_COMPOSITION_TOPIC_IDS.length).toBe(16);
    expect(PROFESSIONAL_LIGHTING_TOPICS.length).toBe(20);
    expect(PROFESSIONAL_COMPOSITION_TOPICS.length).toBe(16);

    const install = lc.getLastInstall();
    expect(install?.installed).toBe(true);

    for (const topic of [...PROFESSIONAL_LIGHTING_TOPICS, ...PROFESSIONAL_COMPOSITION_TOPICS]) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "test");
      expect(read.success).toBe(true);
      expect(topic.whenToUse.length).toBeGreaterThan(0);
      expect(topic.relatedCameraTechniques.length).toBeGreaterThan(0);
    }

    const health = await lc.runHealthCheck();
    expect(health.healthy).toBe(true);
    expect(health.missingConcepts).toEqual([]);
    expect(health.duplicateKnowledge).toEqual([]);
    expect(health.brokenRelationships).toEqual([]);

    const lighting = lc.recommendLighting("soft beauty product ecommerce");
    expect(lighting.available).toBe(true);
    expect(lighting.reason.length).toBeGreaterThan(0);

    const composition = lc.recommendComposition("leave space for headline text");
    expect(composition.available).toBe(true);

    const comparedLighting = lc.compareLighting("soft lighting", "hard lighting");
    expect(comparedLighting.confidenceScore).toBeGreaterThan(0);
    expect(comparedLighting.topicA).not.toBe(comparedLighting.topicB);

    const comparedComposition = lc.compareComposition("rule of thirds", "symmetry");
    expect(comparedComposition.confidenceScore).toBeGreaterThan(0);

    const answered = lc.answer("When should I use three-point lighting?");
    expect(answered.available).toBe(true);

    const awareness = lc.getAiMeAwareness();
    expect(awareness.canRecommendLighting).toBe(true);
    expect(awareness.canRecommendComposition).toBe(true);
    expect(awareness.canCompareLighting).toBe(true);
    expect(awareness.lightingDomainReady).toBe(true);
    expect(awareness.compositionDomainReady).toBe(true);

    expect(foundation.getKnowledgeDomainPlanner().getDomain(LIGHTING_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(foundation.getKnowledgeDomainPlanner().getDomain(COMPOSITION_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(foundation.getKnowledgeDomainPlanner().getDomain("storytelling-knowledge")?.metadata.contentReady).not.toBe(
      true
    );

    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "lighting", "pack.json"))).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "composition", "pack.json"))).toBe(true);

    await core.stop();
  }, 360_000);
});
