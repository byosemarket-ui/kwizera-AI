import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  PROFESSIONAL_SCENE_DESIGN_TOPICS,
  PROFESSIONAL_STORYTELLING_TOPICS,
  REQUIRED_SCENE_DESIGN_TOPIC_IDS,
  REQUIRED_STORYTELLING_TOPIC_IDS,
  SCENE_DOMAIN_ID,
  STORYTELLING_DOMAIN_ID,
} from "@ai";

describe("Professional Storytelling & Scene Design Knowledge (Expansion Step 4)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-storytelling-scene-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("installs storytelling and scene topics with AI Me capabilities", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("storytelling-scene-expansion");
    const foundation = core.getManager().knowledgeFoundation!;
    const ss = foundation.getProfessionalStorytellingSceneKnowledge();

    expect(REQUIRED_STORYTELLING_TOPIC_IDS.length).toBe(16);
    expect(REQUIRED_SCENE_DESIGN_TOPIC_IDS.length).toBe(17);
    expect(PROFESSIONAL_STORYTELLING_TOPICS.length).toBe(16);
    expect(PROFESSIONAL_SCENE_DESIGN_TOPICS.length).toBe(17);

    const install = ss.getLastInstall();
    expect(install?.installed).toBe(true);

    for (const topic of [...PROFESSIONAL_STORYTELLING_TOPICS, ...PROFESSIONAL_SCENE_DESIGN_TOPICS]) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "test");
      expect(read.success).toBe(true);
      expect(topic.professionalDefinition.length).toBeGreaterThan(0);
      expect(topic.workflow.length).toBeGreaterThan(0);
    }

    const health = await ss.runHealthCheck();
    expect(health.healthy).toBe(true);
    expect(health.missingConcepts).toEqual([]);
    expect(health.duplicateKnowledge).toEqual([]);
    expect(health.brokenSceneRelationships).toEqual([]);

    const structure = ss.buildStoryStructure("product launch ecommerce video");
    expect(structure.available).toBe(true);
    expect(structure.acts.length).toBe(3);

    const sequence = ss.recommendSceneSequence("product demo how it works");
    expect(sequence.available).toBe(true);
    expect(sequence.scenes.length).toBeGreaterThan(2);

    const emotion = ss.recommendEmotionalFlow("premium luxury brand film");
    expect(emotion.available).toBe(true);
    expect(emotion.stages.length).toBeGreaterThan(2);

    const layout = ss.recommendSceneLayout("hero product scene layout");
    expect(layout.available).toBe(true);

    const answered = ss.answer("How do I build a three-act story structure?");
    expect(answered.available).toBe(true);

    const awareness = ss.getAiMeAwareness();
    expect(awareness.canBuildStoryStructures).toBe(true);
    expect(awareness.canRecommendSceneSequences).toBe(true);
    expect(awareness.canRecommendEmotionalFlow).toBe(true);
    expect(awareness.storytellingDomainReady).toBe(true);
    expect(awareness.sceneDomainReady).toBe(true);

    expect(foundation.getKnowledgeDomainPlanner().getDomain(STORYTELLING_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(foundation.getKnowledgeDomainPlanner().getDomain(SCENE_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(foundation.getKnowledgeDomainPlanner().getDomain("animation-knowledge")?.metadata.contentReady).not.toBe(true);

    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "storytelling", "pack.json"))).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "scene", "pack.json"))).toBe(true);

    await core.stop();
  }, 900_000);
});
