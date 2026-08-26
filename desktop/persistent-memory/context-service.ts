/**
 * Phase 7 Step 2 — AI context package from durable memory + knowledge.
 */

import { persistentMemoryApi } from "./api-client";

export async function buildDurableAiContext(input: {
  projectId?: string | null;
  task?: string;
  limit?: number;
}) {
  return persistentMemoryApi.buildContext({
    projectId: input.projectId ?? undefined,
    task: input.task,
    limit: input.limit ?? 12,
  });
}
