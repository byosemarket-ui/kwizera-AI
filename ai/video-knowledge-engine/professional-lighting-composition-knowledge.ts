/**
 * Professional Lighting & Composition Knowledge — Expansion Step 3 installer.
 * Offline-first curated knowledge. Does not generate images or videos.
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
  findCompositionTopics,
  findLightingTopics,
  getCompositionTopic,
  getLightingCompositionTopic,
  getLightingTopic,
  LIGHTING_COMPOSITION_DOMAIN_BRIDGES,
  PROFESSIONAL_COMPOSITION_TOPICS,
  PROFESSIONAL_LIGHTING_TOPICS,
  REQUIRED_COMPOSITION_TERMINOLOGY,
  REQUIRED_COMPOSITION_TOPIC_IDS,
  REQUIRED_LIGHTING_TERMINOLOGY,
  REQUIRED_LIGHTING_TOPIC_IDS,
} from "./professional-lighting-composition-catalog.js";
import {
  COMPOSITION_DOMAIN_ID,
  LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE,
  LIGHTING_DOMAIN_ID,
  PROFESSIONAL_LIGHTING_COMPOSITION_VERSION,
  ProfessionalLightingCompositionError,
  type AiMeLightingCompositionAwareness,
  type LightingCompositionCompareResult,
  type LightingCompositionExplainResult,
  type LightingCompositionHealthReport,
  type LightingCompositionInstallResult,
  type LightingCompositionRecommendation,
  type LightingCompositionRepairResult,
  type ProfessionalLightingCompositionTopic,
} from "./professional-lighting-composition-types.js";

export class ProfessionalLightingCompositionKnowledge {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private lastInstall: LightingCompositionInstallResult | null = null;
  private lastHealth: LightingCompositionHealthReport | null = null;
  private lastRepair: LightingCompositionRepairResult | null = null;
  private relationshipCount = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "videos", "professional-lighting-composition");
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

  listLightingTopics(): ProfessionalLightingCompositionTopic[] {
    return PROFESSIONAL_LIGHTING_TOPICS.map((t) => structuredClone(t));
  }

  listCompositionTopics(): ProfessionalLightingCompositionTopic[] {
    return PROFESSIONAL_COMPOSITION_TOPICS.map((t) => structuredClone(t));
  }

  getLastInstall(): LightingCompositionInstallResult | null {
    return this.lastInstall ? structuredClone(this.lastInstall) : null;
  }

  getLastHealth(): LightingCompositionHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async installOrUpgrade(): Promise<LightingCompositionInstallResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const issues: string[] = [];
    let lightingInstalled = 0;
    let lightingUpdated = 0;
    let compositionInstalled = 0;
    let compositionUpdated = 0;
    let bridgesInstalled = 0;
    let relationshipsCreated = 0;

    for (const topic of PROFESSIONAL_LIGHTING_TOPICS) {
      const result = await this.persistTopic(topic);
      if (result === "installed") lightingInstalled += 1;
      else if (result === "updated") lightingUpdated += 1;
      else issues.push(`Failed lighting ${topic.knowledgeId}`);
    }
    for (const topic of PROFESSIONAL_COMPOSITION_TOPICS) {
      const result = await this.persistTopic(topic);
      if (result === "installed") compositionInstalled += 1;
      else if (result === "updated") compositionUpdated += 1;
      else issues.push(`Failed composition ${topic.knowledgeId}`);
    }

    for (const bridge of LIGHTING_COMPOSITION_DOMAIN_BRIDGES) {
      const existing = await foundation.getStorageEngine().getRecord(bridge.knowledgeId, LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE);
      const payload = {
        step: "knowledge-expansion-lighting-composition",
        bridgeDomainId: bridge.domainId,
        relationshipAnchor: true,
        generatesImages: false,
        generatesVideo: false,
        professionalTechniques: [],
        bestPractices: [],
        decisionRules: [`Relate lighting/composition knowledge to ${bridge.domainId}.`],
        structuredKnowledge: bridgeStructured(bridge.title, bridge.domainId, bridge.description),
      };
      if (existing.success && existing.record) {
        await foundation.getStorageEngine().updateRecord(
          bridge.knowledgeId,
          {
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["lighting-composition", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "lighting", "composition", "relationship"],
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["lit-lighting-fundamentals"],
            payload,
          },
          LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE
        );
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: bridge.knowledgeId,
            knowledgeType: KnowledgeStorageType.Image,
            category: "lighting-composition-domain-bridge",
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["lighting-composition", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "lighting", "composition", "relationship"],
            source: LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE,
            sourceReliability: 90,
            confidenceScore: 85,
            qualityScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["lit-lighting-fundamentals"],
            payload,
          },
          LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE
        );
        if (write.success) bridgesInstalled += 1;
        else issues.push(`Failed bridge ${bridge.knowledgeId}`);
      }
    }

    const allIds = [
      ...PROFESSIONAL_LIGHTING_TOPICS.map((t) => t.knowledgeId),
      ...PROFESSIONAL_COMPOSITION_TOPICS.map((t) => t.knowledgeId),
      ...LIGHTING_COMPOSITION_DOMAIN_BRIDGES.map((b) => b.knowledgeId),
    ];
    for (const id of allIds) {
      try {
        foundation.getRetrievalEngine().invalidateCache(id);
        await foundation.getGraphEngine().evolveGraph(id);
      } catch (error) {
        issues.push(`Graph evolve failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const lightingHub = "lc-bridge-lighting-knowledge";
    const compositionHub = "lc-bridge-composition-knowledge";
    for (const bridge of LIGHTING_COMPOSITION_DOMAIN_BRIDGES) {
      if (bridge.knowledgeId === lightingHub) continue;
      relationshipsCreated += await this.tryRelate(
        lightingHub,
        bridge.knowledgeId,
        KnowledgeRelationType.RelatedTo,
        bridge.relationshipEvidence
      );
    }
    relationshipsCreated += await this.tryRelate(
      lightingHub,
      compositionHub,
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Lighting and composition are co-designed for professional visuals."
    );

    for (const topic of [...PROFESSIONAL_LIGHTING_TOPICS, ...PROFESSIONAL_COMPOSITION_TOPICS]) {
      for (const related of topic.relatedTopics) {
        const target = getLightingCompositionTopic(related)?.knowledgeId;
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
          `lc-bridge-${domainId}`,
          KnowledgeRelationType.DependsOn,
          `${topic.name} depends on domain ${domainId}.`
        );
      }
    }

    this.relationshipCount = relationshipsCreated;

    let lightingPackSynced = false;
    let compositionPackSynced = false;
    try {
      lightingPackSynced = await this.syncPack(
        "lighting",
        LIGHTING_DOMAIN_ID,
        "Professional Lighting Knowledge Pack",
        PROFESSIONAL_LIGHTING_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Lighting pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      compositionPackSynced = await this.syncPack(
        "composition",
        COMPOSITION_DOMAIN_ID,
        "Professional Composition Knowledge Pack",
        PROFESSIONAL_COMPOSITION_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Composition pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let domainsMarkedReady = false;
    try {
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(LIGHTING_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(COMPOSITION_DOMAIN_ID, true);
      domainsMarkedReady = true;
    } catch (error) {
      issues.push(`Domain mark ready failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const result: LightingCompositionInstallResult = {
      installed:
        lightingInstalled + lightingUpdated >= PROFESSIONAL_LIGHTING_TOPICS.length &&
        compositionInstalled + compositionUpdated >= PROFESSIONAL_COMPOSITION_TOPICS.length &&
        issues.filter((i) => i.startsWith("Failed")).length === 0,
      lightingInstalled,
      lightingUpdated,
      compositionInstalled,
      compositionUpdated,
      bridgesInstalled,
      relationshipsCreated,
      lightingPackSynced,
      compositionPackSynced,
      domainsMarkedReady,
      issues,
    };
    this.lastInstall = result;
    await fs.writeFile(
      path.join(this.metaRoot, "expansion-state.json"),
      `${JSON.stringify(
        {
          version: PROFESSIONAL_LIGHTING_COMPOSITION_VERSION,
          domainIds: [LIGHTING_DOMAIN_ID, COMPOSITION_DOMAIN_ID],
          installedAt: new Date().toISOString(),
          install: result,
          lightingTopicIds: REQUIRED_LIGHTING_TOPIC_IDS,
          compositionTopicIds: REQUIRED_COMPOSITION_TOPIC_IDS,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    return structuredClone(result);
  }

  recommendLighting(query: string): LightingCompositionRecommendation {
    this.ensureStarted();
    const matches = findLightingTopics(query);
    const primary = matches[0];
    if (!primary) {
      return {
        available: false,
        topicId: null,
        name: query,
        reason: `No lighting technique matches "${query}".`,
        whenToUse: [],
        bestPractices: [],
        confidenceScore: 0,
        alternatives: [],
        kind: "none",
      };
    }
    return {
      available: true,
      topicId: primary.topicId,
      name: primary.name,
      reason: `${primary.purpose} Selected because it best matches: ${query}. ${primary.whenToUse[0] ?? ""}`,
      whenToUse: primary.whenToUse,
      bestPractices: primary.bestPractices,
      confidenceScore: primary.confidenceScore,
      alternatives: matches.slice(1, 3).map((m) => ({ name: m.name, reason: m.purpose })),
      kind: "lighting",
    };
  }

  recommendComposition(query: string): LightingCompositionRecommendation {
    this.ensureStarted();
    const matches = findCompositionTopics(query);
    const primary = matches[0];
    if (!primary) {
      return {
        available: false,
        topicId: null,
        name: query,
        reason: `No composition technique matches "${query}".`,
        whenToUse: [],
        bestPractices: [],
        confidenceScore: 0,
        alternatives: [],
        kind: "none",
      };
    }
    return {
      available: true,
      topicId: primary.topicId,
      name: primary.name,
      reason: `${primary.purpose} Selected because it best matches: ${query}. ${primary.whenToUse[0] ?? ""}`,
      whenToUse: primary.whenToUse,
      bestPractices: primary.bestPractices,
      confidenceScore: primary.confidenceScore,
      alternatives: matches.slice(1, 3).map((m) => ({ name: m.name, reason: m.purpose })),
      kind: "composition",
    };
  }

  compareLighting(aQuery: string, bQuery: string): LightingCompositionCompareResult {
    return this.compareKind(aQuery, bQuery, "lighting");
  }

  compareComposition(aQuery: string, bQuery: string): LightingCompositionCompareResult {
    return this.compareKind(aQuery, bQuery, "composition");
  }

  explain(query: string): LightingCompositionExplainResult {
    this.ensureStarted();
    const lighting = findLightingTopics(query)[0];
    const composition = findCompositionTopics(query)[0];
    const preferLighting =
      lighting &&
      (!composition || scoreName(query, lighting.name) >= scoreName(query, composition.name));
    const topic = preferLighting ? lighting : composition;
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        explanation: `No professional lighting/composition knowledge matches "${query}".`,
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
      explanation: `${topic.description} Purpose: ${topic.purpose}`,
      bestPractices: topic.bestPractices,
      confidenceScore: topic.confidenceScore,
      qualityScore: topic.qualityScore,
      kind: topic.metadata.category === "professional-lighting" ? "lighting" : "composition",
    };
  }

  answer(question: string): { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } {
    this.ensureStarted();
    const lower = question.toLowerCase();
    if (/compos|thirds|leading|framing|symmetry|headroom|look room|hierarchy|negative space/.test(lower)) {
      const rec = this.recommendComposition(question);
      if (rec.available) {
        const topic = getCompositionTopic(rec.topicId!)!;
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${topic.bestPractices[0]}. Avoid when: ${topic.whenNotToUse[0]}.`,
          knowledgeIds: [topic.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/light|key|fill|rim|shadow|reflect|soft|hard|kelvin|white balance|portrait light|product light/.test(lower)) {
      const rec = this.recommendLighting(question);
      if (rec.available) {
        const topic = getLightingTopic(rec.topicId!)!;
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${topic.bestPractices[0]}. Avoid when: ${topic.whenNotToUse[0]}.`,
          knowledgeIds: [topic.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    const explained = this.explain(question);
    if (!explained.available || !explained.knowledgeId) {
      return {
        available: false,
        answer: `No validated lighting/composition knowledge answers "${question}".`,
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

  getAiMeAwareness(): AiMeLightingCompositionAwareness {
    this.ensureStarted();
    const all = [...PROFESSIONAL_LIGHTING_TOPICS, ...PROFESSIONAL_COMPOSITION_TOPICS];
    let lightingDomainReady = false;
    let compositionDomainReady = false;
    try {
      lightingDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(LIGHTING_DOMAIN_ID)?.metadata.contentReady === true;
      compositionDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(COMPOSITION_DOMAIN_ID)?.metadata.contentReady === true;
    } catch {
      /* optional */
    }
    return {
      canRecommendLighting: true,
      canRecommendComposition: true,
      canExplainSelection: true,
      canCompareLighting: true,
      canCompareComposition: true,
      canAnswerQuestions: true,
      lightingTopicCount: PROFESSIONAL_LIGHTING_TOPICS.length,
      compositionTopicCount: PROFESSIONAL_COMPOSITION_TOPICS.length,
      relationshipCount: this.relationshipCount,
      averageConfidence: average(all.map((t) => t.confidenceScore)),
      averageQuality: average(all.map((t) => t.qualityScore)),
      lightingDomainReady,
      compositionDomainReady,
      summary:
        `Professional Lighting & Composition Knowledge Expansion Step 3 is active with ${PROFESSIONAL_LIGHTING_TOPICS.length} lighting and ${PROFESSIONAL_COMPOSITION_TOPICS.length} composition topics. ` +
        `AI Me can recommend lighting/composition, explain selections, compare techniques, and answer professional questions. ` +
        `Storytelling & Scene Design specialty expansion is not started.`,
    };
  }

  async runHealthCheck(): Promise<LightingCompositionHealthReport> {
    this.ensureStarted();
    const missingConcepts: string[] = [];
    const missingLightingTerminology: string[] = [];
    const missingCompositionTerminology: string[] = [];
    const duplicateKnowledge: string[] = [];
    const brokenRelationships: string[] = [];
    const issues: string[] = [];
    const foundation = this.foundation!;

    for (const topic of [...PROFESSIONAL_LIGHTING_TOPICS, ...PROFESSIONAL_COMPOSITION_TOPICS]) {
      for (const field of ["name", "description", "purpose"] as const) {
        if (!topic[field]?.trim()) missingConcepts.push(`${topic.topicId}:${field}`);
      }
      for (const list of [
        "whenToUse",
        "whenNotToUse",
        "advantages",
        "limitations",
        "bestPractices",
        "commonMistakes",
        "professionalExamples",
        "relatedCameraTechniques",
        "relatedStorytellingTechniques",
        "keywords",
      ] as const) {
        if (!topic[list].length) missingConcepts.push(`${topic.topicId}:${list}`);
      }
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topic.topicId}:not-persisted`);
    }

    const lightingText = PROFESSIONAL_LIGHTING_TOPICS.flatMap((t) => [t.name, t.topicId, ...t.keywords])
      .join(" ")
      .toLowerCase();
    const compositionText = PROFESSIONAL_COMPOSITION_TOPICS.flatMap((t) => [t.name, t.topicId, ...t.keywords])
      .join(" ")
      .toLowerCase();
    for (const term of REQUIRED_LIGHTING_TERMINOLOGY) {
      if (!termPresent(lightingText, term)) missingLightingTerminology.push(term);
    }
    for (const term of REQUIRED_COMPOSITION_TERMINOLOGY) {
      if (!termPresent(compositionText, term)) missingCompositionTerminology.push(term);
    }

    const seen = new Map<string, string>();
    for (const topic of [...PROFESSIONAL_LIGHTING_TOPICS, ...PROFESSIONAL_COMPOSITION_TOPICS]) {
      const key = topic.name.toLowerCase();
      if (seen.has(key)) duplicateKnowledge.push(`${topic.knowledgeId} duplicates ${seen.get(key)}`);
      else seen.set(key, topic.knowledgeId);
    }

    for (const topic of [...PROFESSIONAL_LIGHTING_TOPICS, ...PROFESSIONAL_COMPOSITION_TOPICS]) {
      for (const related of topic.relatedTopics) {
        if (!getLightingCompositionTopic(related)) brokenRelationships.push(`${topic.topicId}→missing ${related}`);
      }
      for (const domainId of topic.relatedDomains) {
        if (!LIGHTING_COMPOSITION_DOMAIN_BRIDGES.some((b) => b.domainId === domainId)) {
          brokenRelationships.push(`${topic.topicId}→missing bridge ${domainId}`);
        }
      }
    }

    const completenessScore = Math.max(
      0,
      100 -
        missingConcepts.length * 5 -
        missingLightingTerminology.length * 3 -
        missingCompositionTerminology.length * 3 -
        duplicateKnowledge.length * 10 -
        brokenRelationships.length * 4
    );
    const healthy =
      missingConcepts.length === 0 &&
      missingLightingTerminology.length === 0 &&
      missingCompositionTerminology.length === 0 &&
      duplicateKnowledge.length === 0 &&
      brokenRelationships.length === 0;
    if (!healthy) {
      issues.push(...missingConcepts.map((i) => `missing:${i}`));
      issues.push(...missingLightingTerminology.map((i) => `lighting-term:${i}`));
      issues.push(...missingCompositionTerminology.map((i) => `composition-term:${i}`));
      issues.push(...duplicateKnowledge.map((i) => `duplicate:${i}`));
      issues.push(...brokenRelationships.map((i) => `relationship:${i}`));
    }

    this.lastHealth = {
      healthy,
      completenessScore,
      missingConcepts,
      missingLightingTerminology,
      missingCompositionTerminology,
      duplicateKnowledge,
      brokenRelationships,
      issues,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<LightingCompositionRepairResult> {
    this.ensureStarted();
    const actions: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured professional-lighting-composition directory.");
    const before = await this.runHealthCheck();
    if (!before.healthy) {
      const reinstall = await this.installOrUpgrade();
      actions.push(
        `Reinstalled/upgraded (lighting ${reinstall.lightingInstalled}/${reinstall.lightingUpdated}; composition ${reinstall.compositionInstalled}/${reinstall.compositionUpdated}; rel=${reinstall.relationshipsCreated}).`
      );
      if (reinstall.lightingPackSynced) actions.push("Synced lighting pack.");
      if (reinstall.compositionPackSynced) actions.push("Synced composition pack.");
      if (reinstall.domainsMarkedReady) actions.push("Marked lighting/composition domains contentReady.");
    } else {
      actions.push("Health already clean; skipped reinstall.");
    }
    const health = await this.runHealthCheck();
    const repair = {
      repaired: health.issues.length === 0,
      actions: unique(actions),
      remainingIssues: health.issues,
    };
    this.lastRepair = repair;
    return structuredClone(repair);
  }

  private compareKind(
    aQuery: string,
    bQuery: string,
    kind: "lighting" | "composition"
  ): LightingCompositionCompareResult {
    this.ensureStarted();
    const find = kind === "lighting" ? findLightingTopics : findCompositionTopics;
    const aMatches = find(aQuery);
    const bMatches = find(bQuery);
    let a = aMatches[0];
    let b = bMatches[0];
    if (a && b && a.topicId === b.topicId) {
      b = bMatches.find((item) => item.topicId !== a!.topicId);
      a = aMatches.find((item) => item.topicId !== b?.topicId) ?? a;
    }
    if (!a || !b || a.topicId === b.topicId) {
      return {
        topicA: aQuery,
        topicB: bQuery,
        kind: "none",
        similarities: [],
        differences: [],
        recommendation: `Both queries must resolve to distinct ${kind} techniques.`,
        confidenceScore: 0,
      };
    }
    return {
      topicA: a.name,
      topicB: b.name,
      kind,
      similarities: [
        "Both are curated professional techniques.",
        a.relatedDomains.filter((d) => b.relatedDomains.includes(d)).map((d) => `Shared domain: ${d}`).join("; ") ||
          "Shared craft domain.",
      ].filter(Boolean),
      differences: [
        `Purpose — ${a.name}: ${a.purpose}`,
        `Purpose — ${b.name}: ${b.purpose}`,
        `Avoid ${a.name} when: ${a.whenNotToUse[0]}`,
        `Avoid ${b.name} when: ${b.whenNotToUse[0]}`,
      ],
      recommendation: `Use ${a.name} when ${a.whenToUse[0]?.toLowerCase() ?? "its purpose fits"}; use ${b.name} when ${b.whenToUse[0]?.toLowerCase() ?? "its purpose fits"}.`,
      confidenceScore: Math.round((a.confidenceScore + b.confidenceScore) / 2),
    };
  }

  private async persistTopic(topic: ProfessionalLightingCompositionTopic): Promise<"installed" | "updated" | "failed"> {
    const foundation = this.foundation!;
    const relatedKnowledge = unique([
      ...topic.relatedTopics.map((id) => getLightingCompositionTopic(id)?.knowledgeId ?? id),
      ...topic.relatedDomains.map((id) => `lc-bridge-${id}`),
    ]).filter((id) => id !== topic.knowledgeId);
    const structured = topicToStructured(topic);
    const payload = {
      step: "knowledge-expansion-lighting-composition",
      expansionVersion: PROFESSIONAL_LIGHTING_COMPOSITION_VERSION,
      topicId: topic.topicId,
      kind: topic.metadata.category,
      purpose: topic.purpose,
      whenToUse: topic.whenToUse,
      whenNotToUse: topic.whenNotToUse,
      advantages: topic.advantages,
      limitations: topic.limitations,
      relatedCameraTechniques: topic.relatedCameraTechniques,
      relatedStorytellingTechniques: topic.relatedStorytellingTechniques,
      knowledgeItem: topicToItem(topic),
      structuredKnowledge: structured,
      metadata: topic.metadata,
      generatesImages: false,
      generatesVideo: false,
      professionalTechniques: topic.bestPractices,
      bestPractices: topic.bestPractices,
      decisionRules: [
        ...topic.whenToUse.map((w) => `Use when: ${w}`),
        ...topic.whenNotToUse.map((w) => `Do not use when: ${w}`),
      ],
    };
    const storageType =
      topic.metadata.category === "professional-lighting" ? KnowledgeStorageType.Image : KnowledgeStorageType.Creative;
    const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE);
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
        LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE
      );
      return write.success ? "updated" : "failed";
    }
    const write = await foundation.getStorageEngine().storeRecord(
      {
        knowledgeId: topic.knowledgeId,
        knowledgeType: storageType,
        category: topic.metadata.category,
        title: topic.name,
        description: topic.description,
        summary: topic.purpose,
        tags: unique([topic.metadata.category, "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
        keywords: topic.keywords,
        source: LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE,
        sourceReliability: 95,
        confidenceScore: topic.confidenceScore,
        qualityScore: topic.qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge,
        payload,
      },
      LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE
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

  private async syncPack(
    slug: KnowledgePackSlug,
    domain: string,
    title: string,
    items: KnowledgeItem[]
  ): Promise<boolean> {
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
      resourceIds: existing?.resourceIds ?? ["professional-lighting-composition-expansion"],
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
      throw new ProfessionalLightingCompositionError(
        "Professional Lighting & Composition Knowledge is not initialized",
        "NOT_INITIALIZED"
      );
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalLightingCompositionError(
        "Professional Lighting & Composition Knowledge startup is incomplete",
        "NOT_STARTED"
      );
    }
  }
}

function topicToItem(topic: ProfessionalLightingCompositionTopic): KnowledgeItem {
  return {
    knowledgeId: topic.knowledgeId,
    title: topic.name,
    domain: topic.metadata.domainId,
    category: topic.metadata.category,
    description: topic.description,
    coreConcepts: topic.keywords.slice(0, 8),
    definitions: [topic.purpose],
    rules: [
      ...topic.whenToUse.map((w) => `Use when: ${w}`),
      ...topic.whenNotToUse.map((w) => `Do not use when: ${w}`),
    ],
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.advantages,
    workflow: [`Choose ${topic.name}`, ...topic.bestPractices.slice(0, 3)],
    decisionRules: [
      ...topic.whenToUse.map((w) => `Use when: ${w}`),
      ...topic.whenNotToUse.map((w) => `Avoid when: ${w}`),
    ],
    commonMistakes: topic.commonMistakes,
    troubleshooting: topic.limitations.map((l) => `Limitation: ${l}`),
    recommendations: topic.bestPractices,
    examples: topic.professionalExamples,
    professionalStandards: topic.relatedStorytellingTechniques,
    relatedTopics: topic.relatedTopics,
    keywords: topic.keywords,
    confidenceScore: topic.confidenceScore,
    qualityScore: topic.qualityScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Lighting & Composition Expansion",
        type: "curated-professional",
        reference: `expansion-step-3:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function topicToStructured(topic: ProfessionalLightingCompositionTopic): StructuredKnowledge {
  return {
    title: topic.name,
    category: topic.metadata.category,
    domain: topic.metadata.domainId,
    description: topic.description,
    sections: [
      { title: "Purpose", kind: "guidance", items: [topic.purpose] },
      { title: "When to Use", kind: "guidance", items: topic.whenToUse },
      { title: "When Not to Use", kind: "rules", items: topic.whenNotToUse },
      { title: "Best Practices", kind: "guidance", items: topic.bestPractices },
      { title: "Examples", kind: "examples", items: topic.professionalExamples },
    ],
    concepts: topic.keywords,
    entities: [topic.name, ...topic.relatedDomains],
    terminology: topic.keywords,
    rules: topic.whenNotToUse.map((w) => `Avoid when: ${w}`),
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.advantages,
    examples: topic.professionalExamples,
    commonMistakes: topic.commonMistakes,
    qualityRules: topic.limitations,
    decisionRules: [
      ...topic.whenToUse.map((w) => `Use when: ${w}`),
      ...topic.whenNotToUse.map((w) => `Do not use when: ${w}`),
    ],
    workflowSteps: topic.bestPractices,
    prerequisites: topic.relatedCameraTechniques,
    dependencies: topic.relatedDomains,
    relatedKnowledge: topic.relatedTopics.map((id) => getLightingCompositionTopic(id)?.knowledgeId ?? id),
    definitions: [topic.purpose],
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Lighting & Composition Expansion",
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
    decisionRules: [`Relate lighting/composition knowledge to ${domain}.`],
    workflowSteps: [],
    prerequisites: [],
    dependencies: [],
    relatedKnowledge: ["lit-lighting-fundamentals"],
    difficultyLevel: "foundation",
    confidenceScore: 85,
    sourceMetadata: [
      { name: "KWIZERA Professional Lighting & Composition Expansion", type: "curated", reliability: 95 },
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
    category: domain.includes("composition") ? "professional-composition" : "professional-lighting",
    domain,
    description: "Curated professional lighting/composition knowledge for AI Me (not image/video generation).",
    sections: [
      { title: "Topics", kind: "guidance", items: items.map((i) => i.title) },
      { title: "Best Practices", kind: "guidance", items: items.flatMap((i) => i.bestPractices).slice(0, 40) },
      { title: "Decision Rules", kind: "rules", items: items.flatMap((i) => i.decisionRules).slice(0, 40) },
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
    prerequisites: ["Define mood and subject priority before lighting or composing."],
    dependencies: ["camera-knowledge", "video-production-knowledge", "marketing-knowledge"],
    relatedKnowledge: items.map((i) => i.knowledgeId),
    difficultyLevel: "advanced",
    confidenceScore: average(items.map((i) => i.confidenceScore)),
    sourceMetadata: [
      {
        name: "KWIZERA Professional Lighting & Composition Expansion",
        type: "curated-professional",
        reliability: 95,
      },
    ],
  };
}

function termPresent(haystack: string, term: string): boolean {
  const normalized = haystack.replace(/-/g, " ");
  const t = term.toLowerCase().replace(/-/g, " ");
  return normalized.includes(t) || haystack.includes(term.toLowerCase());
}

function scoreName(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (q.includes(n) || n.includes(q)) return 10;
  return n.split(/\s+/).filter((t) => q.includes(t)).length;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}
