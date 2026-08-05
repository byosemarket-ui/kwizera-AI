/**
 * Professional Video Production Knowledge — Expansion Step 1 installer.
 * Installs curated topics into the Knowledge Foundation (offline-first). Does not generate videos.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRelationType } from "../knowledge-graph-engine/types.js";
import {
  KnowledgePackStore,
} from "../knowledge-processing-engine/knowledge-pack-store.js";
import type { KnowledgeItem, KnowledgePack } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import type { StructuredKnowledge } from "../knowledge-processing-engine/knowledge-processing-engine.js";
import { KnowledgeRecordStatus, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import {
  findVideoProductionTopics,
  getVideoProductionTopic,
  PROFESSIONAL_VIDEO_PRODUCTION_TOPICS,
  REQUIRED_VIDEO_PRODUCTION_TOPIC_IDS,
  VIDEO_PRODUCTION_DOMAIN_BRIDGES,
} from "./professional-video-production-catalog.js";
import {
  PROFESSIONAL_VIDEO_PRODUCTION_VERSION,
  ProfessionalVideoProductionError,
  VIDEO_PRODUCTION_DOMAIN_ID,
  VIDEO_PRODUCTION_KNOWLEDGE_SOURCE,
  type AiMeVideoProductionKnowledgeAwareness,
  type ProfessionalVideoProductionTopic,
  type VideoProductionKnowledgeCompareResult,
  type VideoProductionKnowledgeExplainResult,
  type VideoProductionKnowledgeHealthReport,
  type VideoProductionKnowledgeInstallResult,
  type VideoProductionKnowledgeRepairResult,
} from "./professional-video-production-types.js";

export class ProfessionalVideoProductionKnowledge {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private lastInstall: VideoProductionKnowledgeInstallResult | null = null;
  private lastHealth: VideoProductionKnowledgeHealthReport | null = null;
  private lastRepair: VideoProductionKnowledgeRepairResult | null = null;
  private relationshipCount = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.metaRoot = path.join(storageRoot, "knowledge", "videos", "professional-production");
    this.packStore.initialize(storageRoot);
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.metaRoot, { recursive: true });
    this.startupComplete = true;
    this.lastInstall = await this.installOrUpgrade();
    this.lastHealth = await this.runHealthCheck();
    if (!this.lastHealth.healthy) {
      this.lastRepair = await this.repair();
      this.lastHealth = await this.runHealthCheck();
    } else {
      this.lastRepair = { repaired: true, actions: ["No repair required after install."], remainingIssues: [] };
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  listTopics(): ProfessionalVideoProductionTopic[] {
    return PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.map((topic) => structuredClone(topic));
  }

  getTopic(topicId: string): ProfessionalVideoProductionTopic | null {
    const found = getVideoProductionTopic(topicId);
    return found ? structuredClone(found) : null;
  }

  getLastInstall(): VideoProductionKnowledgeInstallResult | null {
    return this.lastInstall ? structuredClone(this.lastInstall) : null;
  }

  getLastHealth(): VideoProductionKnowledgeHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async installOrUpgrade(): Promise<VideoProductionKnowledgeInstallResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const issues: string[] = [];
    let topicsInstalled = 0;
    let topicsUpdated = 0;
    let bridgesInstalled = 0;
    let relationshipsCreated = 0;

    // 1) Persist topic records
    for (const topic of PROFESSIONAL_VIDEO_PRODUCTION_TOPICS) {
      const relatedKnowledge = unique([
        ...topic.relatedTopics.map((id) => `vp-${id}`),
        ...topic.relatedDomains.map((id) => `vp-bridge-${id}`),
      ]).filter((id) => id !== topic.knowledgeId);
      const structured = topicToStructured(topic);
      const payload = {
        step: "knowledge-expansion-video-production",
        expansionVersion: PROFESSIONAL_VIDEO_PRODUCTION_VERSION,
        topicId: topic.topicId,
        professionalDefinition: topic.professionalDefinition,
        knowledgeItem: topicToKnowledgeItem(topic),
        structuredKnowledge: structured,
        metadata: topic.metadata,
        generatesVideo: false,
      };
      const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, VIDEO_PRODUCTION_KNOWLEDGE_SOURCE);
      if (existing.success && existing.record) {
        const write = await foundation.getStorageEngine().updateRecord(
          topic.knowledgeId,
          {
            title: topic.title,
            description: topic.description,
            summary: topic.professionalDefinition,
            tags: unique(["video-production", "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
            keywords: topic.keywords,
            confidenceScore: topic.confidenceScore,
            qualityScore: topic.qualityScore,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge,
            payload,
          },
          VIDEO_PRODUCTION_KNOWLEDGE_SOURCE
        );
        if (write.success) topicsUpdated += 1;
        else issues.push(`Failed to update ${topic.knowledgeId}`);
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: topic.knowledgeId,
            knowledgeType: KnowledgeStorageType.Video,
            category: "professional-video-production",
            title: topic.title,
            description: topic.description,
            summary: topic.professionalDefinition,
            tags: unique(["video-production", "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
            keywords: topic.keywords,
            source: VIDEO_PRODUCTION_KNOWLEDGE_SOURCE,
            sourceReliability: 95,
            confidenceScore: topic.confidenceScore,
            qualityScore: topic.qualityScore,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge,
            payload,
          },
          VIDEO_PRODUCTION_KNOWLEDGE_SOURCE
        );
        if (write.success) topicsInstalled += 1;
        else issues.push(`Failed to install ${topic.knowledgeId}: ${write.validation?.message ?? "unknown"}`);
      }
    }

    // 2) Domain bridge anchors
    for (const bridge of VIDEO_PRODUCTION_DOMAIN_BRIDGES) {
      const existing = await foundation.getStorageEngine().getRecord(bridge.knowledgeId, VIDEO_PRODUCTION_KNOWLEDGE_SOURCE);
      const payload = {
        step: "knowledge-expansion-video-production",
        bridgeDomainId: bridge.domainId,
        relationshipAnchor: true,
        generatesVideo: false,
        professionalTechniques: [],
        bestPractices: [],
        decisionRules: [`Relate video production topics to ${bridge.domainId}.`],
        structuredKnowledge: {
          title: bridge.title,
          category: "domain-bridge",
          domain: bridge.domainId,
          description: bridge.description,
          sections: [],
          concepts: [bridge.domainId],
          entities: [bridge.domainId],
          terminology: [bridge.domainId],
          rules: [],
          bestPractices: [],
          professionalTechniques: [],
          examples: [],
          commonMistakes: [],
          qualityRules: [],
          decisionRules: [`Relate video production topics to ${bridge.domainId}.`],
          workflowSteps: [],
          prerequisites: [],
          dependencies: [],
          relatedKnowledge: ["vp-video-production-fundamentals"],
          difficultyLevel: "foundation" as const,
          confidenceScore: 85,
          sourceMetadata: [
            { name: "KWIZERA Professional Video Production Expansion", type: "curated", reliability: 95 },
          ],
        } satisfies StructuredKnowledge,
      };
      if (existing.success && existing.record) {
        await foundation.getStorageEngine().updateRecord(
          bridge.knowledgeId,
          {
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["video-production", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "video-production", "relationship"],
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["vp-video-production-fundamentals"],
            payload,
          },
          VIDEO_PRODUCTION_KNOWLEDGE_SOURCE
        );
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: bridge.knowledgeId,
            knowledgeType: KnowledgeStorageType.Video,
            category: "video-production-domain-bridge",
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["video-production", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "video-production", "relationship"],
            source: VIDEO_PRODUCTION_KNOWLEDGE_SOURCE,
            sourceReliability: 90,
            confidenceScore: 85,
            qualityScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["vp-video-production-fundamentals"],
            payload,
          },
          VIDEO_PRODUCTION_KNOWLEDGE_SOURCE
        );
        if (write.success) bridgesInstalled += 1;
        else issues.push(`Failed bridge ${bridge.knowledgeId}`);
      }
    }

    // 3) Graph evolution + explicit relationships
    for (const topic of PROFESSIONAL_VIDEO_PRODUCTION_TOPICS) {
      try {
        await foundation.getRetrievalEngine().invalidateCache(topic.knowledgeId);
        await foundation.getGraphEngine().evolveGraph(topic.knowledgeId);
      } catch (error) {
        issues.push(`Graph evolve failed for ${topic.knowledgeId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    for (const bridge of VIDEO_PRODUCTION_DOMAIN_BRIDGES) {
      try {
        await foundation.getGraphEngine().evolveGraph(bridge.knowledgeId);
      } catch {
        /* optional */
      }
    }

    const hubId = "vp-bridge-video-production-knowledge";
    for (const bridge of VIDEO_PRODUCTION_DOMAIN_BRIDGES) {
      if (bridge.knowledgeId === hubId) continue;
      try {
        const edge = foundation.getGraphEngine().createRelationship({
          sourceId: hubId,
          targetId: bridge.knowledgeId,
          relationshipType: KnowledgeRelationType.RelatedTo,
          evidence: bridge.relationshipEvidence,
          strengthScore: 88,
          confidenceScore: 90,
        });
        if (edge) relationshipsCreated += 1;
      } catch (error) {
        issues.push(`Relationship ${hubId}→${bridge.knowledgeId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const topic of PROFESSIONAL_VIDEO_PRODUCTION_TOPICS) {
      for (const related of topic.relatedTopics) {
        const targetId = `vp-${related}`;
        try {
          const edge = foundation.getGraphEngine().createRelationship({
            sourceId: topic.knowledgeId,
            targetId,
            relationshipType: KnowledgeRelationType.RelatedTo,
            evidence: `${topic.title} relates to ${related} within professional video production.`,
            strengthScore: 82,
            confidenceScore: 88,
          });
          if (edge) relationshipsCreated += 1;
        } catch {
          /* duplicate or node race — evolveGraph already linked many */
        }
      }
      for (const domainId of topic.relatedDomains) {
        const targetId = `vp-bridge-${domainId}`;
        try {
          const edge = foundation.getGraphEngine().createRelationship({
            sourceId: topic.knowledgeId,
            targetId,
            relationshipType: KnowledgeRelationType.DependsOn,
            evidence: `${topic.title} depends on related domain ${domainId}.`,
            strengthScore: 80,
            confidenceScore: 86,
          });
          if (edge) relationshipsCreated += 1;
        } catch {
          /* optional */
        }
      }
    }

    this.relationshipCount = relationshipsCreated;

    // 4) Sync pack (merge, never duplicate items by knowledgeId)
    let packSynced = false;
    try {
      packSynced = await this.syncVideoProductionPack();
    } catch (error) {
      issues.push(`Pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 5) Mark domain content ready
    let domainMarkedReady = false;
    try {
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(VIDEO_PRODUCTION_DOMAIN_ID, true);
      domainMarkedReady = true;
    } catch (error) {
      issues.push(`Domain mark ready failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const result: VideoProductionKnowledgeInstallResult = {
      installed: topicsInstalled + topicsUpdated >= PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length && issues.filter((i) => i.startsWith("Failed")).length === 0,
      topicsInstalled,
      topicsUpdated,
      bridgesInstalled,
      relationshipsCreated,
      packSynced,
      domainMarkedReady,
      issues,
    };
    this.lastInstall = result;
    await this.persistMeta(result);
    return structuredClone(result);
  }

  explain(topicQuery: string): VideoProductionKnowledgeExplainResult {
    this.ensureStarted();
    const matches = findVideoProductionTopics(topicQuery);
    const topic = matches[0] ?? getVideoProductionTopic(topicQuery);
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: topicQuery,
        explanation: `No professional video production topic matches "${topicQuery}".`,
        professionalDefinition: "",
        bestPractices: [],
        workflow: [],
        decisionRules: [],
        relatedTopics: [],
        confidenceScore: 0,
        qualityScore: 0,
      };
    }
    return {
      available: true,
      knowledgeId: topic.knowledgeId,
      title: topic.title,
      explanation: `${topic.professionalDefinition} ${topic.description}`,
      professionalDefinition: topic.professionalDefinition,
      bestPractices: topic.bestPractices,
      workflow: topic.professionalWorkflow,
      decisionRules: topic.decisionRules,
      relatedTopics: topic.relatedTopics,
      confidenceScore: topic.confidenceScore,
      qualityScore: topic.qualityScore,
    };
  }

  recommendWorkflow(topicQuery = "production workflow"): { available: boolean; workflow: string[]; reason: string; confidenceScore: number } {
    const explained = this.explain(topicQuery.includes("workflow") ? topicQuery : "production workflow");
    const topic = findVideoProductionTopics(topicQuery)[0] ?? getVideoProductionTopic("production-workflow")!;
    return {
      available: Boolean(topic),
      workflow: topic.professionalWorkflow,
      reason: `Recommended workflow from ${topic.title}.`,
      confidenceScore: topic.confidenceScore,
    };
  }

  recommendBestPractices(topicQuery: string): { available: boolean; practices: string[]; reason: string; confidenceScore: number } {
    const topic = findVideoProductionTopics(topicQuery)[0];
    if (!topic) return { available: false, practices: [], reason: `No topic match for "${topicQuery}".`, confidenceScore: 0 };
    return {
      available: true,
      practices: topic.bestPractices,
      reason: `Best practices from ${topic.title}.`,
      confidenceScore: topic.confidenceScore,
    };
  }

  compare(topicAQuery: string, topicBQuery: string): VideoProductionKnowledgeCompareResult {
    this.ensureStarted();
    const a = findVideoProductionTopics(topicAQuery)[0];
    const b = findVideoProductionTopics(topicBQuery)[0];
    if (!a || !b) {
      return {
        topicA: topicAQuery,
        topicB: topicBQuery,
        similarities: [],
        differences: [],
        recommendation: "Both topics must resolve to known professional video production topics.",
        confidenceScore: 0,
      };
    }
    const sharedKeywords = a.keywords.filter((keyword) => b.keywords.includes(keyword));
    const sharedDomains = a.relatedDomains.filter((domain) => b.relatedDomains.includes(domain));
    return {
      topicA: a.title,
      topicB: b.title,
      similarities: [
        ...sharedKeywords.map((keyword) => `Shared keyword: ${keyword}`),
        ...sharedDomains.map((domain) => `Shared related domain: ${domain}`),
        a.professionalWorkflow[0] && b.professionalWorkflow[0]
          ? "Both define explicit professional workflows."
          : "Both are curated professional production topics.",
      ].filter(Boolean),
      differences: [
        `Definition focus — ${a.title}: ${a.professionalDefinition.slice(0, 120)}…`,
        `Definition focus — ${b.title}: ${b.professionalDefinition.slice(0, 120)}…`,
        `Primary mistakes differ: ${a.commonMistakes[0]} vs ${b.commonMistakes[0]}`,
      ],
      recommendation: `Use ${a.title} when the problem centers on ${a.keywords.slice(0, 3).join(", ")}; use ${b.title} when it centers on ${b.keywords.slice(0, 3).join(", ")}.`,
      confidenceScore: Math.round((a.confidenceScore + b.confidenceScore) / 2),
    };
  }

  answer(question: string): { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } {
    this.ensureStarted();
    let matches = findVideoProductionTopics(question).slice(0, 3);
    if (!matches.length) {
      const topic = getVideoProductionTopic(question.replace(/^vp-/, ""));
      if (topic) matches = [topic];
    }
    if (!matches.length) {
      return {
        available: false,
        answer: `No validated professional video production knowledge answers "${question}".`,
        knowledgeIds: [],
        confidenceScore: 0,
      };
    }
    const primary = matches[0];
    const answer = [
      primary.professionalDefinition,
      `Best practice: ${primary.bestPractices[0]}`,
      `Decision rule: ${primary.decisionRules[0]}`,
      `Workflow step: ${primary.professionalWorkflow[0]}`,
      matches.length > 1 ? `Also related: ${matches.slice(1).map((item) => item.title).join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      available: true,
      answer,
      knowledgeIds: matches.map((item) => item.knowledgeId),
      confidenceScore: Math.round(matches.reduce((sum, item) => sum + item.confidenceScore, 0) / matches.length),
    };
  }

  getAiMeAwareness(): AiMeVideoProductionKnowledgeAwareness {
    this.ensureStarted();
    const avgConfidence = average(PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.map((topic) => topic.confidenceScore));
    const avgQuality = average(PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.map((topic) => topic.qualityScore));
    let domainContentReady = false;
    try {
      domainContentReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(VIDEO_PRODUCTION_DOMAIN_ID)?.metadata.contentReady === true;
    } catch {
      domainContentReady = false;
    }
    return {
      canExplain: true,
      canRecommendWorkflows: true,
      canRecommendBestPractices: true,
      canCompareMethods: true,
      canAnswerProfessionalQuestions: true,
      topicCount: PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length,
      relationshipCount: this.relationshipCount || this.countGraphRelationships(),
      averageConfidence: avgConfidence,
      averageQuality: avgQuality,
      domainContentReady,
      summary:
        `Professional Video Production Knowledge Expansion Step 1 is active with ${PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length} topics. ` +
        `AI Me can explain, recommend workflows/best practices, compare methods, and answer professional questions. ` +
        `Camera Knowledge specialty content is not started.`,
    };
  }

  async runHealthCheck(): Promise<VideoProductionKnowledgeHealthReport> {
    this.ensureStarted();
    const missingConcepts: string[] = [];
    const duplicateKnowledge: string[] = [];
    const brokenRelationships: string[] = [];
    const issues: string[] = [];
    const foundation = this.foundation!;

    for (const topicId of REQUIRED_VIDEO_PRODUCTION_TOPIC_IDS) {
      const topic = getVideoProductionTopic(topicId);
      if (!topic) {
        missingConcepts.push(topicId);
        continue;
      }
      for (const field of ["professionalDefinition", "description", "title"] as const) {
        if (!topic[field]?.trim()) missingConcepts.push(`${topicId}:${field}`);
      }
      for (const list of ["bestPractices", "commonMistakes", "professionalWorkflow", "examples", "decisionRules", "keywords"] as const) {
        if (!topic[list].length) missingConcepts.push(`${topicId}:${list}`);
      }
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, VIDEO_PRODUCTION_KNOWLEDGE_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topicId}:not-persisted`);
    }

    const seen = new Map<string, string>();
    for (const topic of PROFESSIONAL_VIDEO_PRODUCTION_TOPICS) {
      const key = topic.title.toLowerCase();
      if (seen.has(key)) duplicateKnowledge.push(`${topic.knowledgeId} duplicates title of ${seen.get(key)}`);
      else seen.set(key, topic.knowledgeId);
      if (seen.has(topic.knowledgeId) && seen.get(topic.knowledgeId) !== topic.title) {
        duplicateKnowledge.push(`duplicate id ${topic.knowledgeId}`);
      }
    }

    for (const topic of PROFESSIONAL_VIDEO_PRODUCTION_TOPICS) {
      for (const related of topic.relatedTopics) {
        if (!getVideoProductionTopic(related)) brokenRelationships.push(`${topic.topicId}→missing topic ${related}`);
      }
      for (const domainId of topic.relatedDomains) {
        if (!VIDEO_PRODUCTION_DOMAIN_BRIDGES.some((bridge) => bridge.domainId === domainId)) {
          brokenRelationships.push(`${topic.topicId}→missing domain bridge ${domainId}`);
        }
      }
    }

    const completenessScore = Math.max(
      0,
      100 -
        missingConcepts.length * 8 -
        duplicateKnowledge.length * 10 -
        brokenRelationships.length * 5
    );
    const healthy = missingConcepts.length === 0 && duplicateKnowledge.length === 0 && brokenRelationships.length === 0;
    if (!healthy) {
      issues.push(...missingConcepts.map((item) => `missing:${item}`));
      issues.push(...duplicateKnowledge.map((item) => `duplicate:${item}`));
      issues.push(...brokenRelationships.map((item) => `relationship:${item}`));
    }

    this.lastHealth = {
      healthy,
      completenessScore,
      missingConcepts,
      duplicateKnowledge,
      brokenRelationships,
      issues,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<VideoProductionKnowledgeRepairResult> {
    this.ensureStarted();
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured professional-production directory.");

    const before = await this.runHealthCheck();
    if (!before.healthy) {
      const reinstall = await this.installOrUpgrade();
      actions.push(
        `Reinstalled/upgraded topics (new=${reinstall.topicsInstalled}, updated=${reinstall.topicsUpdated}, relationships=${reinstall.relationshipsCreated}).`
      );
      if (reinstall.packSynced) actions.push("Synced video-production knowledge pack.");
      if (reinstall.domainMarkedReady) actions.push("Marked video-production-knowledge contentReady.");
      actions.push(...reinstall.issues.map((issue) => `install-note: ${issue}`));
    } else {
      actions.push("Health already clean; skipped reinstall.");
    }

    const health = await this.runHealthCheck();
    remainingIssues.push(...health.issues);
    const repair = {
      repaired: remainingIssues.length === 0,
      actions: unique(actions),
      remainingIssues,
    };
    this.lastRepair = repair;
    return structuredClone(repair);
  }

  private async syncVideoProductionPack(): Promise<boolean> {
    await this.packStore.ensureLayout();
    const items = PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.map((topic) => topicToKnowledgeItem(topic));
    const structured = mergeStructured(items);
    const existing = await this.packStore.readPack("video-production");
    const pack: KnowledgePack = {
      packId: existing?.packId ?? "",
      packSlug: "video-production",
      domain: VIDEO_PRODUCTION_DOMAIN_ID,
      title: "Professional Video Production Knowledge Pack",
      version: existing?.version ?? 1,
      status: existing?.status === "imported" || existing?.status === "certified" ? existing.status : "generated",
      items: mergePackItems(existing?.items ?? [], items),
      structuredKnowledge: structured,
      resourceIds: existing?.resourceIds ?? ["professional-video-production-expansion"],
      understandingIds: existing?.understandingIds ?? [],
      contentFingerprint: existing?.contentFingerprint ?? "",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      originalDocumentsPreserved: true,
      foundationKnowledgeId: existing?.foundationKnowledgeId,
      importedAt: existing?.importedAt,
      importKnowledgeId: existing?.importKnowledgeId,
      issues: [],
    };
    await this.packStore.writePack(pack);
    try {
      await this.foundation!.getKnowledgeExtractionEngine().reloadPacks();
    } catch {
      /* extraction engine may not expose reload in all states */
    }
    return true;
  }

  private countGraphRelationships(): number {
    try {
      let count = 0;
      for (const topic of PROFESSIONAL_VIDEO_PRODUCTION_TOPICS) {
        count += this.foundation!.getGraphEngine().getRelationships(topic.knowledgeId).length;
      }
      return count;
    } catch {
      return this.relationshipCount;
    }
  }

  private async persistMeta(install: VideoProductionKnowledgeInstallResult): Promise<void> {
    await fs.writeFile(
      path.join(this.metaRoot, "expansion-state.json"),
      `${JSON.stringify(
        {
          version: PROFESSIONAL_VIDEO_PRODUCTION_VERSION,
          domainId: VIDEO_PRODUCTION_DOMAIN_ID,
          installedAt: new Date().toISOString(),
          install,
          topicIds: REQUIRED_VIDEO_PRODUCTION_TOPIC_IDS,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new ProfessionalVideoProductionError("Professional Video Production Knowledge is not initialized", "NOT_INITIALIZED");
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalVideoProductionError("Professional Video Production Knowledge startup is incomplete", "NOT_STARTED");
    }
  }
}

function topicToKnowledgeItem(topic: ProfessionalVideoProductionTopic): KnowledgeItem {
  return {
    knowledgeId: topic.knowledgeId,
    title: topic.title,
    domain: VIDEO_PRODUCTION_DOMAIN_ID,
    category: "professional-video-production",
    description: topic.description,
    coreConcepts: topic.keywords.slice(0, 8),
    definitions: [topic.professionalDefinition],
    rules: topic.decisionRules,
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.professionalWorkflow,
    workflow: topic.professionalWorkflow,
    decisionRules: topic.decisionRules,
    commonMistakes: topic.commonMistakes,
    troubleshooting: topic.commonMistakes.map((mistake) => `Avoid: ${mistake}`),
    recommendations: topic.bestPractices,
    examples: topic.examples,
    professionalStandards: [
      `Confidence ${topic.confidenceScore}/100`,
      `Quality ${topic.qualityScore}/100`,
      "Offline-first curated professional standard",
    ],
    relatedTopics: topic.relatedTopics,
    keywords: topic.keywords,
    confidenceScore: topic.confidenceScore,
    qualityScore: topic.qualityScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Video Production Expansion",
        type: "curated-professional",
        reference: `expansion-step-1:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function topicToStructured(topic: ProfessionalVideoProductionTopic): StructuredKnowledge {
  return {
    title: topic.title,
    category: "professional-video-production",
    domain: VIDEO_PRODUCTION_DOMAIN_ID,
    description: topic.description,
    sections: [
      { title: "Definition", kind: "guidance", items: [topic.professionalDefinition] },
      { title: "Best Practices", kind: "guidance", items: topic.bestPractices },
      { title: "Workflow", kind: "workflow", items: topic.professionalWorkflow },
      { title: "Decision Rules", kind: "rules", items: topic.decisionRules },
      { title: "Examples", kind: "examples", items: topic.examples },
    ],
    concepts: topic.keywords,
    entities: [topic.title, ...topic.relatedDomains],
    terminology: topic.keywords,
    rules: topic.decisionRules,
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.professionalWorkflow,
    examples: topic.examples,
    commonMistakes: topic.commonMistakes,
    qualityRules: topic.bestPractices.filter((item) => /quality|clear|consistent|QA|readable/i.test(item)),
    decisionRules: topic.decisionRules,
    workflowSteps: topic.professionalWorkflow,
    prerequisites: topic.professionalWorkflow.slice(0, 1),
    dependencies: topic.relatedDomains,
    relatedKnowledge: topic.relatedTopics.map((id) => `vp-${id}`),
    definitions: [topic.professionalDefinition],
    troubleshooting: topic.commonMistakes.map((mistake) => `Avoid: ${mistake}`),
    recommendations: topic.bestPractices,
    professionalStandards: [`Expansion ${PROFESSIONAL_VIDEO_PRODUCTION_VERSION}`],
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      { name: "KWIZERA Professional Video Production Expansion", type: "curated-professional", reliability: 95 },
    ],
  };
}

function mergePackItems(existing: KnowledgeItem[], curated: KnowledgeItem[]): KnowledgeItem[] {
  const map = new Map<string, KnowledgeItem>();
  for (const item of existing) map.set(item.knowledgeId, item);
  for (const item of curated) map.set(item.knowledgeId, item);
  return [...map.values()];
}

function mergeStructured(items: KnowledgeItem[]): StructuredKnowledge {
  return {
    title: "Professional Video Production Knowledge",
    category: "professional-video-production",
    domain: VIDEO_PRODUCTION_DOMAIN_ID,
    description: "Curated professional video production knowledge for AI Me planning and advice (not video generation).",
    sections: [
      {
        title: "Topics",
        kind: "guidance",
        items: items.map((item) => item.title),
      },
      {
        title: "Best Practices",
        kind: "guidance",
        items: items.flatMap((item) => item.bestPractices).slice(0, 40),
      },
      {
        title: "Workflows",
        kind: "workflow",
        items: items.flatMap((item) => item.workflow).slice(0, 40),
      },
      {
        title: "Decision Rules",
        kind: "rules",
        items: items.flatMap((item) => item.decisionRules).slice(0, 40),
      },
      {
        title: "Examples",
        kind: "examples",
        items: items.flatMap((item) => item.examples).slice(0, 30),
      },
    ],
    concepts: unique(items.flatMap((item) => item.keywords)).slice(0, 50),
    entities: items.map((item) => item.title),
    terminology: unique(items.flatMap((item) => item.keywords)).slice(0, 50),
    rules: items.flatMap((item) => item.rules).slice(0, 40),
    bestPractices: items.flatMap((item) => item.bestPractices).slice(0, 40),
    professionalTechniques: items.flatMap((item) => item.professionalTechniques).slice(0, 40),
    examples: items.flatMap((item) => item.examples).slice(0, 30),
    commonMistakes: items.flatMap((item) => item.commonMistakes).slice(0, 30),
    qualityRules: items.flatMap((item) => item.professionalStandards).slice(0, 20),
    decisionRules: items.flatMap((item) => item.decisionRules).slice(0, 40),
    workflowSteps: items.flatMap((item) => item.workflow).slice(0, 40),
    prerequisites: ["Define audience and deliverable before production."],
    dependencies: ["camera-knowledge", "lighting-knowledge", "storytelling-knowledge", "marketing-knowledge"],
    relatedKnowledge: items.map((item) => item.knowledgeId),
    difficultyLevel: "advanced",
    confidenceScore: average(items.map((item) => item.confidenceScore)),
    sourceMetadata: [
      { name: "KWIZERA Professional Video Production Expansion", type: "curated-professional", reliability: 95 },
    ],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
