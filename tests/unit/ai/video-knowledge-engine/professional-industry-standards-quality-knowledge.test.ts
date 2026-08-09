import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  INDUSTRY_STANDARDS_DOMAIN_ID,
  ISQ_DOMAIN_BRIDGES,
  PROFESSIONAL_BEST_PRACTICES_TOPICS,
  PROFESSIONAL_CHECKLIST_TOPICS,
  PROFESSIONAL_QUALITY_EVALUATION_TOPICS,
  PROFESSIONAL_QUALITY_RULES_TOPICS,
  PROFESSIONAL_STANDARDS_TOPICS,
  ProfessionalIndustryStandardsQualityKnowledge,
  REQUIRED_BEST_PRACTICES_TOPIC_IDS,
  REQUIRED_PROFESSIONAL_CHECKLIST_TOPIC_IDS,
  REQUIRED_PROFESSIONAL_STANDARDS_TOPIC_IDS,
  REQUIRED_QUALITY_EVALUATION_TOPIC_IDS,
  REQUIRED_QUALITY_RULES_TOPIC_IDS,
  checkIsqCatalogRelationships,
  createAiCore,
  getAllIsqTopics,
} from "@ai";

describe("Industry Standards & Professional Quality Knowledge (Expansion Step 9)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-isq-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("catalog covers all required professional standards and quality topics", () => {
    expect(REQUIRED_PROFESSIONAL_STANDARDS_TOPIC_IDS.length).toBe(9);
    expect(REQUIRED_QUALITY_RULES_TOPIC_IDS.length).toBe(9);
    expect(REQUIRED_BEST_PRACTICES_TOPIC_IDS.length).toBe(8);
    expect(REQUIRED_QUALITY_EVALUATION_TOPIC_IDS.length).toBe(8);
    expect(REQUIRED_PROFESSIONAL_CHECKLIST_TOPIC_IDS.length).toBe(6);
    expect(PROFESSIONAL_STANDARDS_TOPICS.length).toBe(9);
    expect(PROFESSIONAL_QUALITY_RULES_TOPICS.length).toBe(9);
    expect(PROFESSIONAL_BEST_PRACTICES_TOPICS.length).toBe(8);
    expect(PROFESSIONAL_QUALITY_EVALUATION_TOPICS.length).toBe(8);
    expect(PROFESSIONAL_CHECKLIST_TOPICS.length).toBe(6);
    expect(getAllIsqTopics().length).toBe(40);

    const knowledgeIds = getAllIsqTopics().map((topic) => topic.knowledgeId);
    const semanticTitles = getAllIsqTopics().map((topic) => topic.name.trim().toLowerCase());
    expect(new Set(knowledgeIds).size).toBe(knowledgeIds.length);
    expect(new Set(semanticTitles).size).toBe(semanticTitles.length);
    expect(checkIsqCatalogRelationships()).toEqual({ topicCount: 40, broken: [] });
  });

  it("persists the complete catalog and quality relationships in isolation", async () => {
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

    const standards = new ProfessionalIndustryStandardsQualityKnowledge();
    standards.initialize(foundation as never, storageRoot);
    await standards.runStartup();

    const install = standards.getLastInstall();
    expect(install?.installed).toBe(true);
    expect(install?.relationshipsCreated).toBeGreaterThan(50);
    expect(records.size).toBe(getAllIsqTopics().length + ISQ_DOMAIN_BRIDGES.length);
    expect(graphNodes.size).toBe(records.size);
    expect(graphEdges.size).toBe(install?.relationshipsCreated);
    expect((await standards.runHealthCheck()).healthy).toBe(true);
    expect(domains.get(INDUSTRY_STANDARDS_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "industry-standards", "pack.json"))).toBe(true);
  });

  // Full Foundation startup re-runs Steps 1–9 expansions and can exceed one hour on typical hardware.
  it(
    "installs industry standards with AI Me quality capabilities",
    async () => {
      const core = createAiCore({ storageRootOverride: storageRoot });
      await core.start("isq-expansion");
      const foundation = core.getManager().knowledgeFoundation!;
      const standards = foundation.getProfessionalIndustryStandardsQualityKnowledge();

      const install = standards.getLastInstall();
      expect(install?.installed).toBe(true);
      expect(install?.relationshipsCreated).toBeGreaterThan(50);
      expect((await standards.runHealthCheck()).healthy).toBe(true);
      expect(standards.evaluateProfessionalQuality("video lighting quality").available).toBe(true);
      expect(standards.recommendImprovement("improve editing quality").available).toBe(true);
      expect(standards.detectQualityProblems("audio noise quality").available).toBe(true);
      expect(standards.explainIndustryStandard("delivery standards").available).toBe(true);
      expect(standards.recommendBestPractices("production best practices").available).toBe(true);
      expect(standards.answer("What is a final approval checklist?").available).toBe(true);

      const awareness = standards.getAiMeAwareness();
      expect(awareness.canEvaluateProfessionalQuality).toBe(true);
      expect(awareness.canRecommendImprovements).toBe(true);
      expect(awareness.canDetectQualityProblems).toBe(true);
      expect(awareness.canExplainIndustryStandards).toBe(true);
      expect(awareness.canRecommendBestPractices).toBe(true);
      expect(awareness.industryStandardsDomainReady).toBe(true);
      expect(foundation.getKnowledgeDomainPlanner().getDomain(INDUSTRY_STANDARDS_DOMAIN_ID)?.metadata.contentReady).toBe(
        true
      );
      expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "industry-standards", "pack.json"))).toBe(true);

      await core.stop();
    },
    5_400_000
  );
});
