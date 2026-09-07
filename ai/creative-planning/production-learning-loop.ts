/**
 * Safe learning loop — stores structured production metadata per project.
 * Does NOT fine-tune models. Persists via Intelligence Layer when ready;
 * keeps in-memory mirror for backward compatibility.
 */

export interface ProductionLearningRecord {
  projectId: string;
  createdAt: string;
  creativeMode: string | null;
  sceneDurationsMs: number[];
  transitions: string[];
  motions: string[];
  scenePurposes?: string[];
  audioTimingSummary: string | null;
  qualityScore: number | null;
  userApproved: boolean | null;
  advisorSource: "ollama" | "deterministic-fallback" | null;
  planSource?: "ai" | "deterministic" | null;
  aiModelId?: string | null;
  fallbackUsed?: boolean;
  renderSucceeded?: boolean;
  knowledgeVersion: string | null;
  skillsVersion: string | null;
}

/** In-memory + optional hook for persistence adapters. Project-isolated keys. */
const byProject = new Map<string, ProductionLearningRecord[]>();
const MAX_PER_PROJECT = 20;

export function recordProductionLearning(record: ProductionLearningRecord): void {
  const list = byProject.get(record.projectId) ?? [];
  list.push(record);
  while (list.length > MAX_PER_PROJECT) list.shift();
  byProject.set(record.projectId, list);
  console.info("[PRODUCTION_LEARNING]", {
    projectId: record.projectId,
    qualityScore: record.qualityScore,
    advisorSource: record.advisorSource,
    knowledgeVersion: record.knowledgeVersion,
  });

  // Best-effort persist into Intelligence Layer (never throws into caller).
  void (async () => {
    try {
      const { getIntelligenceLayer } = await import("../intelligence-layer/index.js");
      const layer = getIntelligenceLayer();
      if (!layer.isReady()) return;
      await layer.recordRenderLearning({
        projectId: record.projectId,
        qualityScore: record.qualityScore,
        planSource: record.planSource ?? null,
        aiModelId: record.aiModelId ?? null,
        advisorSource: record.advisorSource,
        sceneDurationsMs: record.sceneDurationsMs,
        transitions: record.transitions,
        motions: record.motions,
        scenePurposes: record.scenePurposes ?? [],
        fallbackUsed: record.fallbackUsed ?? false,
        renderSucceeded: record.renderSucceeded !== false,
        knowledgeVersion: record.knowledgeVersion,
        skillsVersion: record.skillsVersion,
        notes: record.audioTimingSummary ? [record.audioTimingSummary] : [],
        provenance: { source: "video-quality-review" },
      });
    } catch (error) {
      console.warn(
        "[PRODUCTION_LEARNING] intelligence-layer persist skipped:",
        error instanceof Error ? error.message : error,
      );
    }
  })();
}

export function getProductionLearning(projectId: string): ProductionLearningRecord[] {
  return [...(byProject.get(projectId) ?? [])];
}

export function clearProductionLearningForTests(): void {
  byProject.clear();
}
