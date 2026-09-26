import type { KnowledgePipeline } from "./knowledge-pipeline.js";
import type { GuidanceSpec } from "../knowledge-validation-engine/knowledge-evidence.js";
import type { TaskKnowledgeContext } from "../knowledge-retrieval-engine/knowledge-context-builder.js";
import type { KnowledgeTask } from "../knowledge-retrieval-engine/knowledge-taxonomy.js";

let pipeline: KnowledgePipeline | null = null;

export function setKnowledgePipeline(next: KnowledgePipeline | null): void {
  pipeline = next;
}

export function getKnowledgePipeline(): KnowledgePipeline | null {
  return pipeline?.isReady() ? pipeline : null;
}

/** Task retrieval for AI subsystems. Returns null (never throws) when the knowledge base is unavailable. */
export async function retrieveTaskKnowledge(request: {
  task: KnowledgeTask;
  query: string;
  projectId?: string | null;
  tenantId?: string | null;
  guidanceSpecs?: GuidanceSpec[];
  caller: string;
}): Promise<TaskKnowledgeContext | null> {
  const active = getKnowledgePipeline();
  if (!active) return null;
  try {
    return await active.retrieve(request);
  } catch {
    return null;
  }
}
