import fs from "node:fs";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeTierManager } from "./knowledge-tier-manager.js";
import { KnowledgeCacheOptimizationResult, KnowledgeTier } from "./types.js";

const CACHE_WARM_LIMIT = 20;

export class KnowledgeCacheOptimizer {
  private priorityPath = "";

  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly tierManager: KnowledgeTierManager,
    private readonly logger: KnowledgeOptimizationLogger
  ) {}

  initialize(optimizationDir: string): void {
    this.priorityPath = path.join(optimizationDir, "cache-priority.json");
  }

  async optimize(): Promise<KnowledgeCacheOptimizationResult> {
    const start = Date.now();
    const retrieval = this.foundation.getRetrievalEngine();
    const graphEngine = this.foundation.getGraphEngine();
    const storage = this.foundation.getStorageEngine();

    const frequent = this.tierManager.getByTier(KnowledgeTier.FrequentlyUsed);
    const core = this.tierManager.getByTier(KnowledgeTier.Core);
    const creative = this.tierManager.getByTier(KnowledgeTier.Creative);
    const business = this.tierManager.getByTier(KnowledgeTier.Business);

    const prioritySet = new Set<string>();

    for (const assignment of [...frequent, ...core, ...creative, ...business].slice(
      0,
      CACHE_WARM_LIMIT
    )) {
      prioritySet.add(assignment.knowledgeId);
    }

    for (const type of [
      KnowledgeStorageType.Product,
      KnowledgeStorageType.Brand,
      KnowledgeStorageType.Creative,
      KnowledgeStorageType.Marketing,
      KnowledgeStorageType.Video,
    ]) {
      const entries = storage
        .getIndexEntries()
        .filter((e) => e.knowledgeType === type)
        .slice(0, 5);
      for (const entry of entries) {
        prioritySet.add(entry.knowledgeId);
      }
    }

    const priorityIds = [...prioritySet].slice(0, CACHE_WARM_LIMIT);
    let warmed = 0;

    for (const knowledgeId of priorityIds) {
      const response = await retrieval.retrieve(knowledgeId, "knowledge-optimization-engine");
      if (response.success) warmed++;

      const recs = graphEngine.getRecommendations(knowledgeId, 3);
      for (const rec of recs.all) {
        await retrieval.retrieve(rec.nodeId, "knowledge-optimization-engine");
      }
    }

    fs.writeFileSync(
      this.priorityPath,
      JSON.stringify({ priorityIds, warmedAt: new Date().toISOString(), warmed }, null, 2),
      "utf8"
    );

    this.logger.log("info", "cache", "Cache optimization complete", {
      warmed,
      priorityCount: priorityIds.length,
    });

    return { warmed, priorityIds, durationMs: Date.now() - start };
  }

  getPriorityPath(): string {
    return this.priorityPath;
  }
}
