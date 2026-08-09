import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  FACEBOOK_DOMAIN_ID,
  INSTAGRAM_DOMAIN_ID,
  PROFESSIONAL_FACEBOOK_TOPICS,
  PROFESSIONAL_INSTAGRAM_TOPICS,
  ProfessionalSocialMediaKnowledge,
  PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS,
  PROFESSIONAL_TIKTOK_TOPICS,
  PROFESSIONAL_YOUTUBE_TOPICS,
  REQUIRED_FACEBOOK_TOPIC_IDS,
  REQUIRED_INSTAGRAM_TOPIC_IDS,
  REQUIRED_SOCIAL_FUNDAMENTALS_TOPIC_IDS,
  REQUIRED_TIKTOK_TOPIC_IDS,
  REQUIRED_YOUTUBE_TOPIC_IDS,
  SOCIAL_MEDIA_DOMAIN_ID,
  SM_DOMAIN_BRIDGES,
  TIKTOK_DOMAIN_ID,
  YOUTUBE_DOMAIN_ID,
  checkSmCatalogRelationships,
  getAllSmTopics,
} from "@ai";

describe("Professional Social Media Knowledge (Expansion Step 8)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-sm-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("catalog covers required social media and platform topics", () => {
    expect(REQUIRED_SOCIAL_FUNDAMENTALS_TOPIC_IDS.length).toBe(8);
    expect(REQUIRED_TIKTOK_TOPIC_IDS.length).toBe(8);
    expect(REQUIRED_INSTAGRAM_TOPIC_IDS.length).toBe(7);
    expect(REQUIRED_FACEBOOK_TOPIC_IDS.length).toBe(6);
    expect(REQUIRED_YOUTUBE_TOPIC_IDS.length).toBe(7);
    expect(PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.length).toBe(8);
    expect(PROFESSIONAL_TIKTOK_TOPICS.length).toBe(8);
    expect(PROFESSIONAL_INSTAGRAM_TOPICS.length).toBe(7);
    expect(PROFESSIONAL_FACEBOOK_TOPICS.length).toBe(6);
    expect(PROFESSIONAL_YOUTUBE_TOPICS.length).toBe(7);
    expect(getAllSmTopics().length).toBe(36);

    const ids = getAllSmTopics().map((t) => t.knowledgeId);
    expect(new Set(ids).size).toBe(ids.length);
    const semanticTitles = getAllSmTopics().map((t) => t.name.trim().toLowerCase());
    expect(new Set(semanticTitles).size).toBe(semanticTitles.length);

    const rel = checkSmCatalogRelationships();
    expect(rel.broken).toEqual([]);
  });

  it("persists the complete catalog and explicit graph relationships in isolation", async () => {
    const records = new Map<string, Record<string, unknown>>();
    const domains = new Map<string, { metadata: { contentReady: boolean } }>();
    const graphNodes = new Set<string>();
    const graphEdges = new Set<string>();

    const foundation = {
      getStorageEngine: () => ({
        getRecord: async (knowledgeId: string) => {
          const record = records.get(knowledgeId);
          return record ? { success: true, record } : { success: false, record: undefined };
        },
        storeRecord: async (record: { knowledgeId: string }) => {
          records.set(record.knowledgeId, record);
          return { success: true };
        },
        updateRecord: async (knowledgeId: string, updates: Record<string, unknown>) => {
          records.set(knowledgeId, { ...(records.get(knowledgeId) ?? {}), ...updates });
          return { success: true };
        },
      }),
      getRetrievalEngine: () => ({ invalidateCache: () => undefined }),
      getGraphEngine: () => ({
        createNode: (nodeId: string) => {
          graphNodes.add(nodeId);
          return { nodeId };
        },
        createRelationship: (input: {
          sourceId: string;
          targetId: string;
          relationshipType: string;
        }) => {
          if (!graphNodes.has(input.sourceId) || !graphNodes.has(input.targetId)) return null;
          const key = `${input.sourceId}|${input.targetId}|${input.relationshipType}`;
          if (graphEdges.has(key)) return null;
          graphEdges.add(key);
          return { relationshipId: key };
        },
      }),
      getKnowledgeDomainPlanner: () => ({
        markDomainContentReady: (domainId: string, contentReady: boolean) => {
          domains.set(domainId, { metadata: { contentReady } });
        },
        getDomain: (domainId: string) => domains.get(domainId),
      }),
      getKnowledgeExtractionEngine: () => ({ reloadPacks: async () => undefined }),
    };

    const socialMedia = new ProfessionalSocialMediaKnowledge();
    socialMedia.initialize(foundation as never, storageRoot);
    await socialMedia.runStartup();

    const install = socialMedia.getLastInstall();
    expect(install?.installed).toBe(true);
    expect(install?.relationshipsCreated).toBeGreaterThan(50);
    expect(records.size).toBe(getAllSmTopics().length + SM_DOMAIN_BRIDGES.length);
    expect(graphNodes.size).toBe(records.size);
    expect(graphEdges.size).toBe(install?.relationshipsCreated);
    expect((await socialMedia.runHealthCheck()).healthy).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "social-media", "pack.json"))).toBe(true);
  });

  // Full foundation startup re-runs Steps 1–8 expansions (~60+ min on typical hardware).
  it(
    "installs social media topics with AI Me capabilities",
    async () => {
      const core = createAiCore({ storageRootOverride: storageRoot });
      await core.start("sm-expansion");
      const foundation = core.getManager().knowledgeFoundation!;
      const sm = foundation.getProfessionalSocialMediaKnowledge();

      const install = sm.getLastInstall();
      expect(install?.installed).toBe(true);

      const health = await sm.runHealthCheck();
      expect(health.healthy).toBe(true);
      expect(health.brokenRelationships).toEqual([]);
      expect(health.duplicateKnowledge).toEqual([]);

      expect(sm.recommendPlatform("best platform for short form").available).toBe(true);
      expect(sm.recommendContentFormat("reels vs shorts").available).toBe(true);
      expect(sm.recommendPostingStrategy("content calendar").available).toBe(true);
      expect(sm.recommendEngagementStrategy("community engagement").available).toBe(true);
      expect(sm.explainPlatformDecision("tiktok hashtag strategy").available).toBe(true);
      expect(sm.answer("How do I create TikTok hooks?").available).toBe(true);

      const awareness = sm.getAiMeAwareness();
      expect(awareness.canRecommendPlatform).toBe(true);
      expect(awareness.canRecommendContentFormat).toBe(true);
      expect(awareness.canRecommendPostingStrategies).toBe(true);
      expect(awareness.canRecommendEngagementStrategies).toBe(true);
      expect(awareness.socialMediaDomainReady).toBe(true);
      expect(awareness.tiktokDomainReady).toBe(true);
      expect(awareness.instagramDomainReady).toBe(true);
      expect(awareness.facebookDomainReady).toBe(true);
      expect(awareness.youtubeDomainReady).toBe(true);

      expect(foundation.getKnowledgeDomainPlanner().getDomain(SOCIAL_MEDIA_DOMAIN_ID)?.metadata.contentReady).toBe(true);
      expect(foundation.getKnowledgeDomainPlanner().getDomain(TIKTOK_DOMAIN_ID)?.metadata.contentReady).toBe(true);
      expect(foundation.getKnowledgeDomainPlanner().getDomain(INSTAGRAM_DOMAIN_ID)?.metadata.contentReady).toBe(true);
      expect(foundation.getKnowledgeDomainPlanner().getDomain(FACEBOOK_DOMAIN_ID)?.metadata.contentReady).toBe(true);
      expect(foundation.getKnowledgeDomainPlanner().getDomain(YOUTUBE_DOMAIN_ID)?.metadata.contentReady).toBe(true);

      expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "social-media", "pack.json"))).toBe(true);

      await core.stop();
    },
    3_600_000
  );
});
