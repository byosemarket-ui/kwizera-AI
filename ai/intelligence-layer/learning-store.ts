/**
 * Persisted learning events + abstract knowledge patterns.
 * Project-isolated events; only abstract patterns may be global.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readJsonSafe, writeJsonAtomic } from "../../storage/safe-json.js";
import {
  confidenceBand,
  type KnowledgePattern,
  type LearningEvent,
  type LearningOutcomeKind,
} from "./types.js";

interface LearningStoreFile {
  version: 1;
  events: LearningEvent[];
  patterns: KnowledgePattern[];
}

const MAX_EVENTS = 500;
const MAX_PATTERNS = 200;

function emptyStore(): LearningStoreFile {
  return { version: 1, events: [], patterns: [] };
}

export class IntelligenceLearningStore {
  private filePath = "";
  private store: LearningStoreFile = emptyStore();
  private ready = false;

  async initialize(storageRoot: string): Promise<void> {
    this.filePath = path.join(storageRoot, "intelligence-layer", "learning-store.json");
    const loaded = await readJsonSafe<LearningStoreFile>(this.filePath, emptyStore());
    this.store = {
      version: 1,
      events: Array.isArray(loaded.value.events) ? loaded.value.events : [],
      patterns: Array.isArray(loaded.value.patterns) ? loaded.value.patterns : [],
    };
    this.ready = true;
    console.info("[LEARNING_EVENT_CREATED]", {
      phase: "store_loaded",
      events: this.store.events.length,
      patterns: this.store.patterns.length,
      recovered: loaded.recovered,
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  getEventsForProject(projectId: string): LearningEvent[] {
    return this.store.events.filter((e) => e.projectId === projectId);
  }

  getAllEvents(): LearningEvent[] {
    return [...this.store.events];
  }

  getPatterns(opts?: { projectId?: string; minConfidence?: number }): KnowledgePattern[] {
    const min = opts?.minConfidence ?? 0;
    return this.store.patterns.filter((p) => {
      if (p.confidence < min) return false;
      if (p.scope === "global-abstract") return true;
      if (opts?.projectId && p.projectId === opts.projectId) return true;
      return false;
    });
  }

  async appendEvent(partial: Omit<LearningEvent, "eventId" | "createdAt" | "kind"> & {
    kind?: LearningOutcomeKind;
  }): Promise<{
    event: LearningEvent;
    promoted: KnowledgePattern[];
    refused: Array<{ reason: string }>;
  }> {
    const quality = partial.qualityScore;
    let kind: LearningOutcomeKind = partial.kind ?? "NEUTRAL_OBSERVATION";
    if (!partial.kind) {
      if (partial.renderSucceeded === false) kind = "FAILED_PATTERN";
      else if (typeof quality === "number" && quality >= 70) kind = "SUCCESSFUL_PATTERN";
      else if (typeof quality === "number" && quality < 45) kind = "FAILED_PATTERN";
      if (partial.fallbackUsed && partial.planSource === "deterministic" && partial.aiModelId) {
        // Model attempted but fell back — do not treat as creative success pattern alone.
        if (kind === "SUCCESSFUL_PATTERN" && (quality ?? 0) < 80) kind = "NEUTRAL_OBSERVATION";
      }
    }

    const event: LearningEvent = {
      ...partial,
      kind,
      eventId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.store.events.push(event);
    while (this.store.events.length > MAX_EVENTS) this.store.events.shift();
    await this.persist();
    console.info("[LEARNING_EVENT_CREATED]", {
      eventId: event.eventId,
      projectId: event.projectId,
      kind: event.kind,
      qualityScore: event.qualityScore,
    });
    const promotion = await this.maybePromotePatterns(event);
    return { event, ...promotion };
  }

  /**
   * Promote only abstract reusable patterns with enough evidence.
   * Never promotes private project content.
   */
  async maybePromotePatterns(event: LearningEvent): Promise<{
    promoted: KnowledgePattern[];
    refused: Array<{ reason: string }>;
  }> {
    const promoted: KnowledgePattern[] = [];
    const refused: Array<{ reason: string }> = [];

    if (event.kind === "MODEL_LIMITATION") {
      refused.push({ reason: "MODEL_LIMITATION events never become creative knowledge." });
      return { promoted, refused };
    }
    if (!event.renderSucceeded) {
      refused.push({ reason: "Failed/incomplete renders are not promoted to creative knowledge." });
      return { promoted, refused };
    }
    if (event.kind !== "SUCCESSFUL_PATTERN") {
      refused.push({ reason: `Outcome kind ${event.kind} is too weak for promotion.` });
      return { promoted, refused };
    }
    if ((event.qualityScore ?? 0) < 70) {
      refused.push({ reason: "Quality score below promotion threshold (70)." });
      return { promoted, refused };
    }

    const similar = this.store.events.filter((e) =>
      e.kind === "SUCCESSFUL_PATTERN"
      && (e.qualityScore ?? 0) >= 70
      && e.renderSucceeded
      && e.scenePurposes[0]
      && /hook|reveal/i.test(e.scenePurposes[0]),
    );
    const projectIds = new Set(similar.map((e) => e.projectId));

    // Require at least 2 successful projects OR one strong (>=85) observation for MEDIUM only.
    const strong = (event.qualityScore ?? 0) >= 85;
    if (projectIds.size < 2 && !strong) {
      refused.push({
        reason: "Insufficient cross-project evidence (need 2+ successful projects or quality>=85).",
      });
      return { promoted, refused };
    }

    const confidence = projectIds.size >= 3 ? 0.86 : strong && projectIds.size < 2 ? 0.62 : 0.74;
    const band = confidenceBand(confidence);
    if (band === "LOW") {
      refused.push({ reason: "Computed confidence LOW — not promoted." });
      return { promoted, refused };
    }

    const statement = projectIds.size >= 2
      ? "Short social product videos often open with a clear product hook/reveal in the first scenes."
      : "A high-quality render used an early product-focused opening scene.";

    const existing = this.store.patterns.find(
      (p) => p.scope === "global-abstract" && p.category === "hook" && p.statement === statement,
    );
    const now = new Date().toISOString();
    if (existing) {
      existing.confidence = Math.max(existing.confidence, confidence);
      existing.confidenceBand = confidenceBand(existing.confidence);
      existing.sourceEventIds = [...new Set([...existing.sourceEventIds, event.eventId])].slice(-20);
      existing.sourceProjectCount = Math.max(existing.sourceProjectCount, projectIds.size);
      existing.updatedAt = now;
      existing.version += 1;
      existing.promoted = true;
      promoted.push(existing);
      console.info("[KNOWLEDGE_PROMOTED]", { patternId: existing.patternId, confidence: existing.confidence });
    } else {
      const pattern: KnowledgePattern = {
        patternId: randomUUID(),
        category: "hook",
        statement,
        confidence,
        confidenceBand: band,
        applicability: ["social", "short-form", "product-marketing"],
        sourceEventIds: [event.eventId],
        sourceProjectCount: projectIds.size,
        scope: "global-abstract",
        version: 1,
        createdAt: now,
        updatedAt: now,
        promoted: true,
      };
      this.store.patterns.push(pattern);
      while (this.store.patterns.length > MAX_PATTERNS) this.store.patterns.shift();
      promoted.push(pattern);
      console.info("[KNOWLEDGE_PROMOTED]", { patternId: pattern.patternId, confidence: pattern.confidence });
    }

    await this.persist();
    return { promoted, refused };
  }

  private async persist(): Promise<void> {
    if (!this.filePath) return;
    await writeJsonAtomic(this.filePath, this.store);
  }
}
