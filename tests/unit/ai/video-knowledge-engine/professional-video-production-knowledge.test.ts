import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  PROFESSIONAL_VIDEO_PRODUCTION_TOPICS,
  REQUIRED_VIDEO_PRODUCTION_TOPIC_IDS,
  VIDEO_PRODUCTION_DOMAIN_ID,
} from "@ai";

describe("Professional Video Production Knowledge (Expansion Step 1)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-production-knowledge-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("installs curated topics, relationships, AI Me capabilities, and health", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("video-production-knowledge-expansion");
    const foundation = core.getManager().knowledgeFoundation!;
    const professional = foundation.getProfessionalVideoProductionKnowledge();
    const builder = foundation.getVideoProductionKnowledgeBuilder();

    expect(REQUIRED_VIDEO_PRODUCTION_TOPIC_IDS.length).toBe(19);
    expect(PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length).toBe(19);

    const install = professional.getLastInstall();
    expect(install?.installed).toBe(true);
    expect((install?.topicsInstalled ?? 0) + (install?.topicsUpdated ?? 0)).toBeGreaterThanOrEqual(19);

    for (const topic of PROFESSIONAL_VIDEO_PRODUCTION_TOPICS) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "test");
      expect(read.success).toBe(true);
      expect(read.record?.title).toBe(topic.title);
      expect(read.record?.payload?.professionalDefinition || read.record?.payload?.structuredKnowledge).toBeTruthy();
    }

    const health = await professional.runHealthCheck();
    expect(health.healthy).toBe(true);
    expect(health.missingConcepts).toEqual([]);
    expect(health.duplicateKnowledge).toEqual([]);
    expect(health.brokenRelationships).toEqual([]);

    const explained = builder.explain("video production fundamentals");
    expect(explained.available).toBe(true);
    expect(explained.bestPractices.length).toBeGreaterThan(0);

    const workflow = builder.recommendWorkflow("production workflow");
    expect(workflow.available).toBe(true);
    expect(workflow.workflow.length).toBeGreaterThan(0);

    const practices = builder.recommendBestPractices("social media videos");
    expect(practices.available).toBe(true);

    const compared = builder.compare("pre-production", "post-production");
    expect(compared.confidenceScore).toBeGreaterThan(0);
    expect(compared.differences.length).toBeGreaterThan(0);

    const answered = builder.answer("How should I plan shot coverage?");
    expect(answered.available).toBe(true);

    const awareness = professional.getAiMeAwareness();
    expect(awareness.canExplain).toBe(true);
    expect(awareness.canRecommendWorkflows).toBe(true);
    expect(awareness.canCompareMethods).toBe(true);
    expect(awareness.domainContentReady).toBe(true);
    expect(awareness.topicCount).toBe(19);

    expect(foundation.getKnowledgeDomainPlanner().getDomain(VIDEO_PRODUCTION_DOMAIN_ID)?.metadata.contentReady).toBe(
      true
    );

    const packPath = path.join(storageRoot, "knowledge", "packs", "video-production", "pack.json");
    expect(fs.existsSync(packPath)).toBe(true);

    // Camera specialty domain must remain content-not-ready for this step.
    expect(foundation.getKnowledgeDomainPlanner().getDomain("camera-knowledge")?.metadata.contentReady).not.toBe(true);

    await core.stop();
  }, 300_000);
});
