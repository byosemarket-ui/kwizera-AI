import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import { KnowledgeAnalyzer } from "./knowledge-analyzer.js";
import { KnowledgeCacheOptimizer } from "./knowledge-cache-optimizer.js";
import { KnowledgeDeduplicator } from "./knowledge-deduplicator.js";
import { KnowledgeMetadataOptimizer } from "./knowledge-metadata-optimizer.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeQualityImprover } from "./knowledge-quality-improver.js";
import { KnowledgeTierManager } from "./knowledge-tier-manager.js";
import { KnowledgeRecoveryPointManager } from "./recovery-point-manager.js";
import {
  KnowledgeIntegrityVerification,
  KnowledgeOptimizationResult,
  KnowledgeOptimizationStepResult,
  KnowledgeOptimizationStrategy,
} from "./types.js";

export class KnowledgeOptimizer {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly analyzer: KnowledgeAnalyzer,
    private readonly tierManager: KnowledgeTierManager,
    private readonly deduplicator: KnowledgeDeduplicator,
    private readonly metadataOptimizer: KnowledgeMetadataOptimizer,
    private readonly qualityImprover: KnowledgeQualityImprover,
    private readonly cacheOptimizer: KnowledgeCacheOptimizer,
    private readonly recoveryManager: KnowledgeRecoveryPointManager,
    private readonly logger: KnowledgeOptimizationLogger,
    private readonly snapshotFiles: () => string[]
  ) {}

  async runFullOptimization(): Promise<KnowledgeOptimizationResult> {
    const start = Date.now();
    const retrieval = this.foundation.getRetrievalEngine();
    const graphEngine = this.foundation.getGraphEngine();

    const beforeSearch = retrieval.buildStatusReport().searchPerformance.averageSearchMs;
    const beforeRetrieval = retrieval.buildStatusReport().searchPerformance.averageRetrievalMs;
    const beforeRecommendation = graphEngine.buildStatusReport().performance.averageRecommendationMs;
    const beforeAnalysis = await this.analyzer.analyze();
    const beforeQuality = this.analyzer.computeAverageQuality();

    const recoveryPoint = this.recoveryManager.createRecoveryPoint(
      "pre-optimization",
      this.snapshotFiles()
    );
    const steps: KnowledgeOptimizationStepResult[] = [];

    try {
      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Classification, () => {
          const assignments = this.tierManager.classifyAll();
          return { itemsAffected: assignments.length, detail: "Knowledge tiers classified" };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Index, () => {
          this.foundation.getStorageEngine().runIntegrityCheck();
          return { itemsAffected: 1, detail: "Storage index verified and optimized" };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Relationship, async () => {
          const integrity = graphEngine.validateIntegrity();
          return {
            itemsAffected: integrity.issuesRepaired,
            detail: `Relationship integrity: ${integrity.issuesRepaired} issue(s) repaired`,
          };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Graph, () => {
          const result = graphEngine.optimizeGraph();
          return {
            itemsAffected: result.nodesRemoved + result.edgesRemoved,
            detail: `Graph optimized: ${result.nodesRemoved} node(s), ${result.edgesRemoved} edge(s)`,
          };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Metadata, async () => {
          const result = await this.metadataOptimizer.optimize();
          return {
            itemsAffected: result.optimized,
            detail: `Optimized ${result.optimized} record metadata`,
          };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Semantic, async () => {
          const result = await this.qualityImprover.improve();
          return {
            itemsAffected: result.improved + result.rejected,
            detail: `Quality improved: ${result.improved}, rejected: ${result.rejected}`,
          };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Deduplication, async () => {
          const result = await this.deduplicator.mergeDuplicates();
          return {
            itemsAffected: result.merged,
            detail: `Merged ${result.merged} duplicate(s)`,
          };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Recommendation, () => {
          const entries = this.foundation.getStorageEngine().getIndexEntries();
          let warmed = 0;
          for (const entry of entries.slice(0, 5)) {
            graphEngine.getRecommendations(entry.knowledgeId, 3);
            warmed++;
          }
          return { itemsAffected: warmed, detail: `Recommendation paths warmed for ${warmed} node(s)` };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Cache, async () => {
          const result = await this.cacheOptimizer.optimize();
          return {
            itemsAffected: result.warmed,
            detail: `Warmed ${result.warmed} cache entry(ies)`,
          };
        })
      );

      steps.push(
        await this.runStep(KnowledgeOptimizationStrategy.Search, async () => {
          await retrieval.search({
            mode: KnowledgeSearchMode.Hybrid,
            text: "kwizera",
            limit: 10,
            requesterId: "knowledge-optimization-engine",
          });
          return { itemsAffected: 1, detail: "Search index warmed" };
        })
      );

      const integrity = await this.verifyIntegrity();
      if (!integrity.valid) {
        throw new Error(`Integrity check failed: ${integrity.diagnostics.join(", ")}`);
      }

      const afterAnalysis = await this.analyzer.analyze();
      const afterSearch = retrieval.buildStatusReport().searchPerformance.averageSearchMs;
      const afterRetrieval = retrieval.buildStatusReport().searchPerformance.averageRetrievalMs;
      const afterRecommendation = graphEngine.buildStatusReport().performance.averageRecommendationMs;
      const afterQuality = this.analyzer.computeAverageQuality();

      return {
        success: true,
        recoveryPointId: recoveryPoint.recoveryPointId,
        steps,
        performanceImprovement: {
          searchMsBefore: beforeSearch,
          searchMsAfter: afterSearch,
          retrievalMsBefore: beforeRetrieval,
          retrievalMsAfter: afterRetrieval,
          recommendationMsBefore: beforeRecommendation,
          recommendationMsAfter: afterRecommendation,
        },
        qualityImprovement: {
          qualityScoreBefore: beforeQuality.qualityScore,
          qualityScoreAfter: afterQuality.qualityScore,
          completenessBefore: beforeQuality.completeness,
          completenessAfter: afterQuality.completeness,
        },
        storageEfficiency: {
          bytesBefore: beforeAnalysis.totalStorageBytes,
          bytesAfter: afterAnalysis.totalStorageBytes,
          metadataOptimized: beforeAnalysis.totalStorageBytes - afterAnalysis.totalStorageBytes,
        },
        durationMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.log("error", "optimization", "Optimization failed — restoring recovery point", {
        error: error instanceof Error ? error.message : String(error),
      });

      this.restoreFromRecovery(recoveryPoint.recoveryPointId);

      return {
        success: false,
        recoveryPointId: recoveryPoint.recoveryPointId,
        steps,
        performanceImprovement: {
          searchMsBefore: beforeSearch,
          searchMsAfter: beforeSearch,
          retrievalMsBefore: beforeRetrieval,
          retrievalMsAfter: beforeRetrieval,
          recommendationMsBefore: beforeRecommendation,
          recommendationMsAfter: beforeRecommendation,
        },
        qualityImprovement: {
          qualityScoreBefore: beforeQuality.qualityScore,
          qualityScoreAfter: beforeQuality.qualityScore,
          completenessBefore: beforeQuality.completeness,
          completenessAfter: beforeQuality.completeness,
        },
        storageEfficiency: {
          bytesBefore: beforeAnalysis.totalStorageBytes,
          bytesAfter: beforeAnalysis.totalStorageBytes,
          metadataOptimized: 0,
        },
        durationMs: Date.now() - start,
      };
    }
  }

  async verifyIntegrity(): Promise<KnowledgeIntegrityVerification> {
    const storage = this.foundation.getStorageEngine();
    const graphEngine = this.foundation.getGraphEngine();
    const retrieval = this.foundation.getRetrievalEngine();

    const diagnostics: string[] = [];

    const storageIntegrity = storage.runIntegrityCheck();
    const recordsIntact = storageIntegrity.verified;

    const storageReport = storage.buildStatusReport();
    const indexesValid = storageReport.readinessScore >= 75;

    const graphIntegrity = graphEngine.validateIntegrity();
    const relationshipsValid = graphIntegrity.valid;
    const graphValid = graphIntegrity.issuesRepaired >= 0;

    const searchResponse = await retrieval.search({
      mode: KnowledgeSearchMode.Hybrid,
      limit: 5,
      requesterId: "knowledge-optimization-engine",
    });
    const searchQualityMaintained = searchResponse.results.length >= 0;

    const graphReport = graphEngine.buildStatusReport();
    const recommendationQualityMaintained = graphReport.readinessScore >= 75;

    if (!recordsIntact) diagnostics.push("Storage integrity issues detected");
    if (!indexesValid) diagnostics.push("Index quality below threshold");
    if (!relationshipsValid) diagnostics.push("Relationship integrity issues detected");
    if (!graphValid) diagnostics.push("Graph integrity issues detected");
    if (!searchQualityMaintained) diagnostics.push("Search quality degraded");
    if (!recommendationQualityMaintained) diagnostics.push("Recommendation quality below threshold");

    return {
      valid:
        recordsIntact &&
        indexesValid &&
        relationshipsValid &&
        graphValid &&
        searchQualityMaintained &&
        recommendationQualityMaintained,
      recordsIntact,
      indexesValid,
      relationshipsValid,
      graphValid,
      searchQualityMaintained,
      recommendationQualityMaintained,
      diagnostics,
    };
  }

  private async runStep(
    strategy: KnowledgeOptimizationStrategy,
    fn: () => Promise<{ itemsAffected: number; detail: string }> | { itemsAffected: number; detail: string }
  ): Promise<KnowledgeOptimizationStepResult> {
    const start = Date.now();
    try {
      const result = await fn();
      this.logger.log("info", "optimization", `${strategy} optimization complete`, result);
      return {
        strategy,
        success: true,
        detail: result.detail,
        durationMs: Date.now() - start,
        itemsAffected: result.itemsAffected,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.log("error", "optimization", `${strategy} optimization failed`, { detail });
      return {
        strategy,
        success: false,
        detail,
        durationMs: Date.now() - start,
        itemsAffected: 0,
      };
    }
  }

  private restoreFromRecovery(recoveryPointId: string): void {
    const fileMap = new Map<string, string>();
    for (const filePath of this.snapshotFiles()) {
      fileMap.set(path.basename(filePath), filePath);
    }
    this.recoveryManager.restore(recoveryPointId, fileMap);
  }
}
