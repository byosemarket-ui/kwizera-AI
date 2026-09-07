/**
 * Lightweight Intelligence Layer orchestrator.
 * Always-on (does not require Memory/Knowledge foundation boot).
 */
import { IntelligenceLearningStore } from "./learning-store.js";
import { VideoDecisionEngine, type DecideInput } from "./video-decision-engine.js";
import type { IntelligenceDecision, KnowledgePattern, LearningEvent } from "./types.js";
import type { LearningOutcomeKind } from "./types.js";

export class IntelligenceLayerManager {
  private store = new IntelligenceLearningStore();
  private decisions = new VideoDecisionEngine(this.store);
  private ready = false;
  private storageRoot = "";

  async initialize(storageRoot: string): Promise<void> {
    this.storageRoot = storageRoot;
    await this.store.initialize(storageRoot);
    this.ready = true;
    console.info("[KWIZERA] Intelligence Layer ready", { storageRoot });
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): {
    ready: boolean;
    storageRoot: string;
    eventCount: number;
    patternCount: number;
    promotedCount: number;
  } {
    const patterns = this.store.getPatterns();
    return {
      ready: this.ready,
      storageRoot: this.storageRoot,
      eventCount: this.store.getAllEvents().length,
      patternCount: patterns.length,
      promotedCount: patterns.filter((p) => p.promoted).length,
    };
  }

  async recordRenderLearning(input: {
    projectId: string;
    qualityScore: number | null;
    planSource: "ai" | "deterministic" | null;
    aiModelId?: string | null;
    advisorSource?: "ollama" | "deterministic-fallback" | null;
    sceneDurationsMs: number[];
    transitions: string[];
    motions: string[];
    scenePurposes: string[];
    fallbackUsed?: boolean;
    renderSucceeded: boolean;
    knowledgeVersion?: string | null;
    skillsVersion?: string | null;
    notes?: string[];
    kind?: LearningOutcomeKind;
    provenance?: LearningEvent["provenance"];
  }): Promise<{
    event: LearningEvent;
    promoted: KnowledgePattern[];
    refused: Array<{ reason: string }>;
  }> {
    if (!this.ready) throw new Error("Intelligence Layer not ready");
    return this.store.appendEvent({
      projectId: input.projectId,
      qualityScore: input.qualityScore,
      planSource: input.planSource,
      aiModelId: input.aiModelId ?? null,
      advisorSource: input.advisorSource ?? null,
      sceneDurationsMs: input.sceneDurationsMs,
      transitions: input.transitions,
      motions: input.motions,
      scenePurposes: input.scenePurposes,
      fallbackUsed: input.fallbackUsed ?? false,
      renderSucceeded: input.renderSucceeded,
      knowledgeVersion: input.knowledgeVersion ?? null,
      skillsVersion: input.skillsVersion ?? null,
      notes: input.notes ?? [],
      kind: input.kind,
      provenance: input.provenance ?? { source: "video-quality-review" },
    });
  }

  async decide(input: DecideInput): Promise<IntelligenceDecision> {
    if (!this.ready) throw new Error("Intelligence Layer not ready");
    return this.decisions.decide(input);
  }

  getProjectLearning(projectId: string): LearningEvent[] {
    return this.store.getEventsForProject(projectId);
  }

  getPatterns(opts?: { projectId?: string; minConfidence?: number }): KnowledgePattern[] {
    return this.store.getPatterns(opts);
  }

  /**
   * Second-pass proof: decide after learning and report whether patterns were retrieved.
   */
  async secondPassProof(input: DecideInput): Promise<{
    priorEvents: LearningEvent[];
    patternsRetrieved: KnowledgePattern[];
    decision: IntelligenceDecision;
    learningInfluenced: boolean;
  }> {
    const priorEvents = this.getProjectLearning(input.projectId);
    const patternsRetrieved = this.getPatterns({
      projectId: input.projectId,
      minConfidence: 0.55,
    });
    const decision = await this.decide({ ...input, useOllama: input.useOllama ?? false });
    return {
      priorEvents,
      patternsRetrieved,
      decision,
      learningInfluenced: decision.knowledgePatternIds.length > 0,
    };
  }
}

let singleton: IntelligenceLayerManager | null = null;

export function getIntelligenceLayer(): IntelligenceLayerManager {
  if (!singleton) singleton = new IntelligenceLayerManager();
  return singleton;
}

export async function ensureIntelligenceLayer(storageRoot: string): Promise<IntelligenceLayerManager> {
  const mgr = getIntelligenceLayer();
  if (!mgr.isReady()) await mgr.initialize(storageRoot);
  return mgr;
}

/** Test helper */
export function resetIntelligenceLayerForTests(): void {
  singleton = null;
}
