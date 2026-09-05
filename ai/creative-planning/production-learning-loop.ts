/**
 * Safe learning loop — stores structured production metadata per project.
 * Does NOT fine-tune models. Does NOT auto-promote to global knowledge.
 */

export interface ProductionLearningRecord {
  projectId: string;
  createdAt: string;
  creativeMode: string | null;
  sceneDurationsMs: number[];
  transitions: string[];
  motions: string[];
  audioTimingSummary: string | null;
  qualityScore: number | null;
  userApproved: boolean | null;
  advisorSource: "ollama" | "deterministic-fallback" | null;
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
}

export function getProductionLearning(projectId: string): ProductionLearningRecord[] {
  return [...(byProject.get(projectId) ?? [])];
}

export function clearProductionLearningForTests(): void {
  byProject.clear();
}
