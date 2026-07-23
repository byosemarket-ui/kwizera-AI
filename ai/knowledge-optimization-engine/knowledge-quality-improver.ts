import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeRecordStatus, KnowledgeRecordUpdate } from "../knowledge-storage-engine/types.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeQualityImprovementResult } from "./types.js";

const LOW_QUALITY_THRESHOLD = 50;
const MIN_CONFIDENCE = 50;

export class KnowledgeQualityImprover {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly logger: KnowledgeOptimizationLogger
  ) {}

  async improve(): Promise<KnowledgeQualityImprovementResult> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    let improved = 0;
    let rejected = 0;

    for (const entry of storage.getIndexEntries()) {
      const read = await storage.getRecord(entry.knowledgeId, "knowledge-optimization-engine");
      if (!read.success || !read.record) continue;

      const record = read.record;

      if (record.qualityScore < LOW_QUALITY_THRESHOLD && record.confidenceScore < MIN_CONFIDENCE) {
        if (record.status !== KnowledgeRecordStatus.Archived) {
          await storage.updateRecord(
            entry.knowledgeId,
            {
              status: KnowledgeRecordStatus.Rejected,
              tags: [...record.tags, "low-quality-rejected"],
            },
            "knowledge-optimization-engine"
          );
          rejected++;
        }
        continue;
      }

      const updates: KnowledgeRecordUpdate = {};
      let changed = false;

      if (!record.summary && record.description) {
        updates.summary = record.description.slice(0, 200);
        changed = true;
      }

      const cleanedKeywords = [
        ...new Set([...record.keywords, ...record.tags.filter((t) => t.length > 2)]),
      ];
      if (cleanedKeywords.length > record.keywords.length) {
        updates.keywords = cleanedKeywords;
        changed = true;
      }

      if (record.qualityScore < 60 && record.description.length > 50) {
        updates.qualityScore = Math.min(75, record.qualityScore + 10);
        changed = true;
      }

      if (changed) {
        await storage.updateRecord(entry.knowledgeId, updates, "knowledge-optimization-engine");
        improved++;
      }
    }

    this.logger.log("info", "quality", "Knowledge quality improvement complete", {
      improved,
      rejected,
    });

    return { improved, rejected, durationMs: Date.now() - start };
  }
}
