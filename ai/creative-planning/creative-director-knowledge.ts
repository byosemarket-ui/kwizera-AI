/**
 * The Creative Director's knowledge request, shared by the planner and by Training Center runtime tests so the
 * proof of runtime consumption uses exactly the production retrieval.
 */
import type { KnowledgeTask } from "../knowledge-retrieval-engine/knowledge-taxonomy.js";

export function creativeDirectorKnowledgeRequest(input: {
  category?: string | null;
  platform?: string | null;
  tone?: string | null;
  cinematic: boolean;
  projectId: string | null;
}): { task: KnowledgeTask; query: string; projectId: string | null; caller: string } {
  const topic = [input.category, input.platform, input.tone, "product marketing video hook reveal"].filter(Boolean).join(" ");
  return {
    task: input.cinematic ? "CINEMATIC_VIDEO" : "PRODUCT_SLIDESHOW",
    query: `${topic} composition typography cta scene order`,
    projectId: input.projectId,
    caller: "creative-director",
  };
}
