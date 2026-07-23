import fs from "node:fs";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryAnalysisReport, MemoryTier } from "./types.js";

export class MemoryAnalyzer {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: MemoryOptimizationLogger
  ) {}

  async analyze(): Promise<MemoryAnalysisReport> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    const indexEngine = this.foundation.getIndexEngine();
    const retrievalEngine = this.foundation.getRetrievalEngine();
    const relationshipEngine = this.foundation.getRelationshipMemoryEngine();

    const entries = storage.getIndexEntries();
    let totalStorageBytes = 0;

    for (const entry of entries) {
      if (fs.existsSync(entry.storageLocation)) {
        totalStorageBytes += fs.statSync(entry.storageLocation).size;
      }
    }

    const fingerprintMap = new Map<string, string[]>();
    for (const entry of entries) {
      const list = fingerprintMap.get(entry.fingerprint) ?? [];
      list.push(entry.memoryId);
      fingerprintMap.set(entry.fingerprint, list);
    }
    const duplicateGroups = [...fingerprintMap.values()].filter((ids) => ids.length > 1).length;

    const indexReport = indexEngine.buildStatusReport();
    const retrievalReport = retrievalEngine.buildStatusReport();
    const relationshipReport = relationshipEngine.buildStatusReport();

    const indexQualityScore = indexReport.readinessScore;
    const relationshipQualityScore = relationshipReport.readinessScore;

    const tierDistribution: Record<MemoryTier, number> = {
      [MemoryTier.Active]: 0,
      [MemoryTier.FrequentlyUsed]: 0,
      [MemoryTier.Learning]: 0,
      [MemoryTier.Archived]: 0,
      [MemoryTier.Historical]: 0,
      [MemoryTier.System]: 0,
    };

    for (const entry of entries) {
      if (entry.memoryType === MemoryStorageType.System) {
        tierDistribution[MemoryTier.System]++;
      } else if (entry.memoryType === MemoryStorageType.Learning) {
        tierDistribution[MemoryTier.Learning]++;
      }
    }

    const fragmentationScore = entries.length > 0
      ? Math.min(100, Math.round((duplicateGroups / entries.length) * 100))
      : 0;

    const report: MemoryAnalysisReport = {
      totalRecords: entries.length,
      totalStorageBytes,
      duplicateGroups,
      fragmentationScore,
      indexQualityScore,
      relationshipQualityScore,
      averageSearchMs: retrievalReport.searchPerformance.averageSearchMs,
      averageRetrievalMs: retrievalReport.searchPerformance.averageRetrievalMs,
      tierDistribution,
      durationMs: Date.now() - start,
    };

    this.logger.log("info", "analysis", "Memory analysis complete", {
      totalRecords: report.totalRecords,
      duplicateGroups: report.duplicateGroups,
      durationMs: report.durationMs,
    });

    return report;
  }
}
