import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";

export class KnowledgeMetadataOptimizer {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly logger: KnowledgeOptimizationLogger
  ) {}

  async optimize(): Promise<{ optimized: number; bytesSaved: number; durationMs: number }> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    let optimized = 0;
    let bytesSaved = 0;

    for (const entry of storage.getIndexEntries()) {
      const read = await storage.getRecord(entry.knowledgeId, "knowledge-optimization-engine");
      if (!read.success || !read.record) continue;

      const record = read.record;
      const originalSize = JSON.stringify(record).length;

      const cleanedTags = [...new Set(record.tags.map((t) => t.trim()).filter(Boolean))];
      const cleanedKeywords = [...new Set(record.keywords.map((k) => k.trim()).filter(Boolean))];
      const cleanedSearchable = record.searchableText.replace(/\s+/g, " ").trim();
      const payload = record.payload ? this.cleanPayload(record.payload) : undefined;

      const changed =
        cleanedTags.length !== record.tags.length ||
        cleanedKeywords.length !== record.keywords.length ||
        cleanedSearchable !== record.searchableText ||
        payload !== record.payload;

      if (changed) {
        await storage.updateRecord(
          entry.knowledgeId,
          {
            tags: cleanedTags,
            keywords: cleanedKeywords,
            payload,
          },
          "knowledge-optimization-engine"
        );

        const readAfter = await storage.getRecord(entry.knowledgeId, "knowledge-optimization-engine");
        if (readAfter.success && readAfter.record) {
          const newSize = JSON.stringify(readAfter.record).length;
          bytesSaved += Math.max(0, originalSize - newSize);
        }
        optimized++;
      }
    }

    this.logger.log("info", "optimization", "Metadata optimization complete", {
      optimized,
      bytesSaved,
    });

    return { optimized, bytesSaved, durationMs: Date.now() - start };
  }

  private cleanPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === null || value === undefined || value === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;
      cleaned[key] = value;
    }
    return cleaned;
  }
}
