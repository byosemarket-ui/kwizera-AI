/**
 * Professional Social Media Knowledge — Expansion Step 8 installer.
 * Offline-first curated knowledge. Does not publish content automatically.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeNodeType, KnowledgeRelationType } from "../knowledge-graph-engine/types.js";
import { KnowledgePackStore } from "../knowledge-processing-engine/knowledge-pack-store.js";
import type { KnowledgeItem, KnowledgePack, KnowledgePackSlug } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import type { StructuredKnowledge } from "../knowledge-processing-engine/knowledge-processing-engine.js";
import { KnowledgeRecordStatus, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import {
  findSmTopics,
  getAllSmTopics,
  getSmTopic,
  PROFESSIONAL_FACEBOOK_TOPICS,
  PROFESSIONAL_INSTAGRAM_TOPICS,
  PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS,
  PROFESSIONAL_TIKTOK_TOPICS,
  PROFESSIONAL_YOUTUBE_TOPICS,
  REQUIRED_FACEBOOK_TOPIC_IDS,
  REQUIRED_INSTAGRAM_TOPIC_IDS,
  REQUIRED_SOCIAL_FUNDAMENTALS_TOPIC_IDS,
  REQUIRED_TIKTOK_TOPIC_IDS,
  REQUIRED_YOUTUBE_TOPIC_IDS,
  SM_DOMAIN_BRIDGES,
} from "./professional-social-media-catalog.js";
import {
  FACEBOOK_DOMAIN_ID,
  INSTAGRAM_DOMAIN_ID,
  PROFESSIONAL_SOCIAL_MEDIA_VERSION,
  ProfessionalSocialMediaError,
  SOCIAL_MEDIA_DOMAIN_ID,
  SOCIAL_MEDIA_KNOWLEDGE_SOURCE,
  TIKTOK_DOMAIN_ID,
  YOUTUBE_DOMAIN_ID,
  type AiMeSocialMediaAwareness,
  type ProfessionalSmTopic,
  type SmExplainResult,
  type SmHealthReport,
  type SmInstallResult,
  type SmRecommendation,
  type SmRepairResult,
} from "./professional-social-media-types.js";

const ALL_TOPICS = () => getAllSmTopics();

const SOCIAL_HUB_BRIDGE = "sm-bridge-social-media-knowledge";
const FUNDAMENTALS_ANCHOR = "sm-social-media-fundamentals";

export class ProfessionalSocialMediaKnowledge {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private lastInstall: SmInstallResult | null = null;
  private lastHealth: SmHealthReport | null = null;
  private lastRepair: SmRepairResult | null = null;
  private relationshipCount = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "videos", "professional-social-media");
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

  listFundamentalsTopics(): ProfessionalSmTopic[] {
    return PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.map((t) => structuredClone(t));
  }

  listTikTokTopics(): ProfessionalSmTopic[] {
    return PROFESSIONAL_TIKTOK_TOPICS.map((t) => structuredClone(t));
  }

  listInstagramTopics(): ProfessionalSmTopic[] {
    return PROFESSIONAL_INSTAGRAM_TOPICS.map((t) => structuredClone(t));
  }

  listFacebookTopics(): ProfessionalSmTopic[] {
    return PROFESSIONAL_FACEBOOK_TOPICS.map((t) => structuredClone(t));
  }

  listYouTubeTopics(): ProfessionalSmTopic[] {
    return PROFESSIONAL_YOUTUBE_TOPICS.map((t) => structuredClone(t));
  }

  getLastInstall(): SmInstallResult | null {
    return this.lastInstall ? structuredClone(this.lastInstall) : null;
  }

  getLastHealth(): SmHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async installOrUpgrade(): Promise<SmInstallResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const issues: string[] = [];
    const counters = {
      fundamentalsInstalled: 0,
      fundamentalsUpdated: 0,
      tiktokInstalled: 0,
      tiktokUpdated: 0,
      instagramInstalled: 0,
      instagramUpdated: 0,
      facebookInstalled: 0,
      facebookUpdated: 0,
      youtubeInstalled: 0,
      youtubeUpdated: 0,
    };
    let bridgesInstalled = 0;
    let relationshipsCreated = 0;

    const persistGroup = async (
      topics: ProfessionalSmTopic[],
      installedKey: keyof typeof counters,
      updatedKey: keyof typeof counters,
      label: string
    ) => {
      for (const topic of topics) {
        const r = await this.persistTopic(topic);
        if (r === "installed") counters[installedKey] += 1;
        else if (r === "updated") counters[updatedKey] += 1;
        else issues.push(`Failed ${label} ${topic.knowledgeId}`);
      }
    };

    await persistGroup(
      PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS,
      "fundamentalsInstalled",
      "fundamentalsUpdated",
      "fundamentals"
    );
    await persistGroup(PROFESSIONAL_TIKTOK_TOPICS, "tiktokInstalled", "tiktokUpdated", "tiktok");
    await persistGroup(PROFESSIONAL_INSTAGRAM_TOPICS, "instagramInstalled", "instagramUpdated", "instagram");
    await persistGroup(PROFESSIONAL_FACEBOOK_TOPICS, "facebookInstalled", "facebookUpdated", "facebook");
    await persistGroup(PROFESSIONAL_YOUTUBE_TOPICS, "youtubeInstalled", "youtubeUpdated", "youtube");

    for (const bridge of SM_DOMAIN_BRIDGES) {
      const existing = await foundation.getStorageEngine().getRecord(bridge.knowledgeId, SOCIAL_MEDIA_KNOWLEDGE_SOURCE);
      const payload = {
        step: "knowledge-expansion-social-media",
        bridgeDomainId: bridge.domainId,
        relationshipAnchor: true,
        publishesContent: false,
        professionalTechniques: [],
        bestPractices: [],
        decisionRules: [`Relate social media knowledge to ${bridge.domainId}.`],
        structuredKnowledge: bridgeStructured(bridge.title, bridge.domainId, bridge.description),
      };
      if (existing.success && existing.record) {
        await foundation.getStorageEngine().updateRecord(
          bridge.knowledgeId,
          {
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["social-media", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "social", "media", "platform", "relationship"],
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: [FUNDAMENTALS_ANCHOR],
            payload,
          },
          SOCIAL_MEDIA_KNOWLEDGE_SOURCE
        );
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: bridge.knowledgeId,
            knowledgeType: KnowledgeStorageType.Marketing,
            category: "sm-domain-bridge",
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["social-media", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "social", "media", "platform", "relationship"],
            source: SOCIAL_MEDIA_KNOWLEDGE_SOURCE,
            sourceReliability: 90,
            confidenceScore: 85,
            qualityScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: [FUNDAMENTALS_ANCHOR],
            payload,
          },
          SOCIAL_MEDIA_KNOWLEDGE_SOURCE
        );
        if (write.success) bridgesInstalled += 1;
        else issues.push(`Failed bridge ${bridge.knowledgeId}`);
      }
    }

    for (const topic of ALL_TOPICS()) {
      try {
        foundation.getRetrievalEngine().invalidateCache(topic.knowledgeId);
        foundation.getGraphEngine().createNode(
          topic.knowledgeId,
          KnowledgeNodeType.BusinessConcept,
          topic.name,
          `${topic.name} ${topic.description} ${topic.keywords.join(" ")}`
        );
      } catch (error) {
        issues.push(`Graph node creation failed for ${topic.knowledgeId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    for (const bridge of SM_DOMAIN_BRIDGES) {
      try {
        foundation.getRetrievalEngine().invalidateCache(bridge.knowledgeId);
        foundation.getGraphEngine().createNode(
          bridge.knowledgeId,
          KnowledgeNodeType.BusinessConcept,
          bridge.title,
          `${bridge.title} ${bridge.description} ${bridge.domainId}`
        );
      } catch (error) {
        issues.push(
          `Graph node creation failed for ${bridge.knowledgeId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    for (const bridge of SM_DOMAIN_BRIDGES) {
      if (bridge.knowledgeId === SOCIAL_HUB_BRIDGE) continue;
      relationshipsCreated += await this.tryRelate(
        SOCIAL_HUB_BRIDGE,
        bridge.knowledgeId,
        KnowledgeRelationType.RelatedTo,
        bridge.relationshipEvidence
      );
    }
    relationshipsCreated += await this.tryRelate(
      SOCIAL_HUB_BRIDGE,
      "sm-bridge-marketing-knowledge",
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Social media executes marketing goals on platforms."
    );
    relationshipsCreated += await this.tryRelate(
      "sm-bridge-video-production-knowledge",
      "sm-bridge-video-editing-knowledge",
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Production and editing jointly deliver platform-ready social video."
    );

    for (const topic of ALL_TOPICS()) {
      for (const related of topic.relatedTopics) {
        const target = getSmTopic(related)?.knowledgeId;
        if (!target) continue;
        relationshipsCreated += await this.tryRelate(
          topic.knowledgeId,
          target,
          KnowledgeRelationType.RelatedTo,
          `${topic.name} relates to ${related}.`
        );
      }
      for (const domainId of topic.relatedDomains) {
        relationshipsCreated += await this.tryRelate(
          topic.knowledgeId,
          `sm-bridge-${domainId}`,
          KnowledgeRelationType.DependsOn,
          `${topic.name} depends on domain ${domainId}.`
        );
      }
    }

    this.relationshipCount = relationshipsCreated;

    let socialMediaPackSynced = false;
    try {
      socialMediaPackSynced = await this.syncPack(
        "social-media",
        SOCIAL_MEDIA_DOMAIN_ID,
        "Professional Social Media Knowledge Pack",
        ALL_TOPICS().map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Social media pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let domainsMarkedReady = false;
    try {
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(SOCIAL_MEDIA_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(TIKTOK_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(INSTAGRAM_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(FACEBOOK_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(YOUTUBE_DOMAIN_ID, true);
      domainsMarkedReady = true;
    } catch (error) {
      issues.push(`Domain mark ready failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const result: SmInstallResult = {
      installed:
        countersOk(
          counters.fundamentalsInstalled,
          counters.fundamentalsUpdated,
          PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.length
        ) &&
        countersOk(counters.tiktokInstalled, counters.tiktokUpdated, PROFESSIONAL_TIKTOK_TOPICS.length) &&
        countersOk(counters.instagramInstalled, counters.instagramUpdated, PROFESSIONAL_INSTAGRAM_TOPICS.length) &&
        countersOk(counters.facebookInstalled, counters.facebookUpdated, PROFESSIONAL_FACEBOOK_TOPICS.length) &&
        countersOk(counters.youtubeInstalled, counters.youtubeUpdated, PROFESSIONAL_YOUTUBE_TOPICS.length) &&
        issues.filter((i) => i.startsWith("Failed")).length === 0,
      ...counters,
      bridgesInstalled,
      relationshipsCreated,
      socialMediaPackSynced,
      domainsMarkedReady,
      issues,
    };
    this.lastInstall = result;
    await fs.writeFile(
      path.join(this.metaRoot, "expansion-state.json"),
      `${JSON.stringify(
        {
          version: PROFESSIONAL_SOCIAL_MEDIA_VERSION,
          domainIds: [
            SOCIAL_MEDIA_DOMAIN_ID,
            TIKTOK_DOMAIN_ID,
            INSTAGRAM_DOMAIN_ID,
            FACEBOOK_DOMAIN_ID,
            YOUTUBE_DOMAIN_ID,
          ],
          installedAt: new Date().toISOString(),
          install: result,
          fundamentalsTopicIds: REQUIRED_SOCIAL_FUNDAMENTALS_TOPIC_IDS,
          tiktokTopicIds: REQUIRED_TIKTOK_TOPIC_IDS,
          instagramTopicIds: REQUIRED_INSTAGRAM_TOPIC_IDS,
          facebookTopicIds: REQUIRED_FACEBOOK_TOPIC_IDS,
          youtubeTopicIds: REQUIRED_YOUTUBE_TOPIC_IDS,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    return structuredClone(result);
  }

  recommendPlatform(query: string): SmRecommendation {
    const pool = [
      ...PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.filter((t) =>
        ["platform-selection", "social-audience-analysis", "social-content-strategy", "social-media-fundamentals"].includes(
          t.topicId
        )
      ),
      ...PROFESSIONAL_TIKTOK_TOPICS.filter((t) => t.topicId === "tiktok-best-practices"),
      ...PROFESSIONAL_INSTAGRAM_TOPICS.filter((t) =>
        ["instagram-reels-strategy", "instagram-feed-strategy"].includes(t.topicId)
      ),
      ...PROFESSIONAL_FACEBOOK_TOPICS.filter((t) => t.topicId === "facebook-page-strategy"),
      ...PROFESSIONAL_YOUTUBE_TOPICS.filter((t) =>
        ["youtube-long-form-strategy", "youtube-shorts-strategy"].includes(t.topicId)
      ),
    ];
    return this.recommendFrom(query || "platform selection", pool, "platform");
  }

  recommendContentFormat(query: string): SmRecommendation {
    const pool = ALL_TOPICS().filter((t) =>
      /reels|shorts|carousel|stories|feed|long-form|short-form/.test(t.topicId)
    );
    return this.recommendFrom(query || "content format reels shorts carousel", pool, "format");
  }

  explainPlatformDecision(query: string): SmExplainResult {
    return this.explain(query);
  }

  recommendPostingStrategy(query: string): SmRecommendation {
    const pool = ALL_TOPICS().filter((t) => /calendar|posting|scheduling/.test(t.topicId));
    return this.recommendFrom(query || "content calendar posting schedule", pool, "posting");
  }

  recommendEngagementStrategy(query: string): SmRecommendation {
    const pool = ALL_TOPICS().filter((t) => /engagement|community/.test(t.topicId));
    return this.recommendFrom(query || "engagement community building", pool, "engagement");
  }

  explain(query: string): SmExplainResult {
    this.ensureStarted();
    const topic = findSmTopics(query, ALL_TOPICS())[0];
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        explanation: `No professional social media knowledge matches "${query}".`,
        bestPractices: [],
        confidenceScore: 0,
        qualityScore: 0,
        kind: "none",
      };
    }
    return {
      available: true,
      knowledgeId: topic.knowledgeId,
      title: topic.name,
      explanation: `${topic.professionalDefinition} Purpose: ${topic.purpose}`,
      bestPractices: topic.bestPractices,
      confidenceScore: topic.confidenceScore,
      qualityScore: topic.qualityScore,
      kind: kindOf(topic),
    };
  }

  answer(question: string): { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } {
    this.ensureStarted();
    const lower = question.toLowerCase();
    if (/tiktok/.test(lower)) {
      const explained = this.explainFrom(question, PROFESSIONAL_TIKTOK_TOPICS, "tiktok");
      if (explained.available && explained.knowledgeId) {
        return {
          available: true,
          answer: `${explained.explanation} Best practice: ${explained.bestPractices[0]}.`,
          knowledgeIds: [explained.knowledgeId],
          confidenceScore: explained.confidenceScore,
        };
      }
    }
    if (/instagram|reels|stories|carousel/.test(lower)) {
      const explained = this.explainFrom(question, PROFESSIONAL_INSTAGRAM_TOPICS, "instagram");
      if (explained.available && explained.knowledgeId) {
        return {
          available: true,
          answer: `${explained.explanation} Best practice: ${explained.bestPractices[0]}.`,
          knowledgeIds: [explained.knowledgeId],
          confidenceScore: explained.confidenceScore,
        };
      }
    }
    if (/facebook/.test(lower)) {
      const explained = this.explainFrom(question, PROFESSIONAL_FACEBOOK_TOPICS, "facebook");
      if (explained.available && explained.knowledgeId) {
        return {
          available: true,
          answer: `${explained.explanation} Best practice: ${explained.bestPractices[0]}.`,
          knowledgeIds: [explained.knowledgeId],
          confidenceScore: explained.confidenceScore,
        };
      }
    }
    if (/youtube|shorts|thumbnail|watch time/.test(lower)) {
      const explained = this.explainFrom(question, PROFESSIONAL_YOUTUBE_TOPICS, "youtube");
      if (explained.available && explained.knowledgeId) {
        return {
          available: true,
          answer: `${explained.explanation} Best practice: ${explained.bestPractices[0]}.`,
          knowledgeIds: [explained.knowledgeId],
          confidenceScore: explained.confidenceScore,
        };
      }
    }
    if (/platform|which channel|where (to|should) post|choose.*(tiktok|instagram|facebook|youtube)/.test(lower)) {
      const rec = this.recommendPlatform(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getSmTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/format|reels|shorts|carousel|stories|feed|long[- ]?form|short[- ]?form/.test(lower)) {
      const rec = this.recommendContentFormat(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getSmTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/posting|calendar|schedule|when to post|frequency/.test(lower)) {
      const rec = this.recommendPostingStrategy(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getSmTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/engagement|community|comments|reply|audience retention/.test(lower)) {
      const rec = this.recommendEngagementStrategy(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getSmTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    const explained = this.explain(question);
    if (!explained.available || !explained.knowledgeId) {
      return {
        available: false,
        answer: `No validated social media knowledge answers "${question}".`,
        knowledgeIds: [],
        confidenceScore: 0,
      };
    }
    return {
      available: true,
      answer: `${explained.explanation} Best practice: ${explained.bestPractices[0] ?? "n/a"}.`,
      knowledgeIds: [explained.knowledgeId],
      confidenceScore: explained.confidenceScore,
    };
  }

  getAiMeAwareness(): AiMeSocialMediaAwareness {
    this.ensureStarted();
    const all = ALL_TOPICS();
    let socialMediaDomainReady = false;
    let tiktokDomainReady = false;
    let instagramDomainReady = false;
    let facebookDomainReady = false;
    let youtubeDomainReady = false;
    try {
      socialMediaDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(SOCIAL_MEDIA_DOMAIN_ID)?.metadata.contentReady === true;
      tiktokDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(TIKTOK_DOMAIN_ID)?.metadata.contentReady === true;
      instagramDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(INSTAGRAM_DOMAIN_ID)?.metadata.contentReady === true;
      facebookDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(FACEBOOK_DOMAIN_ID)?.metadata.contentReady === true;
      youtubeDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(YOUTUBE_DOMAIN_ID)?.metadata.contentReady === true;
    } catch {
      /* optional */
    }
    return {
      canRecommendPlatform: true,
      canRecommendContentFormat: true,
      canExplainPlatformDecisions: true,
      canRecommendPostingStrategies: true,
      canRecommendEngagementStrategies: true,
      canAnswerQuestions: true,
      fundamentalsTopicCount: PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.length,
      tiktokTopicCount: PROFESSIONAL_TIKTOK_TOPICS.length,
      instagramTopicCount: PROFESSIONAL_INSTAGRAM_TOPICS.length,
      facebookTopicCount: PROFESSIONAL_FACEBOOK_TOPICS.length,
      youtubeTopicCount: PROFESSIONAL_YOUTUBE_TOPICS.length,
      relationshipCount: this.relationshipCount,
      averageConfidence: average(all.map((t) => t.confidenceScore)),
      averageQuality: average(all.map((t) => t.qualityScore)),
      socialMediaDomainReady,
      tiktokDomainReady,
      instagramDomainReady,
      facebookDomainReady,
      youtubeDomainReady,
      summary:
        `Professional Social Media Knowledge Expansion Step 8 is active with ${PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.length} fundamentals, ${PROFESSIONAL_TIKTOK_TOPICS.length} TikTok, ${PROFESSIONAL_INSTAGRAM_TOPICS.length} Instagram, ${PROFESSIONAL_FACEBOOK_TOPICS.length} Facebook, and ${PROFESSIONAL_YOUTUBE_TOPICS.length} YouTube topics. ` +
        `AI Me can recommend platforms and formats, explain platform decisions, recommend posting and engagement strategies, and answer professional social media questions. ` +
        `This knowledge does not publish content automatically (publishesContent: false). Industry Best Practices Step 9 is not started.`,
    };
  }

  async runHealthCheck(): Promise<SmHealthReport> {
    this.ensureStarted();
    const missingConcepts: string[] = [];
    const missingFundamentalsConcepts: string[] = [];
    const missingTikTokConcepts: string[] = [];
    const missingInstagramConcepts: string[] = [];
    const missingFacebookConcepts: string[] = [];
    const missingYouTubeConcepts: string[] = [];
    const duplicateKnowledge: string[] = [];
    const brokenRelationships: string[] = [];
    const issues: string[] = [];
    const foundation = this.foundation!;

    for (const topic of ALL_TOPICS()) {
      for (const field of ["name", "description", "purpose", "professionalDefinition"] as const) {
        if (!topic[field]?.trim()) missingConcepts.push(`${topic.topicId}:${field}`);
      }
      for (const list of ["bestPractices", "commonMistakes", "workflow", "professionalExamples", "keywords", "relatedTopics"] as const) {
        if (!topic[list].length) missingConcepts.push(`${topic.topicId}:${list}`);
      }
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, SOCIAL_MEDIA_KNOWLEDGE_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topic.topicId}:not-persisted`);
    }

    for (const id of REQUIRED_SOCIAL_FUNDAMENTALS_TOPIC_IDS) {
      if (!getSmTopic(id)) missingFundamentalsConcepts.push(id);
    }
    for (const id of REQUIRED_TIKTOK_TOPIC_IDS) {
      if (!getSmTopic(id)) missingTikTokConcepts.push(id);
    }
    for (const id of REQUIRED_INSTAGRAM_TOPIC_IDS) {
      if (!getSmTopic(id)) missingInstagramConcepts.push(id);
    }
    for (const id of REQUIRED_FACEBOOK_TOPIC_IDS) {
      if (!getSmTopic(id)) missingFacebookConcepts.push(id);
    }
    for (const id of REQUIRED_YOUTUBE_TOPIC_IDS) {
      if (!getSmTopic(id)) missingYouTubeConcepts.push(id);
    }

    const seen = new Map<string, string>();
    for (const topic of ALL_TOPICS()) {
      const key = `${topic.metadata.category}:${topic.name.toLowerCase()}`;
      if (seen.has(key)) duplicateKnowledge.push(`${topic.knowledgeId} duplicates ${seen.get(key)}`);
      else seen.set(key, topic.knowledgeId);
      for (const related of topic.relatedTopics) {
        if (!getSmTopic(related)) brokenRelationships.push(`${topic.topicId}→missing ${related}`);
      }
      for (const domainId of topic.relatedDomains) {
        if (!SM_DOMAIN_BRIDGES.some((b) => b.domainId === domainId)) {
          brokenRelationships.push(`${topic.topicId}→missing bridge ${domainId}`);
        }
      }
    }

    const completenessScore = Math.max(
      0,
      100 -
        missingConcepts.length * 3 -
        missingFundamentalsConcepts.length * 2 -
        missingTikTokConcepts.length * 2 -
        missingInstagramConcepts.length * 2 -
        missingFacebookConcepts.length * 2 -
        missingYouTubeConcepts.length * 2 -
        duplicateKnowledge.length * 8 -
        brokenRelationships.length * 3
    );
    const healthy =
      missingConcepts.length === 0 &&
      missingFundamentalsConcepts.length === 0 &&
      missingTikTokConcepts.length === 0 &&
      missingInstagramConcepts.length === 0 &&
      missingFacebookConcepts.length === 0 &&
      missingYouTubeConcepts.length === 0 &&
      duplicateKnowledge.length === 0 &&
      brokenRelationships.length === 0;
    if (!healthy) {
      issues.push(...missingConcepts.map((i) => `missing:${i}`));
      issues.push(...missingFundamentalsConcepts.map((i) => `fundamentals:${i}`));
      issues.push(...missingTikTokConcepts.map((i) => `tiktok:${i}`));
      issues.push(...missingInstagramConcepts.map((i) => `instagram:${i}`));
      issues.push(...missingFacebookConcepts.map((i) => `facebook:${i}`));
      issues.push(...missingYouTubeConcepts.map((i) => `youtube:${i}`));
      issues.push(...duplicateKnowledge.map((i) => `duplicate:${i}`));
      issues.push(...brokenRelationships.map((i) => `relationship:${i}`));
    }

    this.lastHealth = {
      healthy,
      completenessScore,
      missingConcepts,
      missingFundamentalsConcepts,
      missingTikTokConcepts,
      missingInstagramConcepts,
      missingFacebookConcepts,
      missingYouTubeConcepts,
      duplicateKnowledge,
      brokenRelationships,
      issues,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<SmRepairResult> {
    this.ensureStarted();
    const actions: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured professional-social-media directory.");
    const before = await this.runHealthCheck();
    if (!before.healthy) {
      const reinstall = await this.installOrUpgrade();
      actions.push(
        `Reinstalled/upgraded (fund ${reinstall.fundamentalsInstalled}/${reinstall.fundamentalsUpdated}; tt ${reinstall.tiktokInstalled}/${reinstall.tiktokUpdated}; ig ${reinstall.instagramInstalled}/${reinstall.instagramUpdated}; fb ${reinstall.facebookInstalled}/${reinstall.facebookUpdated}; yt ${reinstall.youtubeInstalled}/${reinstall.youtubeUpdated}; rel=${reinstall.relationshipsCreated}).`
      );
      if (reinstall.socialMediaPackSynced) actions.push("Synced social-media pack.");
      if (reinstall.domainsMarkedReady) {
        actions.push("Marked social-media/tiktok/instagram/facebook/youtube domains contentReady.");
      }
    } else {
      actions.push("Health already clean; skipped reinstall.");
    }
    const health = await this.runHealthCheck();
    const repair = { repaired: health.issues.length === 0, actions: unique(actions), remainingIssues: health.issues };
    this.lastRepair = repair;
    return structuredClone(repair);
  }

  private recommendFrom(
    query: string,
    pool: ProfessionalSmTopic[],
    kind: SmRecommendation["kind"]
  ): SmRecommendation {
    this.ensureStarted();
    const matches = findSmTopics(query, pool);
    const primary = matches[0];
    if (!primary) {
      return {
        available: false,
        topicId: null,
        name: query,
        reason: `No ${kind} knowledge matches "${query}".`,
        bestPractices: [],
        workflow: [],
        confidenceScore: 0,
        alternatives: [],
        kind: "none",
      };
    }
    return {
      available: true,
      topicId: primary.topicId,
      name: primary.name,
      reason: `${primary.purpose} Selected because it best matches: ${query}. ${primary.professionalDefinition}`,
      bestPractices: primary.bestPractices,
      workflow: primary.workflow,
      confidenceScore: primary.confidenceScore,
      alternatives: matches.slice(1, 3).map((m) => ({ name: m.name, reason: m.purpose })),
      kind,
    };
  }

  private explainFrom(
    query: string,
    pool: ProfessionalSmTopic[],
    kind: SmExplainResult["kind"]
  ): SmExplainResult {
    this.ensureStarted();
    const topic = findSmTopics(query, pool)[0];
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        explanation: `No ${kind} knowledge matches "${query}".`,
        bestPractices: [],
        confidenceScore: 0,
        qualityScore: 0,
        kind: "none",
      };
    }
    return {
      available: true,
      knowledgeId: topic.knowledgeId,
      title: topic.name,
      explanation: `${topic.professionalDefinition} Purpose: ${topic.purpose}`,
      bestPractices: topic.bestPractices,
      confidenceScore: topic.confidenceScore,
      qualityScore: topic.qualityScore,
      kind,
    };
  }

  private async persistTopic(topic: ProfessionalSmTopic): Promise<"installed" | "updated" | "failed"> {
    const foundation = this.foundation!;
    const relatedKnowledge = unique([
      ...topic.relatedTopics.map((id) => getSmTopic(id)?.knowledgeId ?? id),
      ...topic.relatedDomains.map((id) => `sm-bridge-${id}`),
    ]).filter((id) => id !== topic.knowledgeId);
    const payload = {
      step: "knowledge-expansion-social-media",
      expansionVersion: PROFESSIONAL_SOCIAL_MEDIA_VERSION,
      topicId: topic.topicId,
      kind: topic.metadata.category,
      purpose: topic.purpose,
      professionalDefinition: topic.professionalDefinition,
      workflow: topic.workflow,
      knowledgeItem: topicToItem(topic),
      structuredKnowledge: topicToStructured(topic),
      metadata: topic.metadata,
      publishesContent: false,
      professionalTechniques: topic.bestPractices,
      bestPractices: topic.bestPractices,
      decisionRules: topic.bestPractices.map((b) => `Practice: ${b}`),
    };
    const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, SOCIAL_MEDIA_KNOWLEDGE_SOURCE);
    if (existing.success && existing.record) {
      const write = await foundation.getStorageEngine().updateRecord(
        topic.knowledgeId,
        {
          title: topic.name,
          description: topic.description,
          summary: topic.purpose,
          tags: unique([topic.metadata.category, "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
          keywords: topic.keywords,
          confidenceScore: topic.confidenceScore,
          qualityScore: topic.qualityScore,
          verificationStatus: KnowledgeVerificationStatus.Verified,
          status: KnowledgeRecordStatus.Verified,
          relatedKnowledge,
          payload,
        },
        SOCIAL_MEDIA_KNOWLEDGE_SOURCE
      );
      return write.success ? "updated" : "failed";
    }
    const write = await foundation.getStorageEngine().storeRecord(
      {
        knowledgeId: topic.knowledgeId,
        knowledgeType: KnowledgeStorageType.Marketing,
        category: topic.metadata.category,
        title: topic.name,
        description: topic.description,
        summary: topic.purpose,
        tags: unique([topic.metadata.category, "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
        keywords: topic.keywords,
        source: SOCIAL_MEDIA_KNOWLEDGE_SOURCE,
        sourceReliability: 95,
        confidenceScore: topic.confidenceScore,
        qualityScore: topic.qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge,
        payload,
      },
      SOCIAL_MEDIA_KNOWLEDGE_SOURCE
    );
    return write.success ? "installed" : "failed";
  }

  private async tryRelate(
    sourceId: string,
    targetId: string,
    relationshipType: KnowledgeRelationType,
    evidence: string
  ): Promise<number> {
    try {
      const edge = this.foundation!.getGraphEngine().createRelationship({
        sourceId,
        targetId,
        relationshipType,
        evidence,
        strengthScore: 84,
        confidenceScore: 88,
      });
      return edge ? 1 : 0;
    } catch {
      return 0;
    }
  }

  private async syncPack(slug: KnowledgePackSlug, domain: string, title: string, items: KnowledgeItem[]): Promise<boolean> {
    await this.packStore.ensureLayout();
    const existing = await this.packStore.readPack(slug);
    const pack: KnowledgePack = {
      packId: existing?.packId ?? "",
      packSlug: slug,
      domain,
      title,
      version: existing?.version ?? 1,
      status: existing?.status === "imported" || existing?.status === "certified" ? existing.status : "generated",
      items: mergePackItems(existing?.items ?? [], items),
      structuredKnowledge: mergeStructured(title, domain, items),
      resourceIds: existing?.resourceIds ?? ["professional-social-media-expansion"],
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
      /* optional */
    }
    return true;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new ProfessionalSocialMediaError(
        "Professional Social Media Knowledge is not initialized",
        "NOT_INITIALIZED"
      );
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalSocialMediaError(
        "Professional Social Media Knowledge startup is incomplete",
        "NOT_STARTED"
      );
    }
  }
}

function countersOk(installed: number, updated: number, expected: number): boolean {
  return installed + updated >= expected;
}

function kindOf(topic: ProfessionalSmTopic | null | undefined): SmExplainResult["kind"] {
  if (!topic) return "none";
  switch (topic.metadata.category) {
    case "professional-social-fundamentals":
      return "fundamentals";
    case "professional-tiktok":
      return "tiktok";
    case "professional-instagram":
      return "instagram";
    case "professional-facebook":
      return "facebook";
    case "professional-youtube":
      return "youtube";
    default:
      return "none";
  }
}

function topicToItem(topic: ProfessionalSmTopic): KnowledgeItem {
  return {
    knowledgeId: topic.knowledgeId,
    title: topic.name,
    domain: topic.metadata.domainId,
    category: topic.metadata.category,
    description: topic.description,
    coreConcepts: topic.keywords.slice(0, 8),
    definitions: [topic.professionalDefinition, topic.purpose],
    rules: topic.bestPractices.map((b) => `Practice: ${b}`),
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.workflow,
    workflow: topic.workflow,
    decisionRules: topic.bestPractices.map((b) => `Follow: ${b}`),
    commonMistakes: topic.commonMistakes,
    troubleshooting: topic.commonMistakes.map((m) => `Avoid: ${m}`),
    recommendations: topic.bestPractices,
    examples: topic.professionalExamples,
    professionalStandards: [topic.professionalDefinition],
    relatedTopics: topic.relatedTopics,
    keywords: topic.keywords,
    confidenceScore: topic.confidenceScore,
    qualityScore: topic.qualityScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Social Media Expansion",
        type: "curated-professional",
        reference: `expansion-step-8:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function topicToStructured(topic: ProfessionalSmTopic): StructuredKnowledge {
  return {
    title: topic.name,
    category: topic.metadata.category,
    domain: topic.metadata.domainId,
    description: topic.description,
    sections: [
      { title: "Professional Definition", kind: "guidance", items: [topic.professionalDefinition] },
      { title: "Purpose", kind: "guidance", items: [topic.purpose] },
      { title: "Workflow", kind: "workflow", items: topic.workflow },
      { title: "Best Practices", kind: "guidance", items: topic.bestPractices },
      { title: "Examples", kind: "examples", items: topic.professionalExamples },
    ],
    concepts: topic.keywords,
    entities: [topic.name, ...topic.relatedDomains],
    terminology: topic.keywords,
    rules: topic.commonMistakes.map((m) => `Avoid: ${m}`),
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.workflow,
    examples: topic.professionalExamples,
    commonMistakes: topic.commonMistakes,
    qualityRules: [],
    decisionRules: topic.bestPractices.map((b) => `Practice: ${b}`),
    workflowSteps: topic.workflow,
    prerequisites: [],
    dependencies: topic.relatedDomains,
    relatedKnowledge: topic.relatedTopics.map((id) => getSmTopic(id)?.knowledgeId ?? id),
    definitions: [topic.professionalDefinition, topic.purpose],
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Social Media Expansion",
        type: "curated-professional",
        reliability: 95,
      },
    ],
  };
}

function bridgeStructured(title: string, domain: string, description: string): StructuredKnowledge {
  return {
    title,
    category: "domain-bridge",
    domain,
    description,
    sections: [],
    concepts: [domain],
    entities: [domain],
    terminology: [domain],
    rules: [],
    bestPractices: [],
    professionalTechniques: [],
    examples: [],
    commonMistakes: [],
    qualityRules: [],
    decisionRules: [`Relate social media knowledge to ${domain}.`],
    workflowSteps: [],
    prerequisites: [],
    dependencies: [],
    relatedKnowledge: [FUNDAMENTALS_ANCHOR],
    difficultyLevel: "foundation",
    confidenceScore: 85,
    sourceMetadata: [
      { name: "KWIZERA Professional Social Media Expansion", type: "curated", reliability: 95 },
    ],
  };
}

function mergePackItems(existing: KnowledgeItem[], curated: KnowledgeItem[]): KnowledgeItem[] {
  const map = new Map<string, KnowledgeItem>();
  for (const item of existing) map.set(item.knowledgeId, item);
  for (const item of curated) map.set(item.knowledgeId, item);
  return [...map.values()];
}

function mergeStructured(title: string, domain: string, items: KnowledgeItem[]): StructuredKnowledge {
  return {
    title,
    category: "professional-social-media",
    domain,
    description: "Curated professional social media knowledge for AI Me (does not publish content automatically).",
    sections: [
      { title: "Topics", kind: "guidance", items: items.map((i) => i.title) },
      { title: "Best Practices", kind: "guidance", items: items.flatMap((i) => i.bestPractices).slice(0, 40) },
      { title: "Workflow", kind: "workflow", items: items.flatMap((i) => i.workflow).slice(0, 40) },
      { title: "Examples", kind: "examples", items: items.flatMap((i) => i.examples).slice(0, 30) },
    ],
    concepts: unique(items.flatMap((i) => i.keywords)).slice(0, 50),
    entities: items.map((i) => i.title),
    terminology: unique(items.flatMap((i) => i.keywords)).slice(0, 50),
    rules: items.flatMap((i) => i.rules).slice(0, 40),
    bestPractices: items.flatMap((i) => i.bestPractices).slice(0, 40),
    professionalTechniques: items.flatMap((i) => i.professionalTechniques).slice(0, 40),
    examples: items.flatMap((i) => i.examples).slice(0, 30),
    commonMistakes: items.flatMap((i) => i.commonMistakes).slice(0, 30),
    qualityRules: items.flatMap((i) => i.professionalStandards).slice(0, 20),
    decisionRules: items.flatMap((i) => i.decisionRules).slice(0, 40),
    workflowSteps: items.flatMap((i) => i.workflow).slice(0, 40),
    prerequisites: ["Define audience and goals before selecting platforms and formats."],
    dependencies: ["marketing-knowledge", "branding-knowledge", "storytelling-knowledge", "video-production-knowledge"],
    relatedKnowledge: items.map((i) => i.knowledgeId),
    difficultyLevel: "advanced",
    confidenceScore: average(items.map((i) => i.confidenceScore)),
    sourceMetadata: [
      {
        name: "KWIZERA Professional Social Media Expansion",
        type: "curated-professional",
        reliability: 95,
      },
    ],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}
