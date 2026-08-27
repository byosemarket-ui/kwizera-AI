import type { AiCoreManager } from "../../core/ai-core-manager.js";
import type { KnowledgeSearchResult, MemorySearchResult } from "../types.js";
import type { KnowledgeSearchProvider } from "./knowledge-search-provider.js";
import type { MemorySearchProvider } from "./memory-search-provider.js";

const RESULT_LIMIT = 5;

/** Adapts existing local foundations to the decision and reasoning search contracts. */
export class FoundationMemorySearchProvider implements MemorySearchProvider {
  constructor(private readonly core: AiCoreManager) {}

  async search(query: string, context: Record<string, unknown>): Promise<MemorySearchResult> {
    const foundation = this.core.memoryFoundation;
    if (!foundation?.isStartupComplete()) return { found: false, items: [], message: "Memory Foundation is not ready." };
    const project = typeof context.projectId === "string" ? context.projectId : undefined;
    const result = await foundation.getRetrievalEngine().search({ text: query, project, limit: RESULT_LIMIT, requesterId: "decision-reasoning" });
    const items = result.results.flatMap((item) => item.record ? [{
      id: item.record.memoryId,
      summary: item.record.description.slice(0, 500),
      relevance: item.ranking.compositeScore,
    }] : []);
    return { found: items.length > 0, items, message: result.diagnostics.join(" ") || `${items.length} memory result(s) found.` };
  }
}

export class FoundationKnowledgeSearchProvider implements KnowledgeSearchProvider {
  constructor(private readonly core: AiCoreManager) {}

  async search(query: string, context: Record<string, unknown>): Promise<KnowledgeSearchResult> {
    const foundation = this.core.knowledgeFoundation;
    if (!foundation?.isStartupComplete()) return { found: false, items: [], message: "Knowledge Foundation is not ready." };
    const projectId = typeof context.projectId === "string" ? context.projectId : undefined;
    const { createKnowledgeTeachingService } = await import("../../knowledge-foundation/knowledge-teaching-service.js");
    const teaching = createKnowledgeTeachingService(foundation);
    const retrieved = await teaching.retrieve({
      text: query,
      projectId,
      includePermanent: true,
      limit: RESULT_LIMIT,
      requesterId: "decision-reasoning",
    });
    const items = retrieved.records.map((record) => ({
      id: record.knowledgeId,
      fact: record.summary.slice(0, 500),
      source: record.source,
    }));
    return {
      found: items.length > 0,
      items,
      message: retrieved.error || `${items.length} knowledge result(s) found.`,
    };
  }
}