import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";

export class MetadataCompressor {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: MemoryOptimizationLogger
  ) {}

  async compress(): Promise<{ compressed: number; bytesSaved: number; durationMs: number }> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    let compressed = 0;
    let bytesSaved = 0;

    for (const entry of storage.getIndexEntries()) {
      const read = await storage.getRecord(entry.memoryId);
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
        await storage.updateRecord(entry.memoryId, {
          tags: cleanedTags,
          keywords: cleanedKeywords,
          payload,
        });

        const readAfter = await storage.getRecord(entry.memoryId);
        if (readAfter.success && readAfter.record) {
          const newSize = JSON.stringify(readAfter.record).length;
          bytesSaved += Math.max(0, originalSize - newSize);
        }
        compressed++;
      }
    }

    this.logger.log("info", "optimization", "Metadata compression complete", {
      compressed,
      bytesSaved,
    });

    return { compressed, bytesSaved, durationMs: Date.now() - start };
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
