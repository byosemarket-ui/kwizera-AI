import fs from "node:fs";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeRecordStatus, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeAnalysisReport, KnowledgeTier } from "./types.js";

const LOW_QUALITY_THRESHOLD = 50;
const INCOMPLETE_SUMMARY_MIN = 10;

export class KnowledgeAnalyzer {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly logger: KnowledgeOptimizationLogger
  ) {}

  async analyze(): Promise<KnowledgeAnalysisReport> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    const retrievalEngine = this.foundation.getRetrievalEngine();
    const graphEngine = this.foundation.getGraphEngine();

    const entries = storage.getIndexEntries();
    let totalStorageBytes = 0;
    let incompleteRecords = 0;
    let lowQualityRecords = 0;

    for (const entry of entries) {
      if (fs.existsSync(entry.storageLocation)) {
        totalStorageBytes += fs.statSync(entry.storageLocation).size;
      }

      let read;
      try {
        read = await storage.getRecord(entry.knowledgeId, "knowledge-optimization-engine");
      } catch {
        lowQualityRecords++;
        incompleteRecords++;
        continue;
      }
      if (read.success && read.record) {
        const record = read.record;
        if (!record.summary || record.summary.length < INCOMPLETE_SUMMARY_MIN) incompleteRecords++;
        if (record.qualityScore < LOW_QUALITY_THRESHOLD) lowQualityRecords++;
      }
    }

    const fingerprintMap = new Map<string, string[]>();
    for (const entry of entries) {
      const list = fingerprintMap.get(entry.fingerprint) ?? [];
      list.push(entry.knowledgeId);
      fingerprintMap.set(entry.fingerprint, list);
    }
    const duplicateGroups = [...fingerprintMap.values()].filter((ids) => ids.length > 1).length;

    const storageReport = storage.buildStatusReport();
    const retrievalReport = retrievalEngine.buildStatusReport();
    const graphReport = graphEngine.buildStatusReport();

    const indexQualityScore = storageReport.readinessScore;
    const relationshipQualityScore = graphReport.readinessScore;
    const graphQualityScore = graphReport.readinessScore;
    const classificationQualityScore = Math.max(
      0,
      100 - Math.round((incompleteRecords / Math.max(entries.length, 1)) * 100)
    );

    const tierDistribution: Record<KnowledgeTier, number> = {
      [KnowledgeTier.Core]: 0,
      [KnowledgeTier.FrequentlyUsed]: 0,
      [KnowledgeTier.Creative]: 0,
      [KnowledgeTier.Business]: 0,
      [KnowledgeTier.Industry]: 0,
      [KnowledgeTier.Archived]: 0,
      [KnowledgeTier.Historical]: 0,
      [KnowledgeTier.Experimental]: 0,
    };

    for (const entry of entries) {
      const read = await storage.getRecord(entry.knowledgeId, "knowledge-optimization-engine");
      if (!read.success || !read.record) continue;
      const record = read.record;

      if (record.status === KnowledgeRecordStatus.Archived) {
        tierDistribution[KnowledgeTier.Archived]++;
      } else if (entry.knowledgeType === KnowledgeStorageType.Creative) {
        tierDistribution[KnowledgeTier.Creative]++;
      } else if (
        entry.knowledgeType === KnowledgeStorageType.Business ||
        entry.knowledgeType === KnowledgeStorageType.Marketing ||
        entry.knowledgeType === KnowledgeStorageType.Brand ||
        entry.knowledgeType === KnowledgeStorageType.Product
      ) {
        tierDistribution[KnowledgeTier.Business]++;
      } else if (entry.knowledgeType === KnowledgeStorageType.Industry) {
        tierDistribution[KnowledgeTier.Industry]++;
      } else if (record.qualityScore < LOW_QUALITY_THRESHOLD) {
        tierDistribution[KnowledgeTier.Experimental]++;
      } else {
        tierDistribution[KnowledgeTier.Core]++;
      }
    }

    const fragmentationScore =
      entries.length > 0 ? Math.min(100, Math.round((duplicateGroups / entries.length) * 100)) : 0;

    const report: KnowledgeAnalysisReport = {
      totalRecords: entries.length,
      totalStorageBytes,
      knowledgeGrowthRate: entries.length,
      duplicateGroups,
      incompleteRecords,
      lowQualityRecords,
      fragmentationScore,
      indexQualityScore,
      relationshipQualityScore,
      graphQualityScore,
      classificationQualityScore,
      averageSearchMs: retrievalReport.searchPerformance.averageSearchMs,
      averageRetrievalMs: retrievalReport.searchPerformance.averageRetrievalMs,
      averageRecommendationMs: graphReport.performance.averageRecommendationMs,
      tierDistribution,
      durationMs: Date.now() - start,
    };

    this.logger.log("info", "analysis", "Knowledge analysis complete", {
      totalRecords: report.totalRecords,
      duplicateGroups: report.duplicateGroups,
      incompleteRecords: report.incompleteRecords,
      durationMs: report.durationMs,
    });

    return report;
  }

  computeAverageQuality(): { qualityScore: number; completeness: number } {
    const storage = this.foundation.getStorageEngine();
    const entries = storage.getIndexEntries();
    if (entries.length === 0) return { qualityScore: 100, completeness: 100 };

    let qualitySum = 0;
    let completenessSum = 0;
    let count = 0;

    for (const entry of entries) {
      const read = storage.findIndexEntry(entry.knowledgeId);
      if (!read) continue;
      qualitySum += 75;
      completenessSum += entry.searchableText.length > 20 ? 100 : entry.title.length > 5 ? 80 : 50;
      count++;
    }

    return {
      qualityScore: Math.round(qualitySum / count),
      completeness: Math.round(completenessSum / count),
    };
  }
}
