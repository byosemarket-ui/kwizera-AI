/**
 * Professional Animation, Motion Graphics & Rendering Knowledge — Expansion Step 5 installer.
 * Offline-first curated knowledge. Does not render videos or images.
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
  AMR_DOMAIN_BRIDGES,
  findAmrTopics,
  getAmrTopic,
  PROFESSIONAL_ANIMATION_TOPICS,
  PROFESSIONAL_MOTION_GRAPHICS_TOPICS,
  PROFESSIONAL_RENDERING_TOPICS,
  PROFESSIONAL_TRANSITION_TOPICS,
  REQUIRED_ANIMATION_TOPIC_IDS,
  REQUIRED_MOTION_GRAPHICS_TOPIC_IDS,
  REQUIRED_RENDERING_TOPIC_IDS,
  REQUIRED_TRANSITION_TOPIC_IDS,
} from "./professional-animation-motion-rendering-catalog.js";
import {
  ANIMATION_DOMAIN_ID,
  ANIMATION_MOTION_RENDERING_SOURCE,
  MOTION_GRAPHICS_DOMAIN_ID,
  PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION,
  ProfessionalAmrError,
  RENDERING_DOMAIN_ID,
  type AiMeAmrAwareness,
  type AmrExplainResult,
  type AmrHealthReport,
  type AmrInstallResult,
  type AmrRecommendation,
  type AmrRepairResult,
  type ProfessionalAmrTopic,
} from "./professional-animation-motion-rendering-types.js";

const ALL_TOPICS = () => [
  ...PROFESSIONAL_ANIMATION_TOPICS,
  ...PROFESSIONAL_MOTION_GRAPHICS_TOPICS,
  ...PROFESSIONAL_TRANSITION_TOPICS,
  ...PROFESSIONAL_RENDERING_TOPICS,
];

export class ProfessionalAnimationMotionRenderingKnowledge {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private lastInstall: AmrInstallResult | null = null;
  private lastHealth: AmrHealthReport | null = null;
  private lastRepair: AmrRepairResult | null = null;
  private relationshipCount = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "videos", "professional-animation-motion-rendering");
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

  listAnimationTopics(): ProfessionalAmrTopic[] {
    return PROFESSIONAL_ANIMATION_TOPICS.map((t) => structuredClone(t));
  }

  listMotionGraphicsTopics(): ProfessionalAmrTopic[] {
    return [...PROFESSIONAL_MOTION_GRAPHICS_TOPICS, ...PROFESSIONAL_TRANSITION_TOPICS].map((t) => structuredClone(t));
  }

  listRenderingTopics(): ProfessionalAmrTopic[] {
    return PROFESSIONAL_RENDERING_TOPICS.map((t) => structuredClone(t));
  }

  getLastInstall(): AmrInstallResult | null {
    return this.lastInstall ? structuredClone(this.lastInstall) : null;
  }

  getLastHealth(): AmrHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async installOrUpgrade(): Promise<AmrInstallResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const issues: string[] = [];
    let animationInstalled = 0;
    let animationUpdated = 0;
    let motionInstalled = 0;
    let motionUpdated = 0;
    let transitionInstalled = 0;
    let transitionUpdated = 0;
    let renderingInstalled = 0;
    let renderingUpdated = 0;
    let bridgesInstalled = 0;
    let relationshipsCreated = 0;

    for (const topic of PROFESSIONAL_ANIMATION_TOPICS) {
      const r = await this.persistTopic(topic);
      if (r === "installed") animationInstalled += 1;
      else if (r === "updated") animationUpdated += 1;
      else issues.push(`Failed animation ${topic.knowledgeId}`);
    }
    for (const topic of PROFESSIONAL_MOTION_GRAPHICS_TOPICS) {
      const r = await this.persistTopic(topic);
      if (r === "installed") motionInstalled += 1;
      else if (r === "updated") motionUpdated += 1;
      else issues.push(`Failed motion ${topic.knowledgeId}`);
    }
    for (const topic of PROFESSIONAL_TRANSITION_TOPICS) {
      const r = await this.persistTopic(topic);
      if (r === "installed") transitionInstalled += 1;
      else if (r === "updated") transitionUpdated += 1;
      else issues.push(`Failed transition ${topic.knowledgeId}`);
    }
    for (const topic of PROFESSIONAL_RENDERING_TOPICS) {
      const r = await this.persistTopic(topic);
      if (r === "installed") renderingInstalled += 1;
      else if (r === "updated") renderingUpdated += 1;
      else issues.push(`Failed rendering ${topic.knowledgeId}`);
    }

    for (const bridge of AMR_DOMAIN_BRIDGES) {
      const existing = await foundation.getStorageEngine().getRecord(bridge.knowledgeId, ANIMATION_MOTION_RENDERING_SOURCE);
      const payload = {
        step: "knowledge-expansion-animation-motion-rendering",
        bridgeDomainId: bridge.domainId,
        relationshipAnchor: true,
        generatesVideo: false,
        generatesImages: false,
        professionalTechniques: [],
        bestPractices: [],
        decisionRules: [`Relate animation/motion/rendering knowledge to ${bridge.domainId}.`],
        structuredKnowledge: bridgeStructured(bridge.title, bridge.domainId, bridge.description),
      };
      if (existing.success && existing.record) {
        await foundation.getStorageEngine().updateRecord(
          bridge.knowledgeId,
          {
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["animation-motion-rendering", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "animation", "motion", "rendering", "relationship"],
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["anim-animation-fundamentals"],
            payload,
          },
          ANIMATION_MOTION_RENDERING_SOURCE
        );
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: bridge.knowledgeId,
            knowledgeType: KnowledgeStorageType.Creative,
            category: "amr-domain-bridge",
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["animation-motion-rendering", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "animation", "motion", "rendering", "relationship"],
            source: ANIMATION_MOTION_RENDERING_SOURCE,
            sourceReliability: 90,
            confidenceScore: 85,
            qualityScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["anim-animation-fundamentals"],
            payload,
          },
          ANIMATION_MOTION_RENDERING_SOURCE
        );
        if (write.success) bridgesInstalled += 1;
        else issues.push(`Failed bridge ${bridge.knowledgeId}`);
      }
    }

    const allIds = [...ALL_TOPICS().map((t) => t.knowledgeId), ...AMR_DOMAIN_BRIDGES.map((b) => b.knowledgeId)];
    for (const id of allIds) {
      try {
        foundation.getRetrievalEngine().invalidateCache(id);
        await foundation.getGraphEngine().evolveGraph(id);
      } catch (error) {
        issues.push(`Graph evolve failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const animHub = "amr-bridge-animation-knowledge";
    const motionHub = "amr-bridge-motion-graphics-knowledge";
    const renderHub = "amr-bridge-rendering-knowledge";
    for (const bridge of AMR_DOMAIN_BRIDGES) {
      if (bridge.knowledgeId === animHub) continue;
      relationshipsCreated += await this.tryRelate(animHub, bridge.knowledgeId, KnowledgeRelationType.RelatedTo, bridge.relationshipEvidence);
    }
    relationshipsCreated += await this.tryRelate(
      animHub,
      motionHub,
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Animation principles power motion graphics craft."
    );
    relationshipsCreated += await this.tryRelate(
      motionHub,
      renderHub,
      KnowledgeRelationType.DependsOn,
      "Motion graphics deliverables depend on rendering/export knowledge."
    );

    for (const topic of ALL_TOPICS()) {
      for (const related of topic.relatedTopics) {
        const target = getAmrTopic(related)?.knowledgeId;
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
          `amr-bridge-${domainId}`,
          KnowledgeRelationType.DependsOn,
          `${topic.name} depends on domain ${domainId}.`
        );
      }
    }

    this.relationshipCount = relationshipsCreated;

    let animationPackSynced = false;
    let motionPackSynced = false;
    let renderingPackSynced = false;
    try {
      animationPackSynced = await this.syncPack(
        "animation",
        ANIMATION_DOMAIN_ID,
        "Professional Animation Knowledge Pack",
        PROFESSIONAL_ANIMATION_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Animation pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      motionPackSynced = await this.syncPack(
        "motion",
        MOTION_GRAPHICS_DOMAIN_ID,
        "Professional Motion Graphics & Transitions Knowledge Pack",
        [...PROFESSIONAL_MOTION_GRAPHICS_TOPICS, ...PROFESSIONAL_TRANSITION_TOPICS].map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Motion pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      renderingPackSynced = await this.syncPack(
        "rendering",
        RENDERING_DOMAIN_ID,
        "Professional Rendering Knowledge Pack",
        PROFESSIONAL_RENDERING_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Rendering pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let domainsMarkedReady = false;
    try {
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(ANIMATION_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(MOTION_GRAPHICS_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(RENDERING_DOMAIN_ID, true);
      domainsMarkedReady = true;
    } catch (error) {
      issues.push(`Domain mark ready failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const result: AmrInstallResult = {
      installed:
        animationInstalled + animationUpdated >= PROFESSIONAL_ANIMATION_TOPICS.length &&
        motionInstalled + motionUpdated >= PROFESSIONAL_MOTION_GRAPHICS_TOPICS.length &&
        transitionInstalled + transitionUpdated >= PROFESSIONAL_TRANSITION_TOPICS.length &&
        renderingInstalled + renderingUpdated >= PROFESSIONAL_RENDERING_TOPICS.length &&
        issues.filter((i) => i.startsWith("Failed")).length === 0,
      animationInstalled,
      animationUpdated,
      motionInstalled,
      motionUpdated,
      transitionInstalled,
      transitionUpdated,
      renderingInstalled,
      renderingUpdated,
      bridgesInstalled,
      relationshipsCreated,
      animationPackSynced,
      motionPackSynced,
      renderingPackSynced,
      domainsMarkedReady,
      issues,
    };
    this.lastInstall = result;
    await fs.writeFile(
      path.join(this.metaRoot, "expansion-state.json"),
      `${JSON.stringify(
        {
          version: PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION,
          domainIds: [ANIMATION_DOMAIN_ID, MOTION_GRAPHICS_DOMAIN_ID, RENDERING_DOMAIN_ID],
          installedAt: new Date().toISOString(),
          install: result,
          animationTopicIds: REQUIRED_ANIMATION_TOPIC_IDS,
          motionTopicIds: REQUIRED_MOTION_GRAPHICS_TOPIC_IDS,
          transitionTopicIds: REQUIRED_TRANSITION_TOPIC_IDS,
          renderingTopicIds: REQUIRED_RENDERING_TOPIC_IDS,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    return structuredClone(result);
  }

  recommendAnimationStyle(query: string): AmrRecommendation {
    return this.recommendFrom(query, PROFESSIONAL_ANIMATION_TOPICS, "animation");
  }

  recommendMotionGraphics(query: string): AmrRecommendation {
    const pool = /transition|cut|fade|dissolve|wipe|match/i.test(query)
      ? [...PROFESSIONAL_TRANSITION_TOPICS, ...PROFESSIONAL_MOTION_GRAPHICS_TOPICS]
      : [...PROFESSIONAL_MOTION_GRAPHICS_TOPICS, ...PROFESSIONAL_TRANSITION_TOPICS];
    const kind = PROFESSIONAL_TRANSITION_TOPICS.some((t) => findAmrTopics(query, [t]).length && getAmrTopic(findAmrTopics(query, pool)[0]?.topicId ?? "")?.metadata.category === "professional-transitions")
      ? "transitions"
      : "motion-graphics";
    const rec = this.recommendFrom(query, pool, kind === "transitions" ? "transitions" : "motion-graphics");
    return rec;
  }

  recommendRenderingSettings(query: string): AmrRecommendation {
    return this.recommendFrom(query, PROFESSIONAL_RENDERING_TOPICS, "rendering");
  }

  recommendExportSettings(query: string): AmrRecommendation {
    const exportTopic = getAmrTopic("export-settings")!;
    const matches = findAmrTopics(query || "export settings platform delivery", PROFESSIONAL_RENDERING_TOPICS);
    const primary = matches.find((t) => t.topicId === "export-settings") ?? matches[0] ?? exportTopic;
    const codec = getAmrTopic("video-codecs");
    const bitrate = getAmrTopic("bitrate");
    const resolution = getAmrTopic("resolution");
    return {
      available: true,
      topicId: primary.topicId,
      name: primary.name,
      reason: `${exportTopic.professionalDefinition} Tuned for: ${query || "general delivery"}. Combine resolution, codec, and bitrate intentionally.`,
      bestPractices: unique([
        ...exportTopic.bestPractices,
        ...(codec?.bestPractices.slice(0, 1) ?? []),
        ...(bitrate?.bestPractices.slice(0, 1) ?? []),
        ...(resolution?.bestPractices.slice(0, 1) ?? []),
      ]),
      workflow: exportTopic.workflow,
      confidenceScore: exportTopic.confidenceScore,
      alternatives: matches
        .filter((m) => m.topicId !== primary.topicId)
        .slice(0, 3)
        .map((m) => ({ name: m.name, reason: m.purpose })),
      kind: "export",
    };
  }

  explain(query: string): AmrExplainResult {
    this.ensureStarted();
    const topic = findAmrTopics(query, ALL_TOPICS())[0];
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        explanation: `No professional animation/motion/rendering knowledge matches "${query}".`,
        bestPractices: [],
        confidenceScore: 0,
        qualityScore: 0,
        kind: "none",
      };
    }
    const kindMap = {
      "professional-animation": "animation",
      "professional-motion-graphics": "motion-graphics",
      "professional-transitions": "transitions",
      "professional-rendering": "rendering",
    } as const;
    return {
      available: true,
      knowledgeId: topic.knowledgeId,
      title: topic.name,
      explanation: `${topic.professionalDefinition} Purpose: ${topic.purpose}`,
      bestPractices: topic.bestPractices,
      confidenceScore: topic.confidenceScore,
      qualityScore: topic.qualityScore,
      kind: kindMap[topic.metadata.category],
    };
  }

  answer(question: string): { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } {
    this.ensureStarted();
    const lower = question.toLowerCase();
    if (/export|preset|deliver|instagram|youtube|encode settings/.test(lower)) {
      const rec = this.recommendExportSettings(question);
      return {
        available: true,
        answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}. Workflow: ${rec.workflow.join(" → ")}.`,
        knowledgeIds: [rec.topicId ? getAmrTopic(rec.topicId)?.knowledgeId ?? "" : ""].filter(Boolean),
        confidenceScore: rec.confidenceScore,
      };
    }
    if (/render|codec|bitrate|resolution|hdr|color space|compression/.test(lower)) {
      const rec = this.recommendRenderingSettings(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getAmrTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/motion graphic|logo anim|text anim|ui motion|kinetic|transition|fade|dissolve|wipe|match cut/.test(lower)) {
      const rec = this.recommendMotionGraphics(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getAmrTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    if (/animat|timing|spacing|squash|anticipation|staging|character|product anim/.test(lower)) {
      const rec = this.recommendAnimationStyle(question);
      if (rec.available && rec.topicId) {
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${rec.bestPractices[0]}.`,
          knowledgeIds: [getAmrTopic(rec.topicId)!.knowledgeId],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    const explained = this.explain(question);
    if (!explained.available || !explained.knowledgeId) {
      return {
        available: false,
        answer: `No validated animation/motion/rendering knowledge answers "${question}".`,
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

  getAiMeAwareness(): AiMeAmrAwareness {
    this.ensureStarted();
    const all = ALL_TOPICS();
    let animationDomainReady = false;
    let motionGraphicsDomainReady = false;
    let renderingDomainReady = false;
    try {
      animationDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(ANIMATION_DOMAIN_ID)?.metadata.contentReady === true;
      motionGraphicsDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(MOTION_GRAPHICS_DOMAIN_ID)?.metadata.contentReady === true;
      renderingDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(RENDERING_DOMAIN_ID)?.metadata.contentReady === true;
    } catch {
      /* optional */
    }
    return {
      canRecommendAnimationStyles: true,
      canRecommendMotionGraphics: true,
      canRecommendRenderingSettings: true,
      canExplainRenderingDecisions: true,
      canRecommendExportSettings: true,
      canAnswerQuestions: true,
      animationTopicCount: PROFESSIONAL_ANIMATION_TOPICS.length,
      motionGraphicsTopicCount: PROFESSIONAL_MOTION_GRAPHICS_TOPICS.length,
      transitionTopicCount: PROFESSIONAL_TRANSITION_TOPICS.length,
      renderingTopicCount: PROFESSIONAL_RENDERING_TOPICS.length,
      relationshipCount: this.relationshipCount,
      averageConfidence: average(all.map((t) => t.confidenceScore)),
      averageQuality: average(all.map((t) => t.qualityScore)),
      animationDomainReady,
      motionGraphicsDomainReady,
      renderingDomainReady,
      summary:
        `Professional Animation, Motion Graphics & Rendering Knowledge Expansion Step 5 is active with ${PROFESSIONAL_ANIMATION_TOPICS.length} animation, ${PROFESSIONAL_MOTION_GRAPHICS_TOPICS.length} motion graphics, ${PROFESSIONAL_TRANSITION_TOPICS.length} transition, and ${PROFESSIONAL_RENDERING_TOPICS.length} rendering topics. ` +
        `AI Me can recommend animation styles, motion graphics, rendering/export settings, explain decisions, and answer professional questions. ` +
        `Professional Video Editing specialty expansion is not started.`,
    };
  }

  async runHealthCheck(): Promise<AmrHealthReport> {
    this.ensureStarted();
    const missingConcepts: string[] = [];
    const missingAnimationConcepts: string[] = [];
    const missingMotionConcepts: string[] = [];
    const missingRenderingConcepts: string[] = [];
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
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, ANIMATION_MOTION_RENDERING_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topic.topicId}:not-persisted`);
    }

    for (const id of REQUIRED_ANIMATION_TOPIC_IDS) {
      if (!getAmrTopic(id)) missingAnimationConcepts.push(id);
    }
    for (const id of [...REQUIRED_MOTION_GRAPHICS_TOPIC_IDS, ...REQUIRED_TRANSITION_TOPIC_IDS]) {
      if (!getAmrTopic(id)) missingMotionConcepts.push(id);
    }
    for (const id of REQUIRED_RENDERING_TOPIC_IDS) {
      if (!getAmrTopic(id)) missingRenderingConcepts.push(id);
    }

    const seen = new Map<string, string>();
    for (const topic of ALL_TOPICS()) {
      const key = topic.name.toLowerCase();
      if (seen.has(key)) duplicateKnowledge.push(`${topic.knowledgeId} duplicates ${seen.get(key)}`);
      else seen.set(key, topic.knowledgeId);
      for (const related of topic.relatedTopics) {
        if (!getAmrTopic(related)) brokenRelationships.push(`${topic.topicId}→missing ${related}`);
      }
      for (const domainId of topic.relatedDomains) {
        if (!AMR_DOMAIN_BRIDGES.some((b) => b.domainId === domainId)) {
          brokenRelationships.push(`${topic.topicId}→missing bridge ${domainId}`);
        }
      }
    }

    const completenessScore = Math.max(
      0,
      100 -
        missingConcepts.length * 4 -
        missingAnimationConcepts.length * 3 -
        missingMotionConcepts.length * 3 -
        missingRenderingConcepts.length * 3 -
        duplicateKnowledge.length * 10 -
        brokenRelationships.length * 4
    );
    const healthy =
      missingConcepts.length === 0 &&
      missingAnimationConcepts.length === 0 &&
      missingMotionConcepts.length === 0 &&
      missingRenderingConcepts.length === 0 &&
      duplicateKnowledge.length === 0 &&
      brokenRelationships.length === 0;
    if (!healthy) {
      issues.push(...missingConcepts.map((i) => `missing:${i}`));
      issues.push(...missingAnimationConcepts.map((i) => `animation:${i}`));
      issues.push(...missingMotionConcepts.map((i) => `motion:${i}`));
      issues.push(...missingRenderingConcepts.map((i) => `rendering:${i}`));
      issues.push(...duplicateKnowledge.map((i) => `duplicate:${i}`));
      issues.push(...brokenRelationships.map((i) => `relationship:${i}`));
    }

    this.lastHealth = {
      healthy,
      completenessScore,
      missingConcepts,
      missingAnimationConcepts,
      missingMotionConcepts,
      missingRenderingConcepts,
      duplicateKnowledge,
      brokenRelationships,
      issues,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<AmrRepairResult> {
    this.ensureStarted();
    const actions: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured professional-animation-motion-rendering directory.");
    const before = await this.runHealthCheck();
    if (!before.healthy) {
      const reinstall = await this.installOrUpgrade();
      actions.push(
        `Reinstalled/upgraded (anim ${reinstall.animationInstalled}/${reinstall.animationUpdated}; motion ${reinstall.motionInstalled}/${reinstall.motionUpdated}; trans ${reinstall.transitionInstalled}/${reinstall.transitionUpdated}; render ${reinstall.renderingInstalled}/${reinstall.renderingUpdated}; rel=${reinstall.relationshipsCreated}).`
      );
      if (reinstall.animationPackSynced) actions.push("Synced animation pack.");
      if (reinstall.motionPackSynced) actions.push("Synced motion pack.");
      if (reinstall.renderingPackSynced) actions.push("Synced rendering pack.");
      if (reinstall.domainsMarkedReady) actions.push("Marked animation/motion/rendering domains contentReady.");
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
    pool: ProfessionalAmrTopic[],
    kind: AmrRecommendation["kind"]
  ): AmrRecommendation {
    this.ensureStarted();
    const matches = findAmrTopics(query, pool);
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

  private async persistTopic(topic: ProfessionalAmrTopic): Promise<"installed" | "updated" | "failed"> {
    const foundation = this.foundation!;
    const relatedKnowledge = unique([
      ...topic.relatedTopics.map((id) => getAmrTopic(id)?.knowledgeId ?? id),
      ...topic.relatedDomains.map((id) => `amr-bridge-${id}`),
    ]).filter((id) => id !== topic.knowledgeId);
    const payload = {
      step: "knowledge-expansion-animation-motion-rendering",
      expansionVersion: PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION,
      topicId: topic.topicId,
      kind: topic.metadata.category,
      purpose: topic.purpose,
      professionalDefinition: topic.professionalDefinition,
      workflow: topic.workflow,
      knowledgeItem: topicToItem(topic),
      structuredKnowledge: topicToStructured(topic),
      metadata: topic.metadata,
      generatesVideo: false,
      generatesImages: false,
      professionalTechniques: topic.bestPractices,
      bestPractices: topic.bestPractices,
      decisionRules: topic.bestPractices.map((b) => `Practice: ${b}`),
    };
    const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, ANIMATION_MOTION_RENDERING_SOURCE);
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
        ANIMATION_MOTION_RENDERING_SOURCE
      );
      return write.success ? "updated" : "failed";
    }
    const write = await foundation.getStorageEngine().storeRecord(
      {
        knowledgeId: topic.knowledgeId,
        knowledgeType: KnowledgeStorageType.Creative,
        category: topic.metadata.category,
        title: topic.name,
        description: topic.description,
        summary: topic.purpose,
        tags: unique([topic.metadata.category, "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
        keywords: topic.keywords,
        source: ANIMATION_MOTION_RENDERING_SOURCE,
        sourceReliability: 95,
        confidenceScore: topic.confidenceScore,
        qualityScore: topic.qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge,
        payload,
      },
      ANIMATION_MOTION_RENDERING_SOURCE
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
      resourceIds: existing?.resourceIds ?? ["professional-animation-motion-rendering-expansion"],
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
      throw new ProfessionalAmrError("Professional Animation/Motion/Rendering Knowledge is not initialized", "NOT_INITIALIZED");
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalAmrError("Professional Animation/Motion/Rendering Knowledge startup is incomplete", "NOT_STARTED");
    }
  }
}

function topicToItem(topic: ProfessionalAmrTopic): KnowledgeItem {
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
        name: "KWIZERA Professional Animation/Motion/Rendering Expansion",
        type: "curated-professional",
        reference: `expansion-step-5:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function topicToStructured(topic: ProfessionalAmrTopic): StructuredKnowledge {
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
    relatedKnowledge: topic.relatedTopics.map((id) => getAmrTopic(id)?.knowledgeId ?? id),
    definitions: [topic.professionalDefinition, topic.purpose],
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      { name: "KWIZERA Professional Animation/Motion/Rendering Expansion", type: "curated-professional", reliability: 95 },
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
    decisionRules: [`Relate AMR knowledge to ${domain}.`],
    workflowSteps: [],
    prerequisites: [],
    dependencies: [],
    relatedKnowledge: ["anim-animation-fundamentals"],
    difficultyLevel: "foundation",
    confidenceScore: 85,
    sourceMetadata: [{ name: "KWIZERA Professional Animation/Motion/Rendering Expansion", type: "curated", reliability: 95 }],
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
    category: domain.includes("render")
      ? "professional-rendering"
      : domain.includes("motion")
        ? "professional-motion-graphics"
        : "professional-animation",
    domain,
    description: "Curated professional animation/motion/rendering knowledge for AI Me (not render/generation).",
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
    prerequisites: ["Define communication intent before animating or exporting."],
    dependencies: ["video-production-knowledge", "marketing-knowledge", "video-editing-knowledge"],
    relatedKnowledge: items.map((i) => i.knowledgeId),
    difficultyLevel: "advanced",
    confidenceScore: average(items.map((i) => i.confidenceScore)),
    sourceMetadata: [
      { name: "KWIZERA Professional Animation/Motion/Rendering Expansion", type: "curated-professional", reliability: 95 },
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
