/**
 * Professional Camera & Camera Movement Knowledge — Expansion Step 2 installer.
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
  CAMERA_DOMAIN_BRIDGES,
  findCameraMovementTopics,
  findCameraSettingTopics,
  getCameraMovementTopic,
  getCameraSettingTopic,
  PROFESSIONAL_CAMERA_MOVEMENT_TOPICS,
  PROFESSIONAL_CAMERA_SETTING_TOPICS,
  REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS,
  REQUIRED_CAMERA_SETTING_TOPIC_IDS,
  REQUIRED_CAMERA_TERMINOLOGY,
} from "./professional-camera-knowledge-catalog.js";
import {
  CAMERA_DOMAIN_ID,
  CAMERA_KNOWLEDGE_SOURCE,
  CAMERA_MOVEMENT_DOMAIN_ID,
  PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION,
  ProfessionalCameraKnowledgeError,
  type AiMeCameraKnowledgeAwareness,
  type CameraKnowledgeExplainResult,
  type CameraKnowledgeHealthReport,
  type CameraKnowledgeInstallResult,
  type CameraKnowledgeRepairResult,
  type CameraMovementCompareResult,
  type CameraMovementRecommendation,
  type CameraSettingsRecommendation,
  type ProfessionalCameraMovementTopic,
  type ProfessionalCameraSettingTopic,
} from "./professional-camera-knowledge-types.js";

export class ProfessionalCameraKnowledge {
  private foundation: AiKnowledgeFoundation | null = null;
  private metaRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly packStore = new KnowledgePackStore();
  private lastInstall: CameraKnowledgeInstallResult | null = null;
  private lastHealth: CameraKnowledgeHealthReport | null = null;
  private lastRepair: CameraKnowledgeRepairResult | null = null;
  private relationshipCount = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.metaRoot = path.join(storageRoot, "knowledge", "videos", "professional-camera");
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

  listSettingTopics(): ProfessionalCameraSettingTopic[] {
    return PROFESSIONAL_CAMERA_SETTING_TOPICS.map((t) => structuredClone(t));
  }

  listMovementTopics(): ProfessionalCameraMovementTopic[] {
    return PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.map((t) => structuredClone(t));
  }

  getLastInstall(): CameraKnowledgeInstallResult | null {
    return this.lastInstall ? structuredClone(this.lastInstall) : null;
  }

  getLastHealth(): CameraKnowledgeHealthReport | null {
    return this.lastHealth ? structuredClone(this.lastHealth) : null;
  }

  async installOrUpgrade(): Promise<CameraKnowledgeInstallResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const issues: string[] = [];
    let settingsInstalled = 0;
    let settingsUpdated = 0;
    let movementsInstalled = 0;
    let movementsUpdated = 0;
    let bridgesInstalled = 0;
    let relationshipsCreated = 0;

    for (const topic of PROFESSIONAL_CAMERA_SETTING_TOPICS) {
      const result = await this.persistSetting(topic);
      if (result === "installed") settingsInstalled += 1;
      else if (result === "updated") settingsUpdated += 1;
      else issues.push(`Failed setting ${topic.knowledgeId}`);
    }

    for (const topic of PROFESSIONAL_CAMERA_MOVEMENT_TOPICS) {
      const result = await this.persistMovement(topic);
      if (result === "installed") movementsInstalled += 1;
      else if (result === "updated") movementsUpdated += 1;
      else issues.push(`Failed movement ${topic.knowledgeId}`);
    }

    for (const bridge of CAMERA_DOMAIN_BRIDGES) {
      const existing = await foundation.getStorageEngine().getRecord(bridge.knowledgeId, CAMERA_KNOWLEDGE_SOURCE);
      const payload = {
        step: "knowledge-expansion-camera",
        bridgeDomainId: bridge.domainId,
        relationshipAnchor: true,
        generatesVideo: false,
        professionalTechniques: [],
        bestPractices: [],
        decisionRules: [`Relate camera knowledge to ${bridge.domainId}.`],
        structuredKnowledge: bridgeStructured(bridge.title, bridge.domainId, bridge.description),
      };
      if (existing.success && existing.record) {
        await foundation.getStorageEngine().updateRecord(
          bridge.knowledgeId,
          {
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["camera", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "camera", "relationship"],
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["cam-camera-fundamentals"],
            payload,
          },
          CAMERA_KNOWLEDGE_SOURCE
        );
      } else {
        const write = await foundation.getStorageEngine().storeRecord(
          {
            knowledgeId: bridge.knowledgeId,
            knowledgeType: KnowledgeStorageType.Video,
            category: "camera-domain-bridge",
            title: bridge.title,
            description: bridge.description,
            summary: bridge.relationshipEvidence,
            tags: ["camera", "domain-bridge", bridge.domainId],
            keywords: [bridge.domainId, "camera", "relationship"],
            source: CAMERA_KNOWLEDGE_SOURCE,
            sourceReliability: 90,
            confidenceScore: 85,
            qualityScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
            status: KnowledgeRecordStatus.Verified,
            relatedKnowledge: ["cam-camera-fundamentals"],
            payload,
          },
          CAMERA_KNOWLEDGE_SOURCE
        );
        if (write.success) bridgesInstalled += 1;
        else issues.push(`Failed bridge ${bridge.knowledgeId}`);
      }
    }

    const allIds = [
      ...PROFESSIONAL_CAMERA_SETTING_TOPICS.map((t) => t.knowledgeId),
      ...PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.map((t) => t.knowledgeId),
      ...CAMERA_DOMAIN_BRIDGES.map((b) => b.knowledgeId),
    ];
    for (const id of allIds) {
      try {
        foundation.getRetrievalEngine().invalidateCache(id);
        await foundation.getGraphEngine().evolveGraph(id);
      } catch (error) {
        issues.push(`Graph evolve failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const cameraHub = "cam-bridge-camera-knowledge";
    const movementHub = "cam-bridge-camera-movement-knowledge";
    for (const bridge of CAMERA_DOMAIN_BRIDGES) {
      if (bridge.knowledgeId === cameraHub) continue;
      relationshipsCreated += await this.tryRelate(
        cameraHub,
        bridge.knowledgeId,
        KnowledgeRelationType.RelatedTo,
        bridge.relationshipEvidence
      );
    }
    relationshipsCreated += await this.tryRelate(
      cameraHub,
      movementHub,
      KnowledgeRelationType.Child,
      "Camera movement knowledge is a child specialty of camera knowledge."
    );

    for (const topic of PROFESSIONAL_CAMERA_SETTING_TOPICS) {
      for (const related of topic.relatedTopics) {
        const target =
          getCameraSettingTopic(related)?.knowledgeId ?? getCameraMovementTopic(related)?.knowledgeId;
        if (!target) continue;
        relationshipsCreated += await this.tryRelate(
          topic.knowledgeId,
          target,
          KnowledgeRelationType.RelatedTo,
          `${topic.title} relates to ${related}.`
        );
      }
      for (const domainId of topic.relatedDomains) {
        relationshipsCreated += await this.tryRelate(
          topic.knowledgeId,
          `cam-bridge-${domainId}`,
          KnowledgeRelationType.DependsOn,
          `${topic.title} depends on domain ${domainId}.`
        );
      }
    }

    for (const topic of PROFESSIONAL_CAMERA_MOVEMENT_TOPICS) {
      for (const related of topic.relatedTopics) {
        const target = getCameraMovementTopic(related)?.knowledgeId;
        if (!target) continue;
        relationshipsCreated += await this.tryRelate(
          topic.knowledgeId,
          target,
          KnowledgeRelationType.RelatedTo,
          `${topic.name} relates to ${related}.`
        );
      }
      for (const settingId of topic.relatedCameraSettings) {
        const target = getCameraSettingTopic(settingId)?.knowledgeId;
        if (!target) continue;
        relationshipsCreated += await this.tryRelate(
          topic.knowledgeId,
          target,
          KnowledgeRelationType.Requires,
          `${topic.name} relates to camera setting ${settingId}.`
        );
      }
      for (const domainId of topic.relatedDomains) {
        relationshipsCreated += await this.tryRelate(
          topic.knowledgeId,
          `cam-bridge-${domainId}`,
          KnowledgeRelationType.DependsOn,
          `${topic.name} depends on domain ${domainId}.`
        );
      }
    }

    this.relationshipCount = relationshipsCreated;

    let cameraPackSynced = false;
    let movementPackSynced = false;
    try {
      cameraPackSynced = await this.syncPack(
        "camera",
        CAMERA_DOMAIN_ID,
        "Professional Camera Knowledge Pack",
        PROFESSIONAL_CAMERA_SETTING_TOPICS.map((t) => settingToItem(t))
      );
    } catch (error) {
      issues.push(`Camera pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      movementPackSynced = await this.syncPack(
        "camera-movement",
        CAMERA_MOVEMENT_DOMAIN_ID,
        "Professional Camera Movement Knowledge Pack",
        PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.map((t) => movementToItem(t))
      );
    } catch (error) {
      issues.push(`Movement pack sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let domainsMarkedReady = false;
    try {
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(CAMERA_DOMAIN_ID, true);
      foundation.getKnowledgeDomainPlanner().markDomainContentReady(CAMERA_MOVEMENT_DOMAIN_ID, true);
      domainsMarkedReady = true;
    } catch (error) {
      issues.push(`Domain mark ready failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const result: CameraKnowledgeInstallResult = {
      installed:
        settingsInstalled + settingsUpdated >= PROFESSIONAL_CAMERA_SETTING_TOPICS.length &&
        movementsInstalled + movementsUpdated >= PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.length &&
        issues.filter((i) => i.startsWith("Failed")).length === 0,
      settingsInstalled,
      settingsUpdated,
      movementsInstalled,
      movementsUpdated,
      bridgesInstalled,
      relationshipsCreated,
      cameraPackSynced,
      movementPackSynced,
      domainsMarkedReady,
      issues,
    };
    this.lastInstall = result;
    await this.persistMeta(result);
    return structuredClone(result);
  }

  recommendMovement(query: string): CameraMovementRecommendation {
    this.ensureStarted();
    const matches = findCameraMovementTopics(query);
    const primary = matches[0];
    if (!primary) {
      return {
        available: false,
        movementId: null,
        name: query,
        reason: `No camera movement matches "${query}".`,
        whenToUse: [],
        relatedSettings: [],
        confidenceScore: 0,
        alternatives: [],
      };
    }
    return {
      available: true,
      movementId: primary.knowledgeId,
      name: primary.name,
      reason: `${primary.purpose} Selected because it best matches: ${query}. ${primary.whenToUse[0] ?? ""}`,
      whenToUse: primary.whenToUse,
      relatedSettings: primary.relatedCameraSettings,
      confidenceScore: primary.confidenceScore,
      alternatives: matches.slice(1, 3).map((m) => ({
        name: m.name,
        reason: m.purpose,
      })),
    };
  }

  recommendSettings(query: string): CameraSettingsRecommendation {
    this.ensureStarted();
    const matches = findCameraSettingTopics(query);
    const primary = matches[0] ?? getCameraSettingTopic("camera-fundamentals");
    if (!primary) {
      return {
        available: false,
        topicId: null,
        title: query,
        settingsGuidance: [],
        decisionRules: [],
        confidenceScore: 0,
      };
    }
    return {
      available: true,
      topicId: primary.topicId,
      title: primary.title,
      settingsGuidance: [...primary.bestPractices, ...primary.professionalWorkflow].slice(0, 6),
      decisionRules: primary.decisionRules,
      confidenceScore: primary.confidenceScore,
    };
  }

  compareMovements(aQuery: string, bQuery: string): CameraMovementCompareResult {
    this.ensureStarted();
    const aMatches = findCameraMovementTopics(aQuery);
    const bMatches = findCameraMovementTopics(bQuery);
    let a = aMatches[0];
    let b = bMatches[0];
    if (a && b && a.topicId === b.topicId) {
      b = bMatches.find((item) => item.topicId !== a!.topicId) ?? findCameraMovementTopics(bQuery).find((item) => item.topicId !== a!.topicId);
      a = aMatches.find((item) => item.topicId !== b?.topicId) ?? a;
    }
    if (!a || !b || a.topicId === b.topicId) {
      return {
        movementA: aQuery,
        movementB: bQuery,
        similarities: [],
        differences: [],
        recommendation: "Both queries must resolve to distinct known camera movements.",
        confidenceScore: 0,
      };
    }
    const sharedSettings = a.relatedCameraSettings.filter((s) => b.relatedCameraSettings.includes(s));
    return {
      movementA: a.name,
      movementB: b.name,
      similarities: [
        ...sharedSettings.map((s) => `Shared related setting: ${s}`),
        "Both are curated professional camera movement techniques.",
      ],
      differences: [
        `Purpose — ${a.name}: ${a.purpose}`,
        `Purpose — ${b.name}: ${b.purpose}`,
        `Avoid ${a.name} when: ${a.whenNotToUse[0] ?? "n/a"}`,
        `Avoid ${b.name} when: ${b.whenNotToUse[0] ?? "n/a"}`,
      ],
      recommendation: `Use ${a.name} when ${a.whenToUse[0]?.toLowerCase() ?? "its purpose fits"}; use ${b.name} when ${b.whenToUse[0]?.toLowerCase() ?? "its purpose fits"}.`,
      confidenceScore: Math.round((a.confidenceScore + b.confidenceScore) / 2),
    };
  }

  explain(query: string): CameraKnowledgeExplainResult {
    this.ensureStarted();
    const movement = findCameraMovementTopics(query)[0];
    const setting = findCameraSettingTopics(query)[0];
    if (movement && (!setting || scoreName(query, movement.name) >= scoreName(query, setting.title))) {
      return {
        available: true,
        knowledgeId: movement.knowledgeId,
        title: movement.name,
        explanation: `${movement.description} Purpose: ${movement.purpose}`,
        bestPractices: movement.bestPractices,
        confidenceScore: movement.confidenceScore,
        qualityScore: movement.qualityScore,
        kind: "movement",
      };
    }
    if (setting) {
      return {
        available: true,
        knowledgeId: setting.knowledgeId,
        title: setting.title,
        explanation: `${setting.professionalDefinition} ${setting.description}`,
        bestPractices: setting.bestPractices,
        confidenceScore: setting.confidenceScore,
        qualityScore: setting.qualityScore,
        kind: "setting",
      };
    }
    return {
      available: false,
      knowledgeId: null,
      title: query,
      explanation: `No professional camera knowledge matches "${query}".`,
      bestPractices: [],
      confidenceScore: 0,
      qualityScore: 0,
      kind: "none",
    };
  }

  answer(question: string): { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } {
    this.ensureStarted();
    const lower = question.toLowerCase();
    if (/movement|pan|tilt|dolly|gimbal|handheld|orbit|tracking|follow|push|pull|reveal|angle|pov/.test(lower)) {
      const rec = this.recommendMovement(question);
      if (rec.available && rec.movementId) {
        const topic = getCameraMovementTopic(rec.movementId)!;
        return {
          available: true,
          answer: `${rec.reason} Best practice: ${topic.bestPractices[0]}. Avoid when: ${topic.whenNotToUse[0]}.`,
          knowledgeIds: [rec.movementId, ...rec.alternatives.map((a) => getCameraMovementTopic(a.name)?.knowledgeId).filter(Boolean) as string[]],
          confidenceScore: rec.confidenceScore,
        };
      }
    }
    const explained = this.explain(question);
    if (!explained.available || !explained.knowledgeId) {
      return {
        available: false,
        answer: `No validated professional camera knowledge answers "${question}".`,
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

  getAiMeAwareness(): AiMeCameraKnowledgeAwareness {
    this.ensureStarted();
    const allScores = [
      ...PROFESSIONAL_CAMERA_SETTING_TOPICS.map((t) => t.confidenceScore),
      ...PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.map((t) => t.confidenceScore),
    ];
    const allQuality = [
      ...PROFESSIONAL_CAMERA_SETTING_TOPICS.map((t) => t.qualityScore),
      ...PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.map((t) => t.qualityScore),
    ];
    let cameraDomainReady = false;
    let cameraMovementDomainReady = false;
    try {
      cameraDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(CAMERA_DOMAIN_ID)?.metadata.contentReady === true;
      cameraMovementDomainReady =
        this.foundation!.getKnowledgeDomainPlanner().getDomain(CAMERA_MOVEMENT_DOMAIN_ID)?.metadata.contentReady ===
        true;
    } catch {
      /* optional */
    }
    return {
      canRecommendMovement: true,
      canExplainMovementChoice: true,
      canRecommendSettings: true,
      canCompareMovements: true,
      canAnswerCameraQuestions: true,
      settingTopicCount: PROFESSIONAL_CAMERA_SETTING_TOPICS.length,
      movementTopicCount: PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.length,
      relationshipCount: this.relationshipCount,
      averageConfidence: average(allScores),
      averageQuality: average(allQuality),
      cameraDomainReady,
      cameraMovementDomainReady,
      summary:
        `Professional Camera & Camera Movement Knowledge Expansion Step 2 is active with ${PROFESSIONAL_CAMERA_SETTING_TOPICS.length} settings topics and ${PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.length} movements. ` +
        `AI Me can recommend movements, explain choices, recommend settings, compare moves, and answer camera questions. ` +
        `Lighting & Composition specialty expansion is not started.`,
    };
  }

  async runHealthCheck(): Promise<CameraKnowledgeHealthReport> {
    this.ensureStarted();
    const missingConcepts: string[] = [];
    const missingTerminology: string[] = [];
    const duplicateKnowledge: string[] = [];
    const brokenRelationships: string[] = [];
    const issues: string[] = [];
    const foundation = this.foundation!;

    for (const topicId of REQUIRED_CAMERA_SETTING_TOPIC_IDS) {
      const topic = getCameraSettingTopic(topicId);
      if (!topic) {
        missingConcepts.push(topicId);
        continue;
      }
      for (const field of ["professionalDefinition", "description", "title"] as const) {
        if (!topic[field]?.trim()) missingConcepts.push(`${topicId}:${field}`);
      }
      for (const list of ["bestPractices", "commonMistakes", "examples", "decisionRules", "keywords"] as const) {
        if (!topic[list].length) missingConcepts.push(`${topicId}:${list}`);
      }
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, CAMERA_KNOWLEDGE_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topicId}:not-persisted`);
    }

    for (const topicId of REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS) {
      const topic = getCameraMovementTopic(topicId);
      if (!topic) {
        missingConcepts.push(topicId);
        continue;
      }
      for (const field of ["name", "description", "purpose"] as const) {
        if (!topic[field]?.trim()) missingConcepts.push(`${topicId}:${field}`);
      }
      for (const list of [
        "whenToUse",
        "whenNotToUse",
        "advantages",
        "limitations",
        "bestPractices",
        "commonMistakes",
        "exampleUseCases",
        "relatedCameraSettings",
        "relatedStorytellingTechniques",
      ] as const) {
        if (!topic[list].length) missingConcepts.push(`${topicId}:${list}`);
      }
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, CAMERA_KNOWLEDGE_SOURCE);
      if (!read.success || !read.record) missingConcepts.push(`${topicId}:not-persisted`);
    }

    const catalogText = [
      ...PROFESSIONAL_CAMERA_SETTING_TOPICS.flatMap((t) => [t.title, ...t.keywords]),
      ...PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.flatMap((t) => [t.name, ...t.keywords]),
    ]
      .join(" ")
      .toLowerCase();
    for (const term of REQUIRED_CAMERA_TERMINOLOGY) {
      if (!catalogText.includes(term.replace(/-/g, " ")) && !catalogText.includes(term)) {
        // topic ids appear as keywords or titles via hyphen forms
        const compact = term.replace(/-/g, "");
        if (!catalogText.replace(/-/g, "").includes(compact) && !catalogText.includes(term)) {
          missingTerminology.push(term);
        }
      }
    }

    const seen = new Map<string, string>();
    for (const topic of [...PROFESSIONAL_CAMERA_SETTING_TOPICS, ...PROFESSIONAL_CAMERA_MOVEMENT_TOPICS]) {
      const title = "title" in topic ? topic.title : topic.name;
      const key = title.toLowerCase();
      const id = topic.knowledgeId;
      if (seen.has(key)) duplicateKnowledge.push(`${id} duplicates title of ${seen.get(key)}`);
      else seen.set(key, id);
    }

    for (const topic of PROFESSIONAL_CAMERA_SETTING_TOPICS) {
      for (const related of topic.relatedTopics) {
        if (!getCameraSettingTopic(related) && !getCameraMovementTopic(related)) {
          brokenRelationships.push(`${topic.topicId}→missing ${related}`);
        }
      }
      for (const domainId of topic.relatedDomains) {
        if (!CAMERA_DOMAIN_BRIDGES.some((b) => b.domainId === domainId)) {
          brokenRelationships.push(`${topic.topicId}→missing bridge ${domainId}`);
        }
      }
    }
    for (const topic of PROFESSIONAL_CAMERA_MOVEMENT_TOPICS) {
      for (const related of topic.relatedTopics) {
        if (!getCameraMovementTopic(related)) brokenRelationships.push(`${topic.topicId}→missing ${related}`);
      }
      for (const settingId of topic.relatedCameraSettings) {
        if (!getCameraSettingTopic(settingId)) brokenRelationships.push(`${topic.topicId}→missing setting ${settingId}`);
      }
      for (const domainId of topic.relatedDomains) {
        if (!CAMERA_DOMAIN_BRIDGES.some((b) => b.domainId === domainId)) {
          brokenRelationships.push(`${topic.topicId}→missing bridge ${domainId}`);
        }
      }
    }

    // Terminology check: topic ids count as present
    const presentIds = new Set([
      ...REQUIRED_CAMERA_SETTING_TOPIC_IDS,
      ...REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS,
    ]);
    const filteredMissingTerminology = missingTerminology.filter((term) => {
      if (presentIds.has(term as never)) return false;
      return true;
    });

    const completenessScore = Math.max(
      0,
      100 -
        missingConcepts.length * 5 -
        filteredMissingTerminology.length * 3 -
        duplicateKnowledge.length * 10 -
        brokenRelationships.length * 4
    );
    const healthy =
      missingConcepts.length === 0 &&
      filteredMissingTerminology.length === 0 &&
      duplicateKnowledge.length === 0 &&
      brokenRelationships.length === 0;
    if (!healthy) {
      issues.push(...missingConcepts.map((i) => `missing:${i}`));
      issues.push(...filteredMissingTerminology.map((i) => `terminology:${i}`));
      issues.push(...duplicateKnowledge.map((i) => `duplicate:${i}`));
      issues.push(...brokenRelationships.map((i) => `relationship:${i}`));
    }

    this.lastHealth = {
      healthy,
      completenessScore,
      missingConcepts,
      missingTerminology: filteredMissingTerminology,
      duplicateKnowledge,
      brokenRelationships,
      issues,
    };
    return structuredClone(this.lastHealth);
  }

  async repair(): Promise<CameraKnowledgeRepairResult> {
    this.ensureStarted();
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    await fs.mkdir(this.metaRoot, { recursive: true });
    actions.push("Ensured professional-camera directory.");

    const before = await this.runHealthCheck();
    if (!before.healthy) {
      const reinstall = await this.installOrUpgrade();
      actions.push(
        `Reinstalled/upgraded (settings new=${reinstall.settingsInstalled} upd=${reinstall.settingsUpdated}; movements new=${reinstall.movementsInstalled} upd=${reinstall.movementsUpdated}; rel=${reinstall.relationshipsCreated}).`
      );
      if (reinstall.cameraPackSynced) actions.push("Synced camera pack.");
      if (reinstall.movementPackSynced) actions.push("Synced camera-movement pack.");
      if (reinstall.domainsMarkedReady) actions.push("Marked camera domains contentReady.");
    } else {
      actions.push("Health already clean; skipped reinstall.");
    }

    const health = await this.runHealthCheck();
    remainingIssues.push(...health.issues);
    const repair = { repaired: remainingIssues.length === 0, actions: unique(actions), remainingIssues };
    this.lastRepair = repair;
    return structuredClone(repair);
  }

  private async persistSetting(topic: ProfessionalCameraSettingTopic): Promise<"installed" | "updated" | "failed"> {
    const foundation = this.foundation!;
    const relatedKnowledge = unique([
      ...topic.relatedTopics.map((id) => getCameraSettingTopic(id)?.knowledgeId ?? getCameraMovementTopic(id)?.knowledgeId ?? `cam-${id}`),
      ...topic.relatedDomains.map((id) => `cam-bridge-${id}`),
    ]).filter((id) => id !== topic.knowledgeId);
    const structured = settingToStructured(topic);
    const payload = {
      step: "knowledge-expansion-camera",
      expansionVersion: PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION,
      topicId: topic.topicId,
      kind: "camera-setting",
      professionalDefinition: topic.professionalDefinition,
      knowledgeItem: settingToItem(topic),
      structuredKnowledge: structured,
      metadata: topic.metadata,
      generatesVideo: false,
      professionalTechniques: topic.professionalWorkflow,
      bestPractices: topic.bestPractices,
      decisionRules: topic.decisionRules,
    };
    const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, CAMERA_KNOWLEDGE_SOURCE);
    if (existing.success && existing.record) {
      const write = await foundation.getStorageEngine().updateRecord(
        topic.knowledgeId,
        {
          title: topic.title,
          description: topic.description,
          summary: topic.professionalDefinition,
          tags: unique(["camera", "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
          keywords: topic.keywords,
          confidenceScore: topic.confidenceScore,
          qualityScore: topic.qualityScore,
          verificationStatus: KnowledgeVerificationStatus.Verified,
          status: KnowledgeRecordStatus.Verified,
          relatedKnowledge,
          payload,
        },
        CAMERA_KNOWLEDGE_SOURCE
      );
      return write.success ? "updated" : "failed";
    }
    const write = await foundation.getStorageEngine().storeRecord(
      {
        knowledgeId: topic.knowledgeId,
        knowledgeType: KnowledgeStorageType.Video,
        category: "professional-camera-settings",
        title: topic.title,
        description: topic.description,
        summary: topic.professionalDefinition,
        tags: unique(["camera", "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
        keywords: topic.keywords,
        source: CAMERA_KNOWLEDGE_SOURCE,
        sourceReliability: 95,
        confidenceScore: topic.confidenceScore,
        qualityScore: topic.qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge,
        payload,
      },
      CAMERA_KNOWLEDGE_SOURCE
    );
    return write.success ? "installed" : "failed";
  }

  private async persistMovement(topic: ProfessionalCameraMovementTopic): Promise<"installed" | "updated" | "failed"> {
    const foundation = this.foundation!;
    const relatedKnowledge = unique([
      ...topic.relatedTopics.map((id) => `cmov-${id}`),
      ...topic.relatedCameraSettings.map((id) => `cam-${id}`),
      ...topic.relatedDomains.map((id) => `cam-bridge-${id}`),
    ]).filter((id) => id !== topic.knowledgeId);
    const structured = movementToStructured(topic);
    const payload = {
      step: "knowledge-expansion-camera",
      expansionVersion: PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION,
      topicId: topic.topicId,
      kind: "camera-movement",
      purpose: topic.purpose,
      whenToUse: topic.whenToUse,
      whenNotToUse: topic.whenNotToUse,
      advantages: topic.advantages,
      limitations: topic.limitations,
      relatedCameraSettings: topic.relatedCameraSettings,
      relatedStorytellingTechniques: topic.relatedStorytellingTechniques,
      knowledgeItem: movementToItem(topic),
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
    const existing = await foundation.getStorageEngine().getRecord(topic.knowledgeId, CAMERA_KNOWLEDGE_SOURCE);
    if (existing.success && existing.record) {
      const write = await foundation.getStorageEngine().updateRecord(
        topic.knowledgeId,
        {
          title: topic.name,
          description: topic.description,
          summary: topic.purpose,
          tags: unique(["camera-movement", "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
          keywords: topic.keywords,
          confidenceScore: topic.confidenceScore,
          qualityScore: topic.qualityScore,
          verificationStatus: KnowledgeVerificationStatus.Verified,
          status: KnowledgeRecordStatus.Verified,
          relatedKnowledge,
          payload,
        },
        CAMERA_KNOWLEDGE_SOURCE
      );
      return write.success ? "updated" : "failed";
    }
    const write = await foundation.getStorageEngine().storeRecord(
      {
        knowledgeId: topic.knowledgeId,
        knowledgeType: KnowledgeStorageType.Video,
        category: "professional-camera-movement",
        title: topic.name,
        description: topic.description,
        summary: topic.purpose,
        tags: unique(["camera-movement", "professional", topic.topicId, ...topic.keywords.slice(0, 6)]),
        keywords: topic.keywords,
        source: CAMERA_KNOWLEDGE_SOURCE,
        sourceReliability: 95,
        confidenceScore: topic.confidenceScore,
        qualityScore: topic.qualityScore,
        verificationStatus: KnowledgeVerificationStatus.Verified,
        status: KnowledgeRecordStatus.Verified,
        relatedKnowledge,
        payload,
      },
      CAMERA_KNOWLEDGE_SOURCE
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
      resourceIds: existing?.resourceIds ?? ["professional-camera-expansion"],
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

  private async persistMeta(install: CameraKnowledgeInstallResult): Promise<void> {
    await fs.writeFile(
      path.join(this.metaRoot, "expansion-state.json"),
      `${JSON.stringify(
        {
          version: PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION,
          domainIds: [CAMERA_DOMAIN_ID, CAMERA_MOVEMENT_DOMAIN_ID],
          installedAt: new Date().toISOString(),
          install,
          settingTopicIds: REQUIRED_CAMERA_SETTING_TOPIC_IDS,
          movementTopicIds: REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new ProfessionalCameraKnowledgeError("Professional Camera Knowledge is not initialized", "NOT_INITIALIZED");
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new ProfessionalCameraKnowledgeError("Professional Camera Knowledge startup is incomplete", "NOT_STARTED");
    }
  }
}

function settingToItem(topic: ProfessionalCameraSettingTopic): KnowledgeItem {
  return {
    knowledgeId: topic.knowledgeId,
    title: topic.title,
    domain: CAMERA_DOMAIN_ID,
    category: "professional-camera-settings",
    description: topic.description,
    coreConcepts: topic.keywords.slice(0, 8),
    definitions: [topic.professionalDefinition],
    rules: topic.decisionRules,
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.professionalWorkflow,
    workflow: topic.professionalWorkflow,
    decisionRules: topic.decisionRules,
    commonMistakes: topic.commonMistakes,
    troubleshooting: topic.commonMistakes.map((m) => `Avoid: ${m}`),
    recommendations: topic.bestPractices,
    examples: topic.examples,
    professionalStandards: [
      `Confidence ${topic.confidenceScore}/100`,
      `Quality ${topic.qualityScore}/100`,
      "Offline-first curated camera standard",
    ],
    relatedTopics: topic.relatedTopics,
    keywords: topic.keywords,
    confidenceScore: topic.confidenceScore,
    qualityScore: topic.qualityScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Camera Knowledge Expansion",
        type: "curated-professional",
        reference: `expansion-step-2:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function movementToItem(topic: ProfessionalCameraMovementTopic): KnowledgeItem {
  return {
    knowledgeId: topic.knowledgeId,
    title: topic.name,
    domain: CAMERA_MOVEMENT_DOMAIN_ID,
    category: "professional-camera-movement",
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
    examples: topic.exampleUseCases,
    professionalStandards: topic.relatedStorytellingTechniques,
    relatedTopics: [...topic.relatedTopics, ...topic.relatedCameraSettings],
    keywords: topic.keywords,
    confidenceScore: topic.confidenceScore,
    qualityScore: topic.qualityScore,
    sourceMetadata: [
      {
        name: "KWIZERA Professional Camera Knowledge Expansion",
        type: "curated-professional",
        reference: `expansion-step-2:${topic.topicId}`,
        reliability: 95,
      },
    ],
    version: 1,
  };
}

function settingToStructured(topic: ProfessionalCameraSettingTopic): StructuredKnowledge {
  return {
    title: topic.title,
    category: "professional-camera-settings",
    domain: CAMERA_DOMAIN_ID,
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
    qualityRules: topic.bestPractices.filter((i) => /quality|clean|consistent|critical|accurate/i.test(i)),
    decisionRules: topic.decisionRules,
    workflowSteps: topic.professionalWorkflow,
    prerequisites: topic.professionalWorkflow.slice(0, 1),
    dependencies: topic.relatedDomains,
    relatedKnowledge: topic.relatedTopics.map((id) => `cam-${id}`),
    definitions: [topic.professionalDefinition],
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      { name: "KWIZERA Professional Camera Knowledge Expansion", type: "curated-professional", reliability: 95 },
    ],
  };
}

function movementToStructured(topic: ProfessionalCameraMovementTopic): StructuredKnowledge {
  return {
    title: topic.name,
    category: "professional-camera-movement",
    domain: CAMERA_MOVEMENT_DOMAIN_ID,
    description: topic.description,
    sections: [
      { title: "Purpose", kind: "guidance", items: [topic.purpose] },
      { title: "When to Use", kind: "guidance", items: topic.whenToUse },
      { title: "When Not to Use", kind: "rules", items: topic.whenNotToUse },
      { title: "Best Practices", kind: "guidance", items: topic.bestPractices },
      { title: "Examples", kind: "examples", items: topic.exampleUseCases },
    ],
    concepts: topic.keywords,
    entities: [topic.name, ...topic.relatedDomains],
    terminology: topic.keywords,
    rules: topic.whenNotToUse.map((w) => `Avoid when: ${w}`),
    bestPractices: topic.bestPractices,
    professionalTechniques: topic.advantages,
    examples: topic.exampleUseCases,
    commonMistakes: topic.commonMistakes,
    qualityRules: topic.limitations,
    decisionRules: [
      ...topic.whenToUse.map((w) => `Use when: ${w}`),
      ...topic.whenNotToUse.map((w) => `Do not use when: ${w}`),
    ],
    workflowSteps: topic.bestPractices,
    prerequisites: topic.relatedCameraSettings,
    dependencies: topic.relatedDomains,
    relatedKnowledge: topic.relatedTopics.map((id) => `cmov-${id}`),
    definitions: [topic.purpose],
    difficultyLevel: topic.metadata.difficulty,
    confidenceScore: topic.confidenceScore,
    sourceMetadata: [
      { name: "KWIZERA Professional Camera Knowledge Expansion", type: "curated-professional", reliability: 95 },
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
    decisionRules: [`Relate camera knowledge to ${domain}.`],
    workflowSteps: [],
    prerequisites: [],
    dependencies: [],
    relatedKnowledge: ["cam-camera-fundamentals"],
    difficultyLevel: "foundation",
    confidenceScore: 85,
    sourceMetadata: [{ name: "KWIZERA Professional Camera Knowledge Expansion", type: "curated", reliability: 95 }],
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
    category: domain.includes("movement") ? "professional-camera-movement" : "professional-camera-settings",
    domain,
    description: "Curated professional camera knowledge for AI Me (not video generation).",
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
    prerequisites: ["Confirm story intent before choosing camera settings or moves."],
    dependencies: ["video-production-knowledge", "lighting-knowledge", "composition-knowledge"],
    relatedKnowledge: items.map((i) => i.knowledgeId),
    difficultyLevel: "advanced",
    confidenceScore: average(items.map((i) => i.confidenceScore)),
    sourceMetadata: [
      { name: "KWIZERA Professional Camera Knowledge Expansion", type: "curated-professional", reliability: 95 },
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
