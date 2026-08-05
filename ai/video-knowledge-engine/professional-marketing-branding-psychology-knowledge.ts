/**
 * Professional Marketing, Branding, Customer & Sales Psychology — Expansion Step 7 installer.
 * Offline-first curated knowledge. Does not create advertisements automatically.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRelationType } from "../knowledge-graph-engine/types.js";
import { KnowledgePackStore } from "../knowledge-processing-engine/knowledge-pack-store.js";
import type { KnowledgeItem, KnowledgePack, KnowledgePackSlug } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import type { StructuredKnowledge } from "../knowledge-processing-engine/knowledge-processing-engine.js";
import { KnowledgeRecordStatus, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import {
  findMbpTopics,
  getMbpTopic,
  MBP_DOMAIN_BRIDGES,
  PROFESSIONAL_BRANDING_TOPICS,
  PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
  PROFESSIONAL_MARKETING_TOPICS,
  PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
  PROFESSIONAL_VIDEO_MARKETING_TOPICS,
  REQUIRED_BRANDING_TOPIC_IDS,
  REQUIRED_CUSTOMER_PSYCHOLOGY_TOPIC_IDS,
  REQUIRED_MARKETING_TOPIC_IDS,
  REQUIRED_SALES_PSYCHOLOGY_TOPIC_IDS,
  REQUIRED_VIDEO_MARKETING_TOPIC_IDS,
} from "./professional-marketing-branding-psychology-catalog.js";
import {
  BRANDING_DOMAIN_ID,
  CUSTOMER_PSYCHOLOGY_DOMAIN_ID,
  MARKETING_BRANDING_PSYCHOLOGY_SOURCE,
  MARKETING_DOMAIN_ID,
  PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION,
  ProfessionalMbpError,
  SALES_PSYCHOLOGY_DOMAIN_ID,
  type AiMeMbpAwareness,
  type MbpExplainResult,
  type MbpHealthReport,
  type MbpInstallResult,
  type MbpRecommendation,
  type MbpRepairResult,
  type ProfessionalMbpTopic,
} from "./professional-marketing-branding-psychology-types.js";

const ALL_TOPICS = () => [
  ...PROFESSIONAL_MARKETING_TOPICS,
  ...PROFESSIONAL_BRANDING_TOPICS,
  ...PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
  ...PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
  ...PROFESSIONAL_VIDEO_MARKETING_TOPICS,
];

export class ProfessionalMarketingBrandingPsychologyKnowledge {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private lastInstall: MbpInstallResult | null = null;
  private lastHealth: MbpHealthReport | null = null;
  private lastRepair: MbpRepairResult | null = null;
  private relationshipCount = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "videos", "professional-marketing-branding-psychology");
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

  listMarketingTopics(): ProfessionalMbpTopic[] {
    return [...PROFESSIONAL_MARKETING_TOPICS, ...PROFESSIONAL_VIDEO_MARKETING_TOPICS].map((t) => structuredClone(t));
  }

  listBrandingTopics(): ProfessionalMbpTopic[] {
    return PROFESSIONAL_BRANDING_TOPICS.map((t) => structuredClone(t));
  }

  listCustomerPsychologyTopics(): ProfessionalMbpTopic[] {
    return PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.map((t) => structuredClone(t));
  }

  listSalesPsychologyTopics(): ProfessionalMbpTopic[] {
    return PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.map((t) => structuredClone(t));
  }

  getLastInstall(): MbpInstallResult | null {
    return this.lastInstall ? structuredClone(this.lastInstall) : null;
  }

  getLastHealth(): MbpHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async installOrUpgrade(): Promise<MbpInstallResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const issues: string[] = [];
    const counters = {
      marketingInstalled: 0,
      marketingUpdated: 0,
      brandingInstalled: 0,
      brandingUpdated: 0,
      customerPsychologyInstalled: 0,
      customerPsychologyUpdated: 0,
      salesPsychologyInstalled: 0,
      salesPsychologyUpdated: 0,
      videoMarketingInstalled: 0,
      videoMarketingUpdated: 0,
    };
    let bridgesInstalled = 0;
    let relationshipsCreated = 0;

    const persistGroup = async (
      topics: ProfessionalMbpTopic[],
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

    await persistGroup(PROFESSIONAL_MARKETING_TOPICS, "marketingInstalled", "marketingUpdated", "marketing");
    await persistGroup(PROFESSIONAL_BRANDING_TOPICS, "brandingInstalled", "brandingUpdated", "branding");
    await persistGroup(
      PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
      "customerPsychologyInstalled",
      "customerPsychologyUpdated",
      "customer-psychology"
    );
    await persistGroup(
      PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
      "salesPsychologyInstalled",
      "salesPsychologyUpdated",
      "sales-psychology"
    );
    await persistGroup(
      PROFESSIONAL_VIDEO_MARKETING_TOPICS,
      "videoMarketingInstalled",
      "videoMarketingUpdated",
      "video-marketing"
    );

    for (const bridge of MBP_DOMAIN_BRIDGES) {
      const existing = await foundation.getStorageEngine().getRecord(bridge.knowledgeId, MARKETING_BRANDING_PSYCHOLOGY_SOURCE);
      const payload = {
        step: "knowledge-expansion-marketing-branding-psychology",
        bridgeDomainId: bridge.domainId,
        relationshipAnchor: true,
        createsAdvertisements: false,
        professionalTechniques: [],
        bestPractices: [],
        decisionRules: [`Relate marketing/branding/psychology knowledge to ${bridge.domainId}.`],
        structuredKnowledge: bridgeStructured(bridge.title, bridge.domainId, bridge.description),
      };
      if (existing.success && existing.record) {
        await foundation.getStorageEngine().updateRecord(
          bridge.knowledgeId,
          {
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["marketing-branding-psychology", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "marketing", "branding", "psychology", "relationship"],
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["mkt-marketing-fundamentals"],
            payload,
          },
          MARKETING_BRANDING_PSYCHOLOGY_SOURCE
        );
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: bridge.knowledgeId,
            knowledgeType: KnowledgeStorageType.Marketing,
            category: "mbp-domain-bridge",
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["marketing-branding-psychology", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "marketing", "branding", "psychology", "relationship"],
            source: MARKETING_BRANDING_PSYCHOLOGY_SOURCE,
            sourceReliability: 90,
            confidenceScore: 85,
            qualityScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["mkt-marketing-fundamentals"],
            payload,
          },
          MARKETING_BRANDING_PSYCHOLOGY_SOURCE
        );
        if (write.success) bridgesInstalled += 1;
        else issues.push(`Failed bridge ${bridge.knowledgeId}`);
      }
    }

    const allIds = [...ALL_TOPICS().map((t) => t.knowledgeId), ...MBP_DOMAIN_BRIDGES.map((b) => b.knowledgeId)];
    for (const id of allIds) {
      try {
        foundation.getRetrievalEngine().invalidateCache(id);
        await foundation.getGraphEngine().evolveGraph(id);
      } catch (error) {
        issues.push(`Graph evolve failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const mktHub = "mbp-bridge-marketing-knowledge";
    for (const bridge of MBP_DOMAIN_BRIDGES) {
      if (bridge.knowledgeId === mktHub) continue;
      relationshipsCreated += await this.tryRelate(
        mktHub,
        bridge.knowledgeId,
        KnowledgeRelationType.RelatedTo,
        bridge.relationshipEvidence
      );
    }
    relationshipsCreated += await this.tryRelate(
      mktHub,
      "mbp-bridge-branding-knowledge",
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Marketing and branding co-define campaign meaning."
    );
    relationshipsCreated += await this.tryRelate(
      "mbp-bridge-customer-psychology",
      "mbp-bridge-sales-psychology",
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Customer and sales psychology jointly shape persuasion creative."
    );

    for (const topic of ALL_TOPICS()) {
      for (const related of topic.relatedTopics) {
        const target = getMbpTopic(related)?.knowledgeId;
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
          `mbp-bridge-${domainId}`,
          KnowledgeRelationType.DependsOn,
          `${topic.name} depends on domain ${domainId}.`
        );
      }
    }

    this.relationshipCount = relationshipsCreated;

    let marketingPackSynced = false;
    let brandingPackSynced = false;
    let customerPsychologyPackSynced = false;
    let salesPsychologyPackSynced = false;
    try {
      marketingPackSynced = await this.syncPack(
        "marketing",
        MARKETING_DOMAIN_ID,
        "Professional Marketing & Video Marketing Knowledge Pack",
        [...PROFESSIONAL_MARKETING_TOPICS, ...PROFESSIONAL_VIDEO_MARKETING_TOPICS].map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Marketing pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      brandingPackSynced = await this.syncPack(
        "branding",
        BRANDING_DOMAIN_ID,
        "Professional Branding Knowledge Pack",
        PROFESSIONAL_BRANDING_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Branding pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      customerPsychologyPackSynced = await this.syncPack(
        "customer-psychology",
        CUSTOMER_PSYCHOLOGY_DOMAIN_ID,
        "Professional Customer Psychology Knowledge Pack",
        PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Customer psychology pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      salesPsychologyPackSynced = await this.syncPack(
        "sales-psychology",
        SALES_PSYCHOLOGY_DOMAIN_ID,
        "Professional Sales Psychology Knowledge Pack",
        PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Sales psychology pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let domainsMarkedReady = false;
    try {
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(MARKETING_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(BRANDING_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(CUSTOMER_PSYCHOLOGY_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(SALES_PSYCHOLOGY_DOMAIN_ID, true);
      domainsMarkedReady = true;
    } catch (error) {
      issues.push(`Domain mark ready failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const result: MbpInstallResult = {
      installed:
        countersOk(counters.marketingInstalled, counters.marketingUpdated, PROFESSIONAL_MARKETING_TOPICS.length) &&
        countersOk(counters.brandingInstalled, counters.brandingUpdated, PROFESSIONAL_BRANDING_TOPICS.length) &&
        countersOk(
          counters.customerPsychologyInstalled,
          counters.customerPsychologyUpdated,
          PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.length
        ) &&
        countersOk(
          counters.salesPsychologyInstalled,
          counters.salesPsychologyUpdated,
          PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.length
        ) &&
        countersOk(
          counters.videoMarketingInstalled,
          counters.videoMarketingUpdated,
          PROFESSIONAL_VIDEO_MARKETING_TOPICS.length
        ) &&
        issues.filter((i) => i.startsWith("Failed")).length === 0,
      ...counters,
      bridgesInstalled,
      relationshipsCreated,
      marketingPackSynced,
      brandingPackSynced,
      customerPsychologyPackSynced,
      salesPsychologyPackSynced,
      domainsMarkedReady,
      issues,
    };
    this.lastInstall = result;
    await fs.writeFile(
      path.join(this.metaRoot, "expansion-state.json"),
      `${JSON.stringify(
        {
          version: PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION,
          domainIds: [MARKETING_DOMAIN_ID, BRANDING_DOMAIN_ID, CUSTOMER_PSYCHOLOGY_DOMAIN_ID, SALES_PSYCHOLOGY_DOMAIN_ID],
          installedAt: new Date().toISOString(),
          install: result,
          marketingTopicIds: REQUIRED_MARKETING_TOPIC_IDS,
          brandingTopicIds: REQUIRED_BRANDING_TOPIC_IDS,
          customerPsychologyTopicIds: REQUIRED_CUSTOMER_PSYCHOLOGY_TOPIC_IDS,
          salesPsychologyTopicIds: REQUIRED_SALES_PSYCHOLOGY_TOPIC_IDS,
          videoMarketingTopicIds: REQUIRED_VIDEO_MARKETING_TOPIC_IDS,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    return structuredClone(result);
  }

  recommendMarketingStrategy(query: string): MbpRecommendation {
    return this.recommendFrom(query, [...PROFESSIONAL_MARKETING_TOPICS, ...PROFESSIONAL_VIDEO_MARKETING_TOPICS], "marketing");
  }

  recommendBrandingStrategy(query: string): MbpRecommendation {
    return this.recommendFrom(query, PROFESSIONAL_BRANDING_TOPICS, "branding");
  }

  explainCustomerPsychology(query: string): MbpExplainResult {
    return this.explainFrom(query, PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS, "customer-psychology");
  }

  explainSalesPsychology(query: string): MbpExplainResult {
    return this.explainFrom(query, PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS, "sales-psychology");
  }

  recommendCta(query: string): MbpRecommendation {
    const pool = [
      ...PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.filter((t) =>
        ["cta-strategy", "urgency", "offer-presentation"].includes(t.topicId)
      ),
      ...PROFESSIONAL_VIDEO_MARKETING_TOPICS.filter((t) =>
        ["video-cta-placement", "ending-strategy", "hook-creation"].includes(t.topicId)
      ),
    ];
    return this.recommendFrom(query || "call to action strategy placement", pool, "cta");
  }

  recommendProductPresentation(query: string): MbpRecommendation {
    const pool = [
      ...PROFESSIONAL_VIDEO_MARKETING_TOPICS.filter((t) =>
        ["product-demonstration", "feature-presentation", "benefit-presentation"].includes(t.topicId)
      ),
      ...PROFESSIONAL_MARKETING_TOPICS.filter((t) => t.topicId === "product-marketing"),
      ...PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.filter((t) => t.topicId === "product-perception"),
    ];
    return this.recommendFrom(query || "product demonstration benefits", pool, "product-presentation");
  }

  explain(query: string): MbpExplainResult {
    this.ensureStarted();
    const topic = findMbpTopics(query, ALL_TOPICS())[0];
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        explanation: `No professional marketing/branding/psychology knowledge matches "${query}".`,
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
    if (/cta|call to action|end card|ask viewers/.test(lower)) {
      const rec = this.recommendCta(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getMbpTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/product (demo|presentation|feature|benefit)|demonstrat|show the product/.test(lower)) {
      const rec = this.recommendProductPresentation(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getMbpTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/brand|logo|identity|positioning|brand voice|visual identity/.test(lower)) {
      const rec = this.recommendBrandingStrategy(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getMbpTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/customer|attention|trust|retention|motivation|perception|satisfaction|decision/.test(lower)) {
      const explained = this.explainCustomerPsychology(question);
      if (explained.available && explained.knowledgeId) {
        return {
          available: true,
          answer: `${explained.explanation} Best practice: ${explained.bestPractices[0]}.`,
          knowledgeIds: [explained.knowledgeId],
          confidenceScore: explained.confidenceScore,
        };
      }
    }
    if (/sales|persuasion|scarcity|urgency|social proof|authority|objection|offer|reciprocity|value proposition/.test(lower)) {
      const explained = this.explainSalesPsychology(question);
      if (explained.available && explained.knowledgeId) {
        return {
          available: true,
          answer: `${explained.explanation} Best practice: ${explained.bestPractices[0]}.`,
          knowledgeIds: [explained.knowledgeId],
          confidenceScore: explained.confidenceScore,
        };
      }
    }
    if (/marketing|funnel|campaign|lead|conversion|influencer|performance|content marketing|video marketing|hook|retention/.test(lower)) {
      const rec = this.recommendMarketingStrategy(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getMbpTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    const explained = this.explain(question);
    if (!explained.available || !explained.knowledgeId) {
      return {
        available: false,
        answer: `No validated marketing/branding/psychology knowledge answers "${question}".`,
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

  getAiMeAwareness(): AiMeMbpAwareness {
    this.ensureStarted();
    const all = ALL_TOPICS();
    let marketingDomainReady = false;
    let brandingDomainReady = false;
    let customerPsychologyDomainReady = false;
    let salesPsychologyDomainReady = false;
    try {
      marketingDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(MARKETING_DOMAIN_ID)?.metadata.contentReady === true;
      brandingDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(BRANDING_DOMAIN_ID)?.metadata.contentReady === true;
      customerPsychologyDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(CUSTOMER_PSYCHOLOGY_DOMAIN_ID)?.metadata.contentReady ===
        true;
      salesPsychologyDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(SALES_PSYCHOLOGY_DOMAIN_ID)?.metadata.contentReady === true;
    } catch {
      /* optional */
    }
    return {
      canRecommendMarketingStrategies: true,
      canRecommendBrandingStrategies: true,
      canExplainCustomerPsychology: true,
      canExplainSalesPsychology: true,
      canRecommendCtas: true,
      canRecommendProductPresentation: true,
      canAnswerQuestions: true,
      marketingTopicCount: PROFESSIONAL_MARKETING_TOPICS.length,
      brandingTopicCount: PROFESSIONAL_BRANDING_TOPICS.length,
      customerPsychologyTopicCount: PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.length,
      salesPsychologyTopicCount: PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.length,
      videoMarketingTopicCount: PROFESSIONAL_VIDEO_MARKETING_TOPICS.length,
      relationshipCount: this.relationshipCount,
      averageConfidence: average(all.map((t) => t.confidenceScore)),
      averageQuality: average(all.map((t) => t.qualityScore)),
      marketingDomainReady,
      brandingDomainReady,
      customerPsychologyDomainReady,
      salesPsychologyDomainReady,
      summary:
        `Professional Marketing, Branding & Psychology Knowledge Expansion Step 7 is active with ${PROFESSIONAL_MARKETING_TOPICS.length} marketing, ${PROFESSIONAL_BRANDING_TOPICS.length} branding, ${PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.length} customer psychology, ${PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.length} sales psychology, and ${PROFESSIONAL_VIDEO_MARKETING_TOPICS.length} video marketing topics. ` +
        `AI Me can recommend marketing/branding strategies, explain psychology decisions, recommend CTAs and product presentation, and answer professional marketing questions. ` +
        `Social Media Professional Knowledge specialty expansion is handled in Step 8 (not this installer).`,
    };
  }

  async runHealthCheck(): Promise<MbpHealthReport> {
    this.ensureStarted();
    const missingConcepts: string[] = [];
    const missingMarketingConcepts: string[] = [];
    const missingBrandingConcepts: string[] = [];
    const missingCustomerPsychologyConcepts: string[] = [];
    const missingSalesPsychologyConcepts: string[] = [];
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
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, MARKETING_BRANDING_PSYCHOLOGY_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topic.topicId}:not-persisted`);
    }

    for (const id of [...REQUIRED_MARKETING_TOPIC_IDS, ...REQUIRED_VIDEO_MARKETING_TOPIC_IDS]) {
      if (!getMbpTopic(id)) missingMarketingConcepts.push(id);
    }
    for (const id of REQUIRED_BRANDING_TOPIC_IDS) {
      if (!getMbpTopic(id)) missingBrandingConcepts.push(id);
    }
    for (const id of REQUIRED_CUSTOMER_PSYCHOLOGY_TOPIC_IDS) {
      if (!getMbpTopic(id)) missingCustomerPsychologyConcepts.push(id);
    }
    for (const id of REQUIRED_SALES_PSYCHOLOGY_TOPIC_IDS) {
      if (!getMbpTopic(id)) missingSalesPsychologyConcepts.push(id);
    }

    const seen = new Map<string, string>();
    for (const topic of ALL_TOPICS()) {
      const key = `${topic.metadata.category}:${topic.name.toLowerCase()}`;
      if (seen.has(key)) duplicateKnowledge.push(`${topic.knowledgeId} duplicates ${seen.get(key)}`);
      else seen.set(key, topic.knowledgeId);
      for (const related of topic.relatedTopics) {
        if (!getMbpTopic(related)) brokenRelationships.push(`${topic.topicId}→missing ${related}`);
      }
      for (const domainId of topic.relatedDomains) {
        if (!MBP_DOMAIN_BRIDGES.some((b) => b.domainId === domainId)) {
          brokenRelationships.push(`${topic.topicId}→missing bridge ${domainId}`);
        }
      }
    }

    const completenessScore = Math.max(
      0,
      100 -
        missingConcepts.length * 3 -
        missingMarketingConcepts.length * 2 -
        missingBrandingConcepts.length * 2 -
        missingCustomerPsychologyConcepts.length * 2 -
        missingSalesPsychologyConcepts.length * 2 -
        duplicateKnowledge.length * 8 -
        brokenRelationships.length * 3
    );
    const healthy =
      missingConcepts.length === 0 &&
      missingMarketingConcepts.length === 0 &&
      missingBrandingConcepts.length === 0 &&
      missingCustomerPsychologyConcepts.length === 0 &&
      missingSalesPsychologyConcepts.length === 0 &&
      duplicateKnowledge.length === 0 &&
      brokenRelationships.length === 0;
    if (!healthy) {
      issues.push(...missingConcepts.map((i) => `missing:${i}`));
      issues.push(...missingMarketingConcepts.map((i) => `marketing:${i}`));
      issues.push(...missingBrandingConcepts.map((i) => `branding:${i}`));
      issues.push(...missingCustomerPsychologyConcepts.map((i) => `customer-psychology:${i}`));
      issues.push(...missingSalesPsychologyConcepts.map((i) => `sales-psychology:${i}`));
      issues.push(...duplicateKnowledge.map((i) => `duplicate:${i}`));
      issues.push(...brokenRelationships.map((i) => `relationship:${i}`));
    }

    this.lastHealth = {
      healthy,
      completenessScore,
      missingConcepts,
      missingMarketingConcepts,
      missingBrandingConcepts,
      missingCustomerPsychologyConcepts,
      missingSalesPsychologyConcepts,
      duplicateKnowledge,
      brokenRelationships,
      issues,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<MbpRepairResult> {
    this.ensureStarted();
    const actions: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured professional-marketing-branding-psychology directory.");
    const before = await this.runHealthCheck();
    if (!before.healthy) {
      const reinstall = await this.installOrUpgrade();
      actions.push(
        `Reinstalled/upgraded (mkt ${reinstall.marketingInstalled}/${reinstall.marketingUpdated}; brand ${reinstall.brandingInstalled}/${reinstall.brandingUpdated}; cust ${reinstall.customerPsychologyInstalled}/${reinstall.customerPsychologyUpdated}; sales ${reinstall.salesPsychologyInstalled}/${reinstall.salesPsychologyUpdated}; vmkt ${reinstall.videoMarketingInstalled}/${reinstall.videoMarketingUpdated}; rel=${reinstall.relationshipsCreated}).`
      );
      if (reinstall.marketingPackSynced) actions.push("Synced marketing pack.");
      if (reinstall.brandingPackSynced) actions.push("Synced branding pack.");
      if (reinstall.customerPsychologyPackSynced) actions.push("Synced customer-psychology pack.");
      if (reinstall.salesPsychologyPackSynced) actions.push("Synced sales-psychology pack.");
      if (reinstall.domainsMarkedReady) actions.push("Marked marketing/branding/psychology domains contentReady.");
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
    pool: ProfessionalMbpTopic[],
    kind: MbpRecommendation["kind"]
  ): MbpRecommendation {
    this.ensureStarted();
    const matches = findMbpTopics(query, pool);
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
    pool: ProfessionalMbpTopic[],
    kind: MbpExplainResult["kind"]
  ): MbpExplainResult {
    this.ensureStarted();
    const topic = findMbpTopics(query, pool)[0];
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

  private async persistTopic(topic: ProfessionalMbpTopic): Promise<"installed" | "updated" | "failed"> {
    const foundation = this.foundation!;
    const relatedKnowledge = unique([
      ...topic.relatedTopics.map((id) => getMbpTopic(id)?.knowledgeId ?? id),
      ...topic.relatedDomains.map((id) => `mbp-bridge-${id}`),
    ]).filter((id) => id !== topic.knowledgeId);
    const payload = {
      step: "knowledge-expansion-marketing-branding-psychology",
      expansionVersion: PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION,
      topicId: topic.topicId,
      kind: topic.metadata.category,
      purpose: topic.purpose,
      professionalDefinition: topic.professionalDefinition,
      workflow: topic.workflow,
      knowledgeItem: topicToItem(topic),
      structuredKnowledge: topicToStructured(topic),
      metadata: topic.metadata,
      createsAdvertisements: false,
      professionalTechniques: topic.bestPractices,
      bestPractices: topic.bestPractices,
      decisionRules: topic.bestPractices.map((b) => `Practice: ${b}`),
    };
    const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, MARKETING_BRANDING_PSYCHOLOGY_SOURCE);
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
        MARKETING_BRANDING_PSYCHOLOGY_SOURCE
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
        source: MARKETING_BRANDING_PSYCHOLOGY_SOURCE,
        sourceReliability: 95,
        confidenceScore: topic.confidenceScore,
        qualityScore: topic.qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge,
        payload,
      },
      MARKETING_BRANDING_PSYCHOLOGY_SOURCE
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
      resourceIds: existing?.resourceIds ?? ["professional-marketing-branding-psychology-expansion"],
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
      throw new ProfessionalMbpError(
        "Professional Marketing/Branding/Psychology Knowledge is not initialized",
        "NOT_INITIALIZED"
      );
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalMbpError(
        "Professional Marketing/Branding/Psychology Knowledge startup is incomplete",
        "NOT_STARTED"
      );
    }
  }
}

function countersOk(installed: number, updated: number, expected: number): boolean {
  return installed + updated >= expected;
}

function kindOf(topic: ProfessionalMbpTopic): MbpExplainResult["kind"] {
  switch (topic.metadata.category) {
    case "professional-marketing":
      return "marketing";
    case "professional-branding":
      return "branding";
    case "professional-customer-psychology":
      return "customer-psychology";
    case "professional-sales-psychology":
      return "sales-psychology";
    case "professional-video-marketing":
      return "video-marketing";
    default:
      return "none";
  }
}

function topicToItem(topic: ProfessionalMbpTopic): KnowledgeItem {
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
        name: "KWIZERA Professional Marketing/Branding/Psychology Expansion",
        type: "curated-professional",
        reference: `expansion-step-7:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function topicToStructured(topic: ProfessionalMbpTopic): StructuredKnowledge {
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
    relatedKnowledge: topic.relatedTopics.map((id) => getMbpTopic(id)?.knowledgeId ?? id),
    definitions: [topic.professionalDefinition, topic.purpose],
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Marketing/Branding/Psychology Expansion",
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
    decisionRules: [`Relate marketing/branding/psychology knowledge to ${domain}.`],
    workflowSteps: [],
    prerequisites: [],
    dependencies: [],
    relatedKnowledge: ["mkt-marketing-fundamentals"],
    difficultyLevel: "foundation",
    confidenceScore: 85,
    sourceMetadata: [
      { name: "KWIZERA Professional Marketing/Branding/Psychology Expansion", type: "curated", reliability: 95 },
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
    category: "professional-marketing",
    domain,
    description: "Curated professional marketing/branding/psychology knowledge for AI Me (does not create ads automatically).",
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
    prerequisites: ["Define audience and offer before selecting marketing tactics."],
    dependencies: ["storytelling-knowledge", "product-knowledge", "social-media-knowledge"],
    relatedKnowledge: items.map((i) => i.knowledgeId),
    difficultyLevel: "advanced",
    confidenceScore: average(items.map((i) => i.confidenceScore)),
    sourceMetadata: [
      {
        name: "KWIZERA Professional Marketing/Branding/Psychology Expansion",
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
