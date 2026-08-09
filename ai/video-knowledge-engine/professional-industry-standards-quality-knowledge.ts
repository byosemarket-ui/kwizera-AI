/**
 * Industry Best Practices, Professional Standards & Quality Rules — Expansion Step 9 installer.
 * Offline-first curated guidance. Does not generate media or certify work automatically.
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
  findIsqTopics,
  getAllIsqTopics,
  getIsqTopic,
  ISQ_DOMAIN_BRIDGES,
  PROFESSIONAL_BEST_PRACTICES_TOPICS,
  PROFESSIONAL_CHECKLIST_TOPICS,
  PROFESSIONAL_QUALITY_EVALUATION_TOPICS,
  PROFESSIONAL_QUALITY_RULES_TOPICS,
  PROFESSIONAL_STANDARDS_TOPICS,
  REQUIRED_BEST_PRACTICES_TOPIC_IDS,
  REQUIRED_PROFESSIONAL_CHECKLIST_TOPIC_IDS,
  REQUIRED_PROFESSIONAL_STANDARDS_TOPIC_IDS,
  REQUIRED_QUALITY_EVALUATION_TOPIC_IDS,
  REQUIRED_QUALITY_RULES_TOPIC_IDS,
} from "./professional-industry-standards-quality-catalog.js";
import {
  INDUSTRY_STANDARDS_DOMAIN_ID,
  INDUSTRY_STANDARDS_QUALITY_SOURCE,
  PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION,
  ProfessionalIndustryStandardsQualityError,
  type AiMeIndustryStandardsAwareness,
  type IsqExplainResult,
  type IsqHealthReport,
  type IsqInstallResult,
  type IsqQualityEvaluation,
  type IsqRecommendation,
  type IsqRepairResult,
  type ProfessionalIsqTopic,
} from "./professional-industry-standards-quality-types.js";

const ALL_TOPICS = () => getAllIsqTopics();
const INDUSTRY_HUB_BRIDGE = "isq-bridge-industry-standards-knowledge";
const STANDARDS_ANCHOR = "std-industry-standards";

export class ProfessionalIndustryStandardsQualityKnowledge {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private lastInstall: IsqInstallResult | null = null;
  private lastHealth: IsqHealthReport | null = null;
  private lastRepair: IsqRepairResult | null = null;
  private relationshipCount = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "videos", "professional-industry-standards-quality");
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

  listStandardsTopics(): ProfessionalIsqTopic[] {
    return PROFESSIONAL_STANDARDS_TOPICS.map((topic) => structuredClone(topic));
  }

  listQualityRulesTopics(): ProfessionalIsqTopic[] {
    return PROFESSIONAL_QUALITY_RULES_TOPICS.map((topic) => structuredClone(topic));
  }

  listBestPracticesTopics(): ProfessionalIsqTopic[] {
    return PROFESSIONAL_BEST_PRACTICES_TOPICS.map((topic) => structuredClone(topic));
  }

  listQualityEvaluationTopics(): ProfessionalIsqTopic[] {
    return PROFESSIONAL_QUALITY_EVALUATION_TOPICS.map((topic) => structuredClone(topic));
  }

  listChecklistTopics(): ProfessionalIsqTopic[] {
    return PROFESSIONAL_CHECKLIST_TOPICS.map((topic) => structuredClone(topic));
  }

  getLastInstall(): IsqInstallResult | null {
    return this.lastInstall ? structuredClone(this.lastInstall) : null;
  }

  getLastHealth(): IsqHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async installOrUpgrade(): Promise<IsqInstallResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const issues: string[] = [];
    const counters = {
      standardsInstalled: 0,
      standardsUpdated: 0,
      qualityRulesInstalled: 0,
      qualityRulesUpdated: 0,
      bestPracticesInstalled: 0,
      bestPracticesUpdated: 0,
      qualityEvaluationInstalled: 0,
      qualityEvaluationUpdated: 0,
      checklistsInstalled: 0,
      checklistsUpdated: 0,
    };
    let bridgesInstalled = 0;
    let relationshipsCreated = 0;

    const persistGroup = async (
      topics: ProfessionalIsqTopic[],
      installedKey: keyof typeof counters,
      updatedKey: keyof typeof counters,
      label: string
    ) => {
      for (const topic of topics) {
        const persisted = await this.persistTopic(topic);
        if (persisted === "installed") counters[installedKey] += 1;
        else if (persisted === "updated") counters[updatedKey] += 1;
        else issues.push(`Failed ${label} ${topic.knowledgeId}`);
      }
    };

    await persistGroup(PROFESSIONAL_STANDARDS_TOPICS, "standardsInstalled", "standardsUpdated", "standards");
    await persistGroup(
      PROFESSIONAL_QUALITY_RULES_TOPICS,
      "qualityRulesInstalled",
      "qualityRulesUpdated",
      "quality-rules"
    );
    await persistGroup(
      PROFESSIONAL_BEST_PRACTICES_TOPICS,
      "bestPracticesInstalled",
      "bestPracticesUpdated",
      "best-practices"
    );
    await persistGroup(
      PROFESSIONAL_QUALITY_EVALUATION_TOPICS,
      "qualityEvaluationInstalled",
      "qualityEvaluationUpdated",
      "quality-evaluation"
    );
    await persistGroup(PROFESSIONAL_CHECKLIST_TOPICS, "checklistsInstalled", "checklistsUpdated", "checklists");

    for (const bridge of ISQ_DOMAIN_BRIDGES) {
      const existing = await foundation.getStorageEngine().getRecord(
        bridge.knowledgeId,
        INDUSTRY_STANDARDS_QUALITY_SOURCE
      );
      const payload = {
        step: "knowledge-expansion-industry-standards-quality",
        bridgeDomainId: bridge.domainId,
        relationshipAnchor: true,
        generatesMedia: false,
        certifiesKnowledge: false,
        professionalTechniques: [],
        bestPractices: [],
        qualityRules: [],
        decisionRules: [`Relate industry standards and quality knowledge to ${bridge.domainId}.`],
        structuredKnowledge: bridgeStructured(bridge.title, bridge.domainId, bridge.description),
      };

      if (existing.success && existing.record) {
        const write = await foundation.getStorageEngine().updateRecord(
          bridge.knowledgeId,
          {
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["industry-standards", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "industry", "standards", "quality", "relationship"],
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: [STANDARDS_ANCHOR],
            payload,
          },
          INDUSTRY_STANDARDS_QUALITY_SOURCE
        );
        if (!write.success) issues.push(`Failed bridge ${bridge.knowledgeId}`);
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: bridge.knowledgeId,
            knowledgeType: KnowledgeStorageType.Industry,
            category: "isq-domain-bridge",
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["industry-standards", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "industry", "standards", "quality", "relationship"],
            source: INDUSTRY_STANDARDS_QUALITY_SOURCE,
            sourceReliability: 90,
            confidenceScore: 85,
            qualityScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: [STANDARDS_ANCHOR],
            payload,
          },
          INDUSTRY_STANDARDS_QUALITY_SOURCE
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
          KnowledgeNodeType.Industry,
          topic.name,
          `${topic.name} ${topic.description} ${topic.keywords.join(" ")}`
        );
      } catch (error) {
        issues.push(`Graph node creation failed for ${topic.knowledgeId}: ${errorMessage(error)}`);
      }
    }
    for (const bridge of ISQ_DOMAIN_BRIDGES) {
      try {
        foundation.getRetrievalEngine().invalidateCache(bridge.knowledgeId);
        foundation.getGraphEngine().createNode(
          bridge.knowledgeId,
          KnowledgeNodeType.Industry,
          bridge.title,
          `${bridge.title} ${bridge.description} ${bridge.domainId}`
        );
      } catch (error) {
        issues.push(`Graph node creation failed for ${bridge.knowledgeId}: ${errorMessage(error)}`);
      }
    }

    for (const bridge of ISQ_DOMAIN_BRIDGES) {
      if (bridge.knowledgeId === INDUSTRY_HUB_BRIDGE) continue;
      relationshipsCreated += this.tryRelate(
        INDUSTRY_HUB_BRIDGE,
        bridge.knowledgeId,
        KnowledgeRelationType.RelatedTo,
        bridge.relationshipEvidence
      );
    }
    relationshipsCreated += this.tryRelate(
      INDUSTRY_HUB_BRIDGE,
      "isq-bridge-video-production-knowledge",
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Professional standards are applied through production workflows."
    );
    relationshipsCreated += this.tryRelate(
      "isq-bridge-marketing-knowledge",
      "isq-bridge-branding-knowledge",
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Marketing and branding quality must be reviewed together."
    );

    for (const topic of ALL_TOPICS()) {
      for (const relatedTopicId of topic.relatedTopics) {
        const target = getIsqTopic(relatedTopicId)?.knowledgeId;
        if (!target) continue;
        relationshipsCreated += this.tryRelate(
          topic.knowledgeId,
          target,
          KnowledgeRelationType.RelatedTo,
          `${topic.name} relates to ${relatedTopicId}.`
        );
      }
      for (const domainId of topic.relatedDomains) {
        relationshipsCreated += this.tryRelate(
          topic.knowledgeId,
          `isq-bridge-${domainId}`,
          KnowledgeRelationType.DependsOn,
          `${topic.name} depends on quality guidance from ${domainId}.`
        );
      }
    }
    this.relationshipCount = relationshipsCreated;

    let industryStandardsPackSynced = false;
    try {
      industryStandardsPackSynced = await this.syncPack(
        "industry-standards",
        INDUSTRY_STANDARDS_DOMAIN_ID,
        "Industry Standards & Professional Quality Knowledge Pack",
        ALL_TOPICS().map((topic) => topicToItem(topic))
      );
    } catch (error) {
      issues.push(`Industry standards pack sync failed: ${errorMessage(error)}`);
    }

    let domainMarkedReady = false;
    try {
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(INDUSTRY_STANDARDS_DOMAIN_ID, true);
      domainMarkedReady = true;
    } catch (error) {
      issues.push(`Industry standards domain mark ready failed: ${errorMessage(error)}`);
    }

    const result: IsqInstallResult = {
      installed:
        countersOk(counters.standardsInstalled, counters.standardsUpdated, PROFESSIONAL_STANDARDS_TOPICS.length) &&
        countersOk(
          counters.qualityRulesInstalled,
          counters.qualityRulesUpdated,
          PROFESSIONAL_QUALITY_RULES_TOPICS.length
        ) &&
        countersOk(
          counters.bestPracticesInstalled,
          counters.bestPracticesUpdated,
          PROFESSIONAL_BEST_PRACTICES_TOPICS.length
        ) &&
        countersOk(
          counters.qualityEvaluationInstalled,
          counters.qualityEvaluationUpdated,
          PROFESSIONAL_QUALITY_EVALUATION_TOPICS.length
        ) &&
        countersOk(counters.checklistsInstalled, counters.checklistsUpdated, PROFESSIONAL_CHECKLIST_TOPICS.length) &&
        issues.filter((issue) => issue.startsWith("Failed")).length === 0,
      ...counters,
      bridgesInstalled,
      relationshipsCreated,
      industryStandardsPackSynced,
      domainMarkedReady,
      issues,
    };
    this.lastInstall = result;

    await fs.writeFile(
      path.join(this.metaRoot, "expansion-state.json"),
      `${JSON.stringify(
        {
          version: PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION,
          domainId: INDUSTRY_STANDARDS_DOMAIN_ID,
          installedAt: new Date().toISOString(),
          install: result,
          standardsTopicIds: REQUIRED_PROFESSIONAL_STANDARDS_TOPIC_IDS,
          qualityRulesTopicIds: REQUIRED_QUALITY_RULES_TOPIC_IDS,
          bestPracticesTopicIds: REQUIRED_BEST_PRACTICES_TOPIC_IDS,
          qualityEvaluationTopicIds: REQUIRED_QUALITY_EVALUATION_TOPIC_IDS,
          checklistTopicIds: REQUIRED_PROFESSIONAL_CHECKLIST_TOPIC_IDS,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    return structuredClone(result);
  }

  evaluateProfessionalQuality(query: string): IsqQualityEvaluation {
    this.ensureStarted();
    const pool = [
      ...PROFESSIONAL_QUALITY_RULES_TOPICS,
      ...PROFESSIONAL_QUALITY_EVALUATION_TOPICS,
      ...PROFESSIONAL_CHECKLIST_TOPICS,
    ];
    const topic = findIsqTopics(query || "professional quality review", pool)[0];
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        scope: "No matching professional quality guidance.",
        evaluationCriteria: [],
        detectedRisks: [],
        recommendedImprovements: [],
        confidenceScore: 0,
        qualityScore: 0,
        kind: "none",
      };
    }
    return {
      available: true,
      knowledgeId: topic.knowledgeId,
      title: topic.name,
      scope:
        `Rule-based quality guidance for "${query}". It explains review criteria; actual media inspection remains with the applicable quality validation engine.`,
      evaluationCriteria: topic.qualityRules,
      detectedRisks: topic.commonMistakes,
      recommendedImprovements: topic.bestPractices,
      confidenceScore: topic.confidenceScore,
      qualityScore: topic.qualityScore,
      kind: qualityEvaluationKind(topic),
    };
  }

  recommendImprovement(query: string): IsqRecommendation {
    const pool = [...PROFESSIONAL_BEST_PRACTICES_TOPICS, ...PROFESSIONAL_QUALITY_RULES_TOPICS];
    return this.recommendFrom(query || "professional quality improvement", pool, "best-practices");
  }

  detectQualityProblems(query: string): IsqQualityEvaluation {
    return this.evaluateProfessionalQuality(query);
  }

  explainIndustryStandard(query: string): IsqExplainResult {
    return this.explainFrom(query, PROFESSIONAL_STANDARDS_TOPICS, "standards");
  }

  recommendBestPractices(query: string): IsqRecommendation {
    return this.recommendFrom(query || "professional best practices", PROFESSIONAL_BEST_PRACTICES_TOPICS, "best-practices");
  }

  recommendChecklist(query: string): IsqRecommendation {
    return this.recommendFrom(query || "quality review checklist", PROFESSIONAL_CHECKLIST_TOPICS, "checklist");
  }

  explain(query: string): IsqExplainResult {
    this.ensureStarted();
    const topic = findIsqTopics(query, ALL_TOPICS())[0];
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        explanation: `No professional industry standards or quality knowledge matches "${query}".`,
        bestPractices: [],
        qualityRules: [],
        confidenceScore: 0,
        qualityScore: 0,
        kind: "none",
      };
    }
    return this.explainTopic(topic);
  }

  answer(question: string): { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } {
    this.ensureStarted();
    const lower = question.toLowerCase();
    if (/quality|evaluate|evaluation|defect|problem|issue|qc|quality rule/.test(lower)) {
      const result = this.evaluateProfessionalQuality(question);
      if (result.available && result.knowledgeId) {
        return {
          available: true,
          answer: `${result.scope} Criteria: ${result.evaluationCriteria.slice(0, 2).join("; ")}. Improvement: ${result.recommendedImprovements[0] ?? "Use the matching quality checklist."}`,
          knowledgeIds: [result.knowledgeId],
          confidenceScore: result.confidenceScore,
        };
      }
    }
    if (/checklist|pre-production|post-production|publishing|final approval|sign-off/.test(lower)) {
      const recommendation = this.recommendChecklist(question);
      if (recommendation.available && recommendation.topicId) {
        return {
          available: true,
          answer: `${recommendation.reason} First control: ${recommendation.qualityRules[0]}.`,
          knowledgeIds: [getIsqTopic(recommendation.topicId)!.knowledgeId],
          confidenceScore: recommendation.confidenceScore,
        };
      }
    }
    if (/standard|approval|review process|delivery|workflow/.test(lower)) {
      const explained = this.explainIndustryStandard(question);
      if (explained.available && explained.knowledgeId) {
        return {
          available: true,
          answer: `${explained.explanation} Quality rule: ${explained.qualityRules[0]}.`,
          knowledgeIds: [explained.knowledgeId],
          confidenceScore: explained.confidenceScore,
        };
      }
    }
    if (/best practice|improve|improvement|optimi[sz]|planning|production|editing|render/.test(lower)) {
      const recommendation = this.recommendImprovement(question);
      if (recommendation.available && recommendation.topicId) {
        return {
          available: true,
          answer: `${recommendation.reason} Best practice: ${recommendation.bestPractices[0]}.`,
          knowledgeIds: [getIsqTopic(recommendation.topicId)!.knowledgeId],
          confidenceScore: recommendation.confidenceScore,
        };
      }
    }
    const explained = this.explain(question);
    if (!explained.available || !explained.knowledgeId) {
      return {
        available: false,
        answer: `No validated industry standards or professional quality knowledge answers "${question}".`,
        knowledgeIds: [],
        confidenceScore: 0,
      };
    }
    return {
      available: true,
      answer: `${explained.explanation} Best practice: ${explained.bestPractices[0] ?? "Use the documented review criteria."}`,
      knowledgeIds: [explained.knowledgeId],
      confidenceScore: explained.confidenceScore,
    };
  }

  getAiMeAwareness(): AiMeIndustryStandardsAwareness {
    this.ensureStarted();
    const all = ALL_TOPICS();
    let industryStandardsDomainReady = false;
    try {
      industryStandardsDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(INDUSTRY_STANDARDS_DOMAIN_ID)?.metadata.contentReady ===
        true;
    } catch {
      /* optional */
    }
    return {
      canEvaluateProfessionalQuality: true,
      canRecommendImprovements: true,
      canDetectQualityProblems: true,
      canExplainIndustryStandards: true,
      canRecommendBestPractices: true,
      canAnswerProfessionalQualityQuestions: true,
      standardsTopicCount: PROFESSIONAL_STANDARDS_TOPICS.length,
      qualityRulesTopicCount: PROFESSIONAL_QUALITY_RULES_TOPICS.length,
      bestPracticesTopicCount: PROFESSIONAL_BEST_PRACTICES_TOPICS.length,
      qualityEvaluationTopicCount: PROFESSIONAL_QUALITY_EVALUATION_TOPICS.length,
      checklistTopicCount: PROFESSIONAL_CHECKLIST_TOPICS.length,
      relationshipCount: this.relationshipCount,
      averageConfidence: average(all.map((topic) => topic.confidenceScore)),
      averageQuality: average(all.map((topic) => topic.qualityScore)),
      industryStandardsDomainReady,
      summary:
        `Industry Best Practices, Professional Standards & Quality Rules Expansion Step 9 is active with ${PROFESSIONAL_STANDARDS_TOPICS.length} standards, ${PROFESSIONAL_QUALITY_RULES_TOPICS.length} quality rules, ${PROFESSIONAL_BEST_PRACTICES_TOPICS.length} best-practice, ${PROFESSIONAL_QUALITY_EVALUATION_TOPICS.length} evaluation, and ${PROFESSIONAL_CHECKLIST_TOPICS.length} checklist topics. ` +
        `AI Me can explain standards, provide rule-based quality guidance, identify likely quality risks, recommend improvements and checklists, and answer professional quality questions. ` +
        `This knowledge does not generate media or certify work automatically. The Step 10 Professional Knowledge Certification expansion has not started.`,
    };
  }

  async runHealthCheck(): Promise<IsqHealthReport> {
    this.ensureStarted();
    const missingConcepts: string[] = [];
    const missingStandardsConcepts: string[] = [];
    const missingQualityRulesConcepts: string[] = [];
    const missingBestPracticesConcepts: string[] = [];
    const missingQualityEvaluationConcepts: string[] = [];
    const missingChecklistConcepts: string[] = [];
    const duplicateKnowledge: string[] = [];
    const brokenRelationships: string[] = [];
    const issues: string[] = [];
    const foundation = this.foundation!;

    for (const topic of ALL_TOPICS()) {
      for (const field of ["name", "description", "purpose", "professionalDefinition"] as const) {
        if (!topic[field]?.trim()) missingConcepts.push(`${topic.topicId}:${field}`);
      }
      for (const field of [
        "bestPractices",
        "commonMistakes",
        "qualityRules",
        "workflow",
        "professionalExamples",
        "keywords",
        "relatedTopics",
      ] as const) {
        if (!topic[field].length) missingConcepts.push(`${topic.topicId}:${field}`);
      }
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, INDUSTRY_STANDARDS_QUALITY_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topic.topicId}:not-persisted`);
    }

    for (const topicId of REQUIRED_PROFESSIONAL_STANDARDS_TOPIC_IDS) {
      if (!getIsqTopic(topicId)) missingStandardsConcepts.push(topicId);
    }
    for (const topicId of REQUIRED_QUALITY_RULES_TOPIC_IDS) {
      if (!getIsqTopic(topicId)) missingQualityRulesConcepts.push(topicId);
    }
    for (const topicId of REQUIRED_BEST_PRACTICES_TOPIC_IDS) {
      if (!getIsqTopic(topicId)) missingBestPracticesConcepts.push(topicId);
    }
    for (const topicId of REQUIRED_QUALITY_EVALUATION_TOPIC_IDS) {
      if (!getIsqTopic(topicId)) missingQualityEvaluationConcepts.push(topicId);
    }
    for (const topicId of REQUIRED_PROFESSIONAL_CHECKLIST_TOPIC_IDS) {
      if (!getIsqTopic(topicId)) missingChecklistConcepts.push(topicId);
    }

    const seen = new Map<string, string>();
    for (const topic of ALL_TOPICS()) {
      const key = topic.name.trim().toLowerCase();
      if (seen.has(key)) duplicateKnowledge.push(`${topic.knowledgeId} duplicates ${seen.get(key)}`);
      else seen.set(key, topic.knowledgeId);
      for (const relatedTopicId of topic.relatedTopics) {
        if (relatedTopicId === topic.topicId || !getIsqTopic(relatedTopicId)) {
          brokenRelationships.push(`${topic.topicId}→missing or self ${relatedTopicId}`);
        }
      }
      for (const domainId of topic.relatedDomains) {
        if (!ISQ_DOMAIN_BRIDGES.some((bridge) => bridge.domainId === domainId)) {
          brokenRelationships.push(`${topic.topicId}→missing bridge ${domainId}`);
        }
      }
    }

    const completenessScore = Math.max(
      0,
      100 -
        missingConcepts.length * 3 -
        missingStandardsConcepts.length * 2 -
        missingQualityRulesConcepts.length * 2 -
        missingBestPracticesConcepts.length * 2 -
        missingQualityEvaluationConcepts.length * 2 -
        missingChecklistConcepts.length * 2 -
        duplicateKnowledge.length * 8 -
        brokenRelationships.length * 3
    );
    const healthy =
      missingConcepts.length === 0 &&
      missingStandardsConcepts.length === 0 &&
      missingQualityRulesConcepts.length === 0 &&
      missingBestPracticesConcepts.length === 0 &&
      missingQualityEvaluationConcepts.length === 0 &&
      missingChecklistConcepts.length === 0 &&
      duplicateKnowledge.length === 0 &&
      brokenRelationships.length === 0;
    if (!healthy) {
      issues.push(...missingConcepts.map((issue) => `missing:${issue}`));
      issues.push(...missingStandardsConcepts.map((issue) => `standards:${issue}`));
      issues.push(...missingQualityRulesConcepts.map((issue) => `quality-rules:${issue}`));
      issues.push(...missingBestPracticesConcepts.map((issue) => `best-practices:${issue}`));
      issues.push(...missingQualityEvaluationConcepts.map((issue) => `quality-evaluation:${issue}`));
      issues.push(...missingChecklistConcepts.map((issue) => `checklist:${issue}`));
      issues.push(...duplicateKnowledge.map((issue) => `duplicate:${issue}`));
      issues.push(...brokenRelationships.map((issue) => `relationship:${issue}`));
    }

    this.lastHealth = {
      healthy,
      completenessScore,
      missingConcepts,
      missingStandardsConcepts,
      missingQualityRulesConcepts,
      missingBestPracticesConcepts,
      missingQualityEvaluationConcepts,
      missingChecklistConcepts,
      duplicateKnowledge,
      brokenRelationships,
      issues,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<IsqRepairResult> {
    this.ensureStarted();
    const actions: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured professional-industry-standards-quality directory.");
    const before = await this.runHealthCheck();
    if (!before.healthy) {
      const reinstall = await this.installOrUpgrade();
      actions.push(
        `Reinstalled/upgraded (standards ${reinstall.standardsInstalled}/${reinstall.standardsUpdated}; rules ${reinstall.qualityRulesInstalled}/${reinstall.qualityRulesUpdated}; practices ${reinstall.bestPracticesInstalled}/${reinstall.bestPracticesUpdated}; evaluations ${reinstall.qualityEvaluationInstalled}/${reinstall.qualityEvaluationUpdated}; checklists ${reinstall.checklistsInstalled}/${reinstall.checklistsUpdated}; rel=${reinstall.relationshipsCreated}).`
      );
      if (reinstall.industryStandardsPackSynced) actions.push("Synced industry-standards pack.");
      if (reinstall.domainMarkedReady) actions.push("Marked industry-standards-knowledge contentReady.");
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
    pool: ProfessionalIsqTopic[],
    kind: IsqRecommendation["kind"]
  ): IsqRecommendation {
    this.ensureStarted();
    const matches = findIsqTopics(query, pool);
    const primary = matches[0];
    if (!primary) {
      return {
        available: false,
        topicId: null,
        name: query,
        reason: `No ${kind} guidance matches "${query}".`,
        bestPractices: [],
        qualityRules: [],
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
      qualityRules: primary.qualityRules,
      workflow: primary.workflow,
      confidenceScore: primary.confidenceScore,
      alternatives: matches.slice(1, 3).map((topic) => ({ name: topic.name, reason: topic.purpose })),
      kind,
    };
  }

  private explainFrom(
    query: string,
    pool: ProfessionalIsqTopic[],
    kind: IsqExplainResult["kind"]
  ): IsqExplainResult {
    this.ensureStarted();
    const topic = findIsqTopics(query, pool)[0];
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        explanation: `No ${kind} guidance matches "${query}".`,
        bestPractices: [],
        qualityRules: [],
        confidenceScore: 0,
        qualityScore: 0,
        kind: "none",
      };
    }
    return this.explainTopic(topic);
  }

  private explainTopic(topic: ProfessionalIsqTopic): IsqExplainResult {
    return {
      available: true,
      knowledgeId: topic.knowledgeId,
      title: topic.name,
      explanation: `${topic.professionalDefinition} Purpose: ${topic.purpose}`,
      bestPractices: topic.bestPractices,
      qualityRules: topic.qualityRules,
      confidenceScore: topic.confidenceScore,
      qualityScore: topic.qualityScore,
      kind: kindOf(topic),
    };
  }

  private async persistTopic(topic: ProfessionalIsqTopic): Promise<"installed" | "updated" | "failed"> {
    const foundation = this.foundation!;
    const relatedKnowledge = unique([
      ...topic.relatedTopics.map((topicId) => getIsqTopic(topicId)?.knowledgeId ?? topicId),
      ...topic.relatedDomains.map((domainId) => `isq-bridge-${domainId}`),
    ]).filter((knowledgeId) => knowledgeId !== topic.knowledgeId);
    const payload = {
      step: "knowledge-expansion-industry-standards-quality",
      expansionVersion: PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION,
      topicId: topic.topicId,
      kind: topic.metadata.category,
      purpose: topic.purpose,
      professionalDefinition: topic.professionalDefinition,
      qualityRules: topic.qualityRules,
      workflow: topic.workflow,
      knowledgeItem: topicToItem(topic),
      structuredKnowledge: topicToStructured(topic),
      metadata: topic.metadata,
      generatesMedia: false,
      certifiesKnowledge: false,
      professionalTechniques: topic.bestPractices,
      bestPractices: topic.bestPractices,
      decisionRules: topic.qualityRules.map((rule) => `Quality rule: ${rule}`),
    };
    const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, INDUSTRY_STANDARDS_QUALITY_SOURCE);
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
        INDUSTRY_STANDARDS_QUALITY_SOURCE
      );
      return write.success ? "updated" : "failed";
    }
    const write = await foundation.getStorageEngine().storeRecord(
      {
        knowledgeId: topic.knowledgeId,
        knowledgeType: KnowledgeStorageType.Industry,
        category: topic.metadata.category,
        title: topic.name,
        description: topic.description,
        summary: topic.purpose,
        tags: unique([topic.metadata.category, "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
        keywords: topic.keywords,
        source: INDUSTRY_STANDARDS_QUALITY_SOURCE,
        sourceReliability: 95,
        confidenceScore: topic.confidenceScore,
        qualityScore: topic.qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge,
        payload,
      },
      INDUSTRY_STANDARDS_QUALITY_SOURCE
    );
    return write.success ? "installed" : "failed";
  }

  private tryRelate(
    sourceId: string,
    targetId: string,
    relationshipType: KnowledgeRelationType,
    evidence: string
  ): number {
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
      resourceIds: existing?.resourceIds ?? ["professional-industry-standards-quality-expansion"],
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
      throw new ProfessionalIndustryStandardsQualityError(
        "Industry Standards & Quality Knowledge is not initialized",
        "NOT_INITIALIZED"
      );
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalIndustryStandardsQualityError(
        "Industry Standards & Quality Knowledge startup is incomplete",
        "NOT_STARTED"
      );
    }
  }
}

function countersOk(installed: number, updated: number, expected: number): boolean {
  return installed + updated >= expected;
}

function kindOf(topic: ProfessionalIsqTopic): IsqExplainResult["kind"] {
  switch (topic.metadata.category) {
    case "professional-industry-standards":
      return "standards";
    case "professional-quality-rules":
      return "quality-rules";
    case "professional-best-practices":
      return "best-practices";
    case "professional-quality-evaluation":
      return "evaluation";
    case "professional-checklists":
      return "checklist";
  }
}

function qualityEvaluationKind(topic: ProfessionalIsqTopic): IsqQualityEvaluation["kind"] {
  switch (topic.metadata.category) {
    case "professional-quality-rules":
      return "quality-rules";
    case "professional-quality-evaluation":
      return "evaluation";
    case "professional-checklists":
      return "checklist";
    default:
      return "none";
  }
}

function topicToItem(topic: ProfessionalIsqTopic): KnowledgeItem {
  return {
    knowledgeId: topic.knowledgeId,
    title: topic.name,
    domain: topic.metadata.domainId,
    category: topic.metadata.category,
    description: topic.description,
    coreConcepts: topic.keywords.slice(0, 8),
    definitions: [topic.professionalDefinition, topic.purpose],
    rules: topic.qualityRules.map((rule) => `Quality rule: ${rule}`),
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.workflow,
    workflow: topic.workflow,
    decisionRules: topic.qualityRules.map((rule) => `Apply: ${rule}`),
    commonMistakes: topic.commonMistakes,
    troubleshooting: topic.commonMistakes.map((mistake) => `Avoid: ${mistake}`),
    recommendations: topic.bestPractices,
    examples: topic.professionalExamples,
    professionalStandards: topic.qualityRules,
    relatedTopics: topic.relatedTopics,
    keywords: topic.keywords,
    confidenceScore: topic.confidenceScore,
    qualityScore: topic.qualityScore,
    sourceMetadata: [
      {
        name: "KWIZERA Industry Standards & Quality Expansion",
        type: "curated-professional",
        reference: `expansion-step-9:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function topicToStructured(topic: ProfessionalIsqTopic): StructuredKnowledge {
  return {
    title: topic.name,
    category: topic.metadata.category,
    domain: topic.metadata.domainId,
    description: topic.description,
    sections: [
      { title: "Professional Definition", kind: "guidance", items: [topic.professionalDefinition, topic.purpose] },
      { title: "Quality Rules", kind: "rules", items: topic.qualityRules },
      { title: "Best Practices", kind: "guidance", items: topic.bestPractices },
      { title: "Workflow", kind: "workflow", items: topic.workflow },
      { title: "Professional Examples", kind: "examples", items: topic.professionalExamples },
    ],
    concepts: topic.keywords,
    entities: unique([topic.name, ...topic.relatedDomains]),
    terminology: topic.keywords,
    rules: topic.qualityRules,
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.workflow,
    examples: topic.professionalExamples,
    commonMistakes: topic.commonMistakes,
    qualityRules: topic.qualityRules,
    decisionRules: topic.qualityRules.map((rule) => `Apply: ${rule}`),
    workflowSteps: topic.workflow,
    prerequisites: topic.workflow.slice(0, 1),
    dependencies: topic.relatedDomains,
    relatedKnowledge: topic.relatedTopics.map((topicId) => getIsqTopic(topicId)?.knowledgeId ?? topicId),
    definitions: [topic.professionalDefinition],
    troubleshooting: topic.commonMistakes.map((mistake) => `Avoid: ${mistake}`),
    recommendations: topic.bestPractices,
    professionalStandards: topic.qualityRules,
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      {
        name: "KWIZERA Industry Standards & Quality Expansion",
        type: "curated-professional",
        reference: `expansion-step-9:${topic.topicId}`,
        reliability: 95,
      },
    ],
  };
}

function bridgeStructured(title: string, domain: string, description: string): StructuredKnowledge {
  return {
    title,
    category: "industry-standards-domain-bridge",
    domain,
    description,
    sections: [{ title: "Relationship", kind: "guidance", items: [description] }],
    concepts: [domain, "industry standards", "quality"],
    entities: [domain],
    terminology: [domain, "industry standards", "quality"],
    rules: [],
    bestPractices: [],
    professionalTechniques: [],
    examples: [],
    commonMistakes: [],
    qualityRules: [],
    decisionRules: [`Relate industry standards and quality knowledge to ${domain}.`],
    workflowSteps: [],
    prerequisites: [],
    dependencies: [domain],
    relatedKnowledge: [STANDARDS_ANCHOR],
    difficultyLevel: "foundation",
    confidenceScore: 85,
    sourceMetadata: [
      {
        name: "KWIZERA Industry Standards & Quality Expansion",
        type: "curated-professional",
        reliability: 95,
      },
    ],
  };
}

function mergePackItems(existing: KnowledgeItem[], incoming: KnowledgeItem[]): KnowledgeItem[] {
  const byId = new Map(existing.map((item) => [item.knowledgeId, item]));
  for (const item of incoming) byId.set(item.knowledgeId, item);
  return [...byId.values()];
}

function mergeStructured(title: string, domain: string, items: KnowledgeItem[]): StructuredKnowledge {
  return {
    title,
    category: "professional-industry-standards-quality",
    domain,
    description: "Curated professional industry standards, quality rules, best practices, evaluation guidance, and checklists.",
    sections: [
      { title: "Topics", kind: "guidance", items: items.map((item) => item.title) },
      { title: "Quality Rules", kind: "rules", items: unique(items.flatMap((item) => item.professionalStandards)) },
      { title: "Best Practices", kind: "guidance", items: unique(items.flatMap((item) => item.bestPractices)) },
      { title: "Workflow", kind: "workflow", items: unique(items.flatMap((item) => item.workflow)) },
      { title: "Examples", kind: "examples", items: unique(items.flatMap((item) => item.examples)) },
    ],
    concepts: unique(items.flatMap((item) => item.coreConcepts)),
    entities: items.map((item) => item.title),
    terminology: unique(items.flatMap((item) => item.keywords)),
    rules: unique(items.flatMap((item) => item.rules)),
    bestPractices: unique(items.flatMap((item) => item.bestPractices)),
    professionalTechniques: unique(items.flatMap((item) => item.professionalTechniques)),
    examples: unique(items.flatMap((item) => item.examples)),
    commonMistakes: unique(items.flatMap((item) => item.commonMistakes)),
    qualityRules: unique(items.flatMap((item) => item.professionalStandards)),
    decisionRules: unique(items.flatMap((item) => item.decisionRules)),
    workflowSteps: unique(items.flatMap((item) => item.workflow)),
    prerequisites: ["Define scope and acceptance criteria before applying quality guidance."],
    dependencies: [INDUSTRY_STANDARDS_DOMAIN_ID],
    relatedKnowledge: items.map((item) => item.knowledgeId),
    definitions: unique(items.flatMap((item) => item.definitions)),
    troubleshooting: unique(items.flatMap((item) => item.troubleshooting)),
    recommendations: unique(items.flatMap((item) => item.recommendations)),
    professionalStandards: unique(items.flatMap((item) => item.professionalStandards)),
    difficultyLevel: "advanced",
    confidenceScore: average(items.map((item) => item.confidenceScore)),
    sourceMetadata: [
      {
        name: "KWIZERA Industry Standards & Quality Expansion",
        type: "curated-professional",
        reliability: 95,
      },
    ],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
