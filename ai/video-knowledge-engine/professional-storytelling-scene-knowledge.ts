/**
 * Professional Storytelling & Scene Design Knowledge — Expansion Step 4 installer.
 * Offline-first curated knowledge. Does not generate videos.
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
  findSceneDesignTopics,
  findStorytellingTopics,
  getSceneDesignTopic,
  getStorytellingSceneTopic,
  getStorytellingTopic,
  PROFESSIONAL_SCENE_DESIGN_TOPICS,
  PROFESSIONAL_STORYTELLING_TOPICS,
  REQUIRED_SCENE_DESIGN_TOPIC_IDS,
  REQUIRED_STORY_STRUCTURE_CONCEPTS,
  REQUIRED_STORYTELLING_TOPIC_IDS,
  STORYTELLING_SCENE_DOMAIN_BRIDGES,
} from "./professional-storytelling-scene-catalog.js";
import {
  PROFESSIONAL_STORYTELLING_SCENE_VERSION,
  ProfessionalStorytellingSceneError,
  SCENE_DOMAIN_ID,
  STORYTELLING_DOMAIN_ID,
  STORYTELLING_SCENE_KNOWLEDGE_SOURCE,
  type AiMeStorytellingSceneAwareness,
  type EmotionalFlowRecommendation,
  type ProfessionalStorytellingSceneTopic,
  type SceneLayoutRecommendation,
  type SceneSequenceRecommendation,
  type StoryStructureResult,
  type StorytellingExplainResult,
  type StorytellingSceneHealthReport,
  type StorytellingSceneInstallResult,
  type StorytellingSceneRepairResult,
} from "./professional-storytelling-scene-types.js";

export class ProfessionalStorytellingSceneKnowledge {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private lastInstall: StorytellingSceneInstallResult | null = null;
  private lastHealth: StorytellingSceneHealthReport | null = null;
  private lastRepair: StorytellingSceneRepairResult | null = null;
  private relationshipCount = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "videos", "professional-storytelling-scene");
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

  listStorytellingTopics(): ProfessionalStorytellingSceneTopic[] {
    return PROFESSIONAL_STORYTELLING_TOPICS.map((t) => structuredClone(t));
  }

  listSceneDesignTopics(): ProfessionalStorytellingSceneTopic[] {
    return PROFESSIONAL_SCENE_DESIGN_TOPICS.map((t) => structuredClone(t));
  }

  getLastInstall(): StorytellingSceneInstallResult | null {
    return this.lastInstall ? structuredClone(this.lastInstall) : null;
  }

  getLastHealth(): StorytellingSceneHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async installOrUpgrade(): Promise<StorytellingSceneInstallResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const issues: string[] = [];
    let storytellingInstalled = 0;
    let storytellingUpdated = 0;
    let sceneInstalled = 0;
    let sceneUpdated = 0;
    let bridgesInstalled = 0;
    let relationshipsCreated = 0;

    for (const topic of PROFESSIONAL_STORYTELLING_TOPICS) {
      const result = await this.persistTopic(topic);
      if (result === "installed") storytellingInstalled += 1;
      else if (result === "updated") storytellingUpdated += 1;
      else issues.push(`Failed storytelling ${topic.knowledgeId}`);
    }
    for (const topic of PROFESSIONAL_SCENE_DESIGN_TOPICS) {
      const result = await this.persistTopic(topic);
      if (result === "installed") sceneInstalled += 1;
      else if (result === "updated") sceneUpdated += 1;
      else issues.push(`Failed scene ${topic.knowledgeId}`);
    }

    for (const bridge of STORYTELLING_SCENE_DOMAIN_BRIDGES) {
      const existing = await foundation.getStorageEngine().getRecord(bridge.knowledgeId, STORYTELLING_SCENE_KNOWLEDGE_SOURCE);
      const payload = {
        step: "knowledge-expansion-storytelling-scene",
        bridgeDomainId: bridge.domainId,
        relationshipAnchor: true,
        generatesVideo: false,
        professionalTechniques: [],
        bestPractices: [],
        decisionRules: [`Relate storytelling/scene knowledge to ${bridge.domainId}.`],
        structuredKnowledge: bridgeStructured(bridge.title, bridge.domainId, bridge.description),
      };
      if (existing.success && existing.record) {
        await foundation.getStorageEngine().updateRecord(
          bridge.knowledgeId,
          {
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["storytelling-scene", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "storytelling", "scene", "relationship"],
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["story-storytelling-fundamentals"],
            payload,
          },
          STORYTELLING_SCENE_KNOWLEDGE_SOURCE
        );
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: bridge.knowledgeId,
            knowledgeType: KnowledgeStorageType.Creative,
            category: "storytelling-scene-domain-bridge",
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["storytelling-scene", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "storytelling", "scene", "relationship"],
            source: STORYTELLING_SCENE_KNOWLEDGE_SOURCE,
            sourceReliability: 90,
            confidenceScore: 85,
            qualityScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["story-storytelling-fundamentals"],
            payload,
          },
          STORYTELLING_SCENE_KNOWLEDGE_SOURCE
        );
        if (write.success) bridgesInstalled += 1;
        else issues.push(`Failed bridge ${bridge.knowledgeId}`);
      }
    }

    const allIds = [
      ...PROFESSIONAL_STORYTELLING_TOPICS.map((t) => t.knowledgeId),
      ...PROFESSIONAL_SCENE_DESIGN_TOPICS.map((t) => t.knowledgeId),
      ...STORYTELLING_SCENE_DOMAIN_BRIDGES.map((b) => b.knowledgeId),
    ];
    for (const id of allIds) {
      try {
        foundation.getRetrievalEngine().invalidateCache(id);
        await foundation.getGraphEngine().evolveGraph(id);
      } catch (error) {
        issues.push(`Graph evolve failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const storyHub = "ss-bridge-storytelling-knowledge";
    const sceneHub = "ss-bridge-scene-knowledge";
    for (const bridge of STORYTELLING_SCENE_DOMAIN_BRIDGES) {
      if (bridge.knowledgeId === storyHub) continue;
      relationshipsCreated += await this.tryRelate(
        storyHub,
        bridge.knowledgeId,
        KnowledgeRelationType.RelatedTo,
        bridge.relationshipEvidence
      );
    }
    relationshipsCreated += await this.tryRelate(
      storyHub,
      sceneHub,
      KnowledgeRelationType.FrequentlyUsedTogether,
      "Storytelling and scene design are co-designed for commercial narratives."
    );
    relationshipsCreated += await this.tryRelate(
      storyHub,
      sceneHub,
      KnowledgeRelationType.Child,
      "Scene knowledge is the executable child of storytelling structure."
    );

    for (const topic of [...PROFESSIONAL_STORYTELLING_TOPICS, ...PROFESSIONAL_SCENE_DESIGN_TOPICS]) {
      for (const related of topic.relatedTopics) {
        const target = getStorytellingSceneTopic(related)?.knowledgeId;
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
          `ss-bridge-${domainId}`,
          KnowledgeRelationType.DependsOn,
          `${topic.name} depends on domain ${domainId}.`
        );
      }
    }

    this.relationshipCount = relationshipsCreated;

    let storytellingPackSynced = false;
    let scenePackSynced = false;
    try {
      storytellingPackSynced = await this.syncPack(
        "storytelling",
        STORYTELLING_DOMAIN_ID,
        "Professional Storytelling Knowledge Pack",
        PROFESSIONAL_STORYTELLING_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Storytelling pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      scenePackSynced = await this.syncPack(
        "scene",
        SCENE_DOMAIN_ID,
        "Professional Scene Design Knowledge Pack",
        PROFESSIONAL_SCENE_DESIGN_TOPICS.map((t) => topicToItem(t))
      );
    } catch (error) {
      issues.push(`Scene pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let domainsMarkedReady = false;
    try {
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(STORYTELLING_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(SCENE_DOMAIN_ID, true);
      domainsMarkedReady = true;
    } catch (error) {
      issues.push(`Domain mark ready failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const result: StorytellingSceneInstallResult = {
      installed:
        storytellingInstalled + storytellingUpdated >= PROFESSIONAL_STORYTELLING_TOPICS.length &&
        sceneInstalled + sceneUpdated >= PROFESSIONAL_SCENE_DESIGN_TOPICS.length &&
        issues.filter((i) => i.startsWith("Failed")).length === 0,
      storytellingInstalled,
      storytellingUpdated,
      sceneInstalled,
      sceneUpdated,
      bridgesInstalled,
      relationshipsCreated,
      storytellingPackSynced,
      scenePackSynced,
      domainsMarkedReady,
      issues,
    };
    this.lastInstall = result;
    await fs.writeFile(
      path.join(this.metaRoot, "expansion-state.json"),
      `${JSON.stringify(
        {
          version: PROFESSIONAL_STORYTELLING_SCENE_VERSION,
          domainIds: [STORYTELLING_DOMAIN_ID, SCENE_DOMAIN_ID],
          installedAt: new Date().toISOString(),
          install: result,
          storytellingTopicIds: REQUIRED_STORYTELLING_TOPIC_IDS,
          sceneTopicIds: REQUIRED_SCENE_DESIGN_TOPIC_IDS,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    return structuredClone(result);
  }

  buildStoryStructure(query: string): StoryStructureResult {
    this.ensureStarted();
    const threeAct = getStorytellingTopic("three-act-structure")!;
    const beginning = getStorytellingTopic("beginning")!;
    const middle = getStorytellingTopic("middle")!;
    const ending = getStorytellingTopic("ending")!;
    const cta = getStorytellingTopic("call-to-action-placement")!;
    const emotion = getStorytellingTopic("emotional-journey")!;
    const product = /product|demo|feature|sku/i.test(query);
    const brand = /brand|identity|values|culture/i.test(query);
    const structureName = product ? "Product Three-Act Commercial" : brand ? "Brand Three-Act Film" : "Commercial Three-Act Structure";
    const opening = getSceneDesignTopic("opening-scene")!;
    const demo = getSceneDesignTopic(product ? "demonstration-scene" : "lifestyle-scene")!;
    const hero = getSceneDesignTopic(product ? "product-reveal-scene" : "hero-scene")!;
    const closing = getSceneDesignTopic("closing-scene")!;
    return {
      available: true,
      structureName,
      acts: [
        {
          name: "Act I — Beginning",
          purpose: beginning.purpose,
          sceneHints: [opening.name, "Establish desire and conflict quickly"],
        },
        {
          name: "Act II — Middle",
          purpose: middle.purpose,
          sceneHints: [demo.name, hero.name, "Escalate conflict and show capability"],
        },
        {
          name: "Act III — Ending",
          purpose: ending.purpose,
          sceneHints: [closing.name, "Resolve and place CTA"],
        },
      ],
      emotionalFlow: emotion.workflow.length ? emotion.bestPractices : ["Curiosity", "Tension", "Relief", "Desire", "Confidence"],
      ctaPlacement: cta.bestPractices[0] ?? "Place CTA after proof in the closing scene.",
      reason: `${threeAct.professionalDefinition} Adapted for: ${query || "general commercial"}.`,
      knowledgeIds: [threeAct.knowledgeId, beginning.knowledgeId, middle.knowledgeId, ending.knowledgeId, cta.knowledgeId],
      confidenceScore: Math.round((threeAct.confidenceScore + cta.confidenceScore) / 2),
    };
  }

  recommendSceneSequence(query: string): SceneSequenceRecommendation {
    this.ensureStarted();
    const lower = query.toLowerCase();
    let ids: string[] = ["opening-scene", "lifestyle-scene", "hero-scene", "closing-scene"];
    let sequenceName = "Brand Lifestyle Sequence";
    if (/testimonial|review|social proof/.test(lower)) {
      ids = ["opening-scene", "conflict", "testimonial-scene", "closing-scene"].filter((id) => getSceneDesignTopic(id) || getStorytellingTopic(id));
      ids = ["opening-scene", "testimonial-scene", "demonstration-scene", "closing-scene"];
      sequenceName = "Testimonial Proof Sequence";
    } else if (/demo|demonstrat|how it works|feature/.test(lower)) {
      ids = ["opening-scene", "product-reveal-scene", "demonstration-scene", "closing-scene"];
      sequenceName = "Product Demo Sequence";
    } else if (/compar|versus|before.?after|vs\b/.test(lower)) {
      ids = ["opening-scene", "comparison-scene", "demonstration-scene", "closing-scene"];
      sequenceName = "Comparison Sequence";
    } else if (/product|launch|reveal|ecommerce/.test(lower)) {
      ids = ["opening-scene", "product-reveal-scene", "hero-scene", "demonstration-scene", "closing-scene"];
      sequenceName = "Product Launch Sequence";
    }
    const scenes = ids
      .map((id) => getSceneDesignTopic(id))
      .filter((t): t is ProfessionalStorytellingSceneTopic => Boolean(t))
      .map((t) => ({
        name: t.name,
        purpose: t.purpose,
        timingHint: t.workflow[0] ?? t.whenToUse[0] ?? "Time to purpose",
      }));
    if (!scenes.length) {
      return {
        available: false,
        sequenceName: query,
        scenes: [],
        reason: `No scene sequence matches "${query}".`,
        knowledgeIds: [],
        confidenceScore: 0,
      };
    }
    return {
      available: true,
      sequenceName,
      scenes,
      reason: `Recommended ${sequenceName} for: ${query}. Each scene has one purpose and hands off to the next.`,
      knowledgeIds: ids.map((id) => getSceneDesignTopic(id)?.knowledgeId).filter((id): id is string => Boolean(id)),
      confidenceScore: 91,
    };
  }

  recommendEmotionalFlow(query: string): EmotionalFlowRecommendation {
    this.ensureStarted();
    const emotion = getStorytellingTopic("emotional-journey")!;
    const conflict = getStorytellingTopic("conflict")!;
    const resolution = getStorytellingTopic("resolution")!;
    const luxury = /luxur|premium|night|drama/i.test(query);
    const friendly = /friend|cheer|family|warm|happy/i.test(query);
    const stages = luxury
      ? ["Intrigue", "Desire", "Exclusivity", "Confidence", "Action"]
      : friendly
        ? ["Warmth", "Recognition", "Relief", "Belonging", "Share/CTA"]
        : ["Curiosity", "Tension", "Insight", "Relief", "Desire", "Confidence"];
    return {
      available: true,
      flowName: luxury ? "Premium Desire Flow" : friendly ? "Warm Belonging Flow" : "Classic Persuasion Flow",
      stages,
      reason: `${emotion.purpose} Conflict (${conflict.name}) creates tension; resolution (${resolution.name}) releases into action. Tuned for: ${query || "general commercial"}.`,
      knowledgeIds: [emotion.knowledgeId, conflict.knowledgeId, resolution.knowledgeId],
      confidenceScore: emotion.confidenceScore,
    };
  }

  recommendSceneLayout(query: string): SceneLayoutRecommendation {
    this.ensureStarted();
    const matches = findSceneDesignTopics(query);
    const primary = matches[0] ?? getSceneDesignTopic("scene-composition");
    if (!primary) {
      return {
        available: false,
        sceneName: query,
        layoutGuidance: [],
        purpose: "",
        reason: `No scene layout matches "${query}".`,
        knowledgeIds: [],
        confidenceScore: 0,
      };
    }
    const composition = getSceneDesignTopic("scene-composition");
    const environment = getSceneDesignTopic("environment-design");
    const props = getSceneDesignTopic("props-selection");
    const bg = getSceneDesignTopic("background-selection");
    return {
      available: true,
      sceneName: primary.name,
      layoutGuidance: unique([
        ...primary.bestPractices,
        ...(composition?.bestPractices.slice(0, 2) ?? []),
        ...(environment?.bestPractices.slice(0, 1) ?? []),
        ...(props?.bestPractices.slice(0, 1) ?? []),
        ...(bg?.bestPractices.slice(0, 1) ?? []),
      ]).slice(0, 8),
      purpose: primary.purpose,
      reason: `${primary.professionalDefinition} Selected for: ${query}.`,
      knowledgeIds: unique(
        [primary.knowledgeId, composition?.knowledgeId, environment?.knowledgeId, props?.knowledgeId, bg?.knowledgeId].filter(
          (id): id is string => Boolean(id)
        )
      ),
      confidenceScore: primary.confidenceScore,
    };
  }

  explain(query: string): StorytellingExplainResult {
    this.ensureStarted();
    const storytelling = findStorytellingTopics(query)[0];
    const sceneTopic = findSceneDesignTopics(query)[0];
    const preferStory =
      storytelling && (!sceneTopic || scoreName(query, storytelling.name) >= scoreName(query, sceneTopic.name));
    const topic = preferStory ? storytelling : sceneTopic;
    if (!topic) {
      return {
        available: false,
        knowledgeId: null,
        title: query,
        explanation: `No professional storytelling/scene knowledge matches "${query}".`,
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
      kind: topic.metadata.category === "professional-storytelling" ? "storytelling" : "scene-design",
    };
  }

  answer(question: string): { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } {
    this.ensureStarted();
    const lower = question.toLowerCase();
    if (/structure|three.?act|build.*(story|narrative)|story arc/.test(lower)) {
      const structure = this.buildStoryStructure(question);
      return {
        available: true,
        answer: `${structure.reason} Acts: ${structure.acts.map((a) => a.name).join(" → ")}. CTA: ${structure.ctaPlacement}`,
        knowledgeIds: structure.knowledgeIds,
        confidenceScore: structure.confidenceScore,
      };
    }
    if (/scene sequence|sequence of scenes|which scenes|scene order/.test(lower)) {
      const seq = this.recommendSceneSequence(question);
      if (seq.available) {
        return {
          available: true,
          answer: `${seq.reason} Sequence: ${seq.scenes.map((s) => s.name).join(" → ")}.`,
          knowledgeIds: seq.knowledgeIds,
          confidenceScore: seq.confidenceScore,
        };
      }
    }
    if (/emotion|feeling|mood arc|emotional/.test(lower)) {
      const flow = this.recommendEmotionalFlow(question);
      return {
        available: true,
        answer: `${flow.reason} Stages: ${flow.stages.join(" → ")}.`,
        knowledgeIds: flow.knowledgeIds,
        confidenceScore: flow.confidenceScore,
      };
    }
    if (/layout|staging|block|props|background|environment/.test(lower)) {
      const layout = this.recommendSceneLayout(question);
      if (layout.available) {
        return {
          available: true,
          answer: `${layout.reason} Guidance: ${layout.layoutGuidance.slice(0, 3).join("; ")}.`,
          knowledgeIds: layout.knowledgeIds,
          confidenceScore: layout.confidenceScore,
        };
      }
    }
    const explained = this.explain(question);
    if (!explained.available || !explained.knowledgeId) {
      return {
        available: false,
        answer: `No validated storytelling/scene knowledge answers "${question}".`,
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

  getAiMeAwareness(): AiMeStorytellingSceneAwareness {
    this.ensureStarted();
    const all = [...PROFESSIONAL_STORYTELLING_TOPICS, ...PROFESSIONAL_SCENE_DESIGN_TOPICS];
    let storytellingDomainReady = false;
    let sceneDomainReady = false;
    try {
      storytellingDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(STORYTELLING_DOMAIN_ID)?.metadata.contentReady === true;
      sceneDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(SCENE_DOMAIN_ID)?.metadata.contentReady === true;
    } catch {
      /* optional */
    }
    return {
      canBuildStoryStructures: true,
      canRecommendSceneSequences: true,
      canExplainStorytellingDecisions: true,
      canRecommendEmotionalFlow: true,
      canRecommendSceneLayouts: true,
      canAnswerQuestions: true,
      storytellingTopicCount: PROFESSIONAL_STORYTELLING_TOPICS.length,
      sceneTopicCount: PROFESSIONAL_SCENE_DESIGN_TOPICS.length,
      relationshipCount: this.relationshipCount,
      averageConfidence: average(all.map((t) => t.confidenceScore)),
      averageQuality: average(all.map((t) => t.qualityScore)),
      storytellingDomainReady,
      sceneDomainReady,
      summary:
        `Professional Storytelling & Scene Design Knowledge Expansion Step 4 is active with ${PROFESSIONAL_STORYTELLING_TOPICS.length} storytelling and ${PROFESSIONAL_SCENE_DESIGN_TOPICS.length} scene design topics. ` +
        `AI Me can build story structures, recommend scene sequences and layouts, recommend emotional flow, explain decisions, and answer professional questions. ` +
        `Animation, Motion & Rendering specialty expansion is not started.`,
    };
  }

  async runHealthCheck(): Promise<StorytellingSceneHealthReport> {
    this.ensureStarted();
    const missingConcepts: string[] = [];
    const missingStoryStructureConcepts: string[] = [];
    const brokenSceneRelationships: string[] = [];
    const duplicateKnowledge: string[] = [];
    const consistencyIssues: string[] = [];
    const issues: string[] = [];
    const foundation = this.foundation!;

    for (const topic of [...PROFESSIONAL_STORYTELLING_TOPICS, ...PROFESSIONAL_SCENE_DESIGN_TOPICS]) {
      for (const field of ["name", "description", "purpose", "professionalDefinition"] as const) {
        if (!topic[field]?.trim()) missingConcepts.push(`${topic.topicId}:${field}`);
      }
      for (const list of [
        "whenToUse",
        "whenNotToUse",
        "bestPractices",
        "commonMistakes",
        "workflow",
        "professionalExamples",
        "keywords",
        "relatedTopics",
      ] as const) {
        if (!topic[list].length) missingConcepts.push(`${topic.topicId}:${list}`);
      }
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, STORYTELLING_SCENE_KNOWLEDGE_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topic.topicId}:not-persisted`);
    }

    for (const concept of REQUIRED_STORY_STRUCTURE_CONCEPTS) {
      if (!getStorytellingTopic(concept)) missingStoryStructureConcepts.push(concept);
    }

    for (const topic of [...PROFESSIONAL_STORYTELLING_TOPICS, ...PROFESSIONAL_SCENE_DESIGN_TOPICS]) {
      for (const related of topic.relatedTopics) {
        if (!getStorytellingSceneTopic(related)) {
          brokenSceneRelationships.push(`${topic.topicId}→missing ${related}`);
        }
      }
      for (const domainId of topic.relatedDomains) {
        if (!STORYTELLING_SCENE_DOMAIN_BRIDGES.some((b) => b.domainId === domainId)) {
          brokenSceneRelationships.push(`${topic.topicId}→missing bridge ${domainId}`);
        }
      }
    }

    const seen = new Map<string, string>();
    for (const topic of [...PROFESSIONAL_STORYTELLING_TOPICS, ...PROFESSIONAL_SCENE_DESIGN_TOPICS]) {
      const key = topic.name.toLowerCase();
      if (seen.has(key)) duplicateKnowledge.push(`${topic.knowledgeId} duplicates ${seen.get(key)}`);
      else seen.set(key, topic.knowledgeId);
      if (topic.metadata.expansionStep !== 4) consistencyIssues.push(`${topic.topicId}:bad-expansion-step`);
      if (topic.metadata.generatesVideo !== false) consistencyIssues.push(`${topic.topicId}:generates-video`);
      if (topic.confidenceScore < 70 || topic.qualityScore < 70) consistencyIssues.push(`${topic.topicId}:low-scores`);
    }

    // Scene topics that reference storytelling must resolve
    for (const sceneTopic of PROFESSIONAL_SCENE_DESIGN_TOPICS) {
      for (const related of sceneTopic.relatedTopics) {
        const target = getStorytellingSceneTopic(related);
        if (!target) brokenSceneRelationships.push(`scene-rel:${sceneTopic.topicId}→${related}`);
      }
    }

    const completenessScore = Math.max(
      0,
      100 -
        missingConcepts.length * 5 -
        missingStoryStructureConcepts.length * 4 -
        brokenSceneRelationships.length * 4 -
        duplicateKnowledge.length * 10 -
        consistencyIssues.length * 3
    );
    const healthy =
      missingConcepts.length === 0 &&
      missingStoryStructureConcepts.length === 0 &&
      brokenSceneRelationships.length === 0 &&
      duplicateKnowledge.length === 0 &&
      consistencyIssues.length === 0;
    if (!healthy) {
      issues.push(...missingConcepts.map((i) => `missing:${i}`));
      issues.push(...missingStoryStructureConcepts.map((i) => `story-structure:${i}`));
      issues.push(...brokenSceneRelationships.map((i) => `relationship:${i}`));
      issues.push(...duplicateKnowledge.map((i) => `duplicate:${i}`));
      issues.push(...consistencyIssues.map((i) => `consistency:${i}`));
    }

    this.lastHealth = {
      healthy,
      completenessScore,
      missingConcepts,
      missingStoryStructureConcepts,
      brokenSceneRelationships,
      duplicateKnowledge,
      consistencyIssues,
      issues,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<StorytellingSceneRepairResult> {
    this.ensureStarted();
    const actions: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured professional-storytelling-scene directory.");
    const before = await this.runHealthCheck();
    if (!before.healthy) {
      const reinstall = await this.installOrUpgrade();
      actions.push(
        `Reinstalled/upgraded (story ${reinstall.storytellingInstalled}/${reinstall.storytellingUpdated}; scene ${reinstall.sceneInstalled}/${reinstall.sceneUpdated}; rel=${reinstall.relationshipsCreated}).`
      );
      if (reinstall.storytellingPackSynced) actions.push("Synced storytelling pack.");
      if (reinstall.scenePackSynced) actions.push("Synced scene pack.");
      if (reinstall.domainsMarkedReady) actions.push("Marked storytelling/scene domains contentReady.");
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

  private async persistTopic(topic: ProfessionalStorytellingSceneTopic): Promise<"installed" | "updated" | "failed"> {
    const foundation = this.foundation!;
    const relatedKnowledge = unique([
      ...topic.relatedTopics.map((id) => getStorytellingSceneTopic(id)?.knowledgeId ?? id),
      ...topic.relatedDomains.map((id) => `ss-bridge-${id}`),
    ]).filter((id) => id !== topic.knowledgeId);
    const structured = topicToStructured(topic);
    const payload = {
      step: "knowledge-expansion-storytelling-scene",
      expansionVersion: PROFESSIONAL_STORYTELLING_SCENE_VERSION,
      topicId: topic.topicId,
      kind: topic.metadata.category,
      purpose: topic.purpose,
      professionalDefinition: topic.professionalDefinition,
      whenToUse: topic.whenToUse,
      whenNotToUse: topic.whenNotToUse,
      workflow: topic.workflow,
      knowledgeItem: topicToItem(topic),
      structuredKnowledge: structured,
      metadata: topic.metadata,
      generatesVideo: false,
      professionalTechniques: topic.bestPractices,
      bestPractices: topic.bestPractices,
      decisionRules: [
        ...topic.whenToUse.map((w) => `Use when: ${w}`),
        ...topic.whenNotToUse.map((w) => `Do not use when: ${w}`),
      ],
    };
    const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, STORYTELLING_SCENE_KNOWLEDGE_SOURCE);
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
        STORYTELLING_SCENE_KNOWLEDGE_SOURCE
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
        source: STORYTELLING_SCENE_KNOWLEDGE_SOURCE,
        sourceReliability: 95,
        confidenceScore: topic.confidenceScore,
        qualityScore: topic.qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge,
        payload,
      },
      STORYTELLING_SCENE_KNOWLEDGE_SOURCE
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
      resourceIds: existing?.resourceIds ?? ["professional-storytelling-scene-expansion"],
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
      throw new ProfessionalStorytellingSceneError(
        "Professional Storytelling & Scene Design Knowledge is not initialized",
        "NOT_INITIALIZED"
      );
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalStorytellingSceneError(
        "Professional Storytelling & Scene Design Knowledge startup is incomplete",
        "NOT_STARTED"
      );
    }
  }
}

function topicToItem(topic: ProfessionalStorytellingSceneTopic): KnowledgeItem {
  return {
    knowledgeId: topic.knowledgeId,
    title: topic.name,
    domain: topic.metadata.domainId,
    category: topic.metadata.category,
    description: topic.description,
    coreConcepts: topic.keywords.slice(0, 8),
    definitions: [topic.professionalDefinition, topic.purpose],
    rules: [
      ...topic.whenToUse.map((w) => `Use when: ${w}`),
      ...topic.whenNotToUse.map((w) => `Do not use when: ${w}`),
    ],
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.workflow,
    workflow: topic.workflow,
    decisionRules: [
      ...topic.whenToUse.map((w) => `Use when: ${w}`),
      ...topic.whenNotToUse.map((w) => `Avoid when: ${w}`),
    ],
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
        name: "KWIZERA Professional Storytelling & Scene Design Expansion",
        type: "curated-professional",
        reference: `expansion-step-4:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function topicToStructured(topic: ProfessionalStorytellingSceneTopic): StructuredKnowledge {
  return {
    title: topic.name,
    category: topic.metadata.category,
    domain: topic.metadata.domainId,
    description: topic.description,
    sections: [
      { title: "Professional Definition", kind: "guidance", items: [topic.professionalDefinition] },
      { title: "Purpose", kind: "guidance", items: [topic.purpose] },
      { title: "When to Use", kind: "guidance", items: topic.whenToUse },
      { title: "When Not to Use", kind: "rules", items: topic.whenNotToUse },
      { title: "Workflow", kind: "workflow", items: topic.workflow },
      { title: "Best Practices", kind: "guidance", items: topic.bestPractices },
      { title: "Examples", kind: "examples", items: topic.professionalExamples },
    ],
    concepts: topic.keywords,
    entities: [topic.name, ...topic.relatedDomains],
    terminology: topic.keywords,
    rules: topic.whenNotToUse.map((w) => `Avoid when: ${w}`),
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.workflow,
    examples: topic.professionalExamples,
    commonMistakes: topic.commonMistakes,
    qualityRules: [],
    decisionRules: [
      ...topic.whenToUse.map((w) => `Use when: ${w}`),
      ...topic.whenNotToUse.map((w) => `Do not use when: ${w}`),
    ],
    workflowSteps: topic.workflow,
    prerequisites: [],
    dependencies: topic.relatedDomains,
    relatedKnowledge: topic.relatedTopics.map((id) => getStorytellingSceneTopic(id)?.knowledgeId ?? id),
    definitions: [topic.professionalDefinition, topic.purpose],
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Storytelling & Scene Design Expansion",
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
    decisionRules: [`Relate storytelling/scene knowledge to ${domain}.`],
    workflowSteps: [],
    prerequisites: [],
    dependencies: [],
    relatedKnowledge: ["story-storytelling-fundamentals"],
    difficultyLevel: "foundation",
    confidenceScore: 85,
    sourceMetadata: [
      { name: "KWIZERA Professional Storytelling & Scene Design Expansion", type: "curated", reliability: 95 },
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
    category: domain.includes("scene") ? "professional-scene-design" : "professional-storytelling",
    domain,
    description: "Curated professional storytelling/scene design knowledge for AI Me (not video generation).",
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
    prerequisites: ["Define audience desire and conflict before designing scenes."],
    dependencies: ["video-production-knowledge", "marketing-knowledge", "branding-knowledge"],
    relatedKnowledge: items.map((i) => i.knowledgeId),
    difficultyLevel: "advanced",
    confidenceScore: average(items.map((i) => i.confidenceScore)),
    sourceMetadata: [
      {
        name: "KWIZERA Professional Storytelling & Scene Design Expansion",
        type: "curated-professional",
        reliability: 95,
      },
    ],
  };
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
