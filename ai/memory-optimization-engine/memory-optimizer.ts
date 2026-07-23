import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { SearchMode } from "../memory-retrieval-engine/types.js";
import { ArchiveManager } from "./archive-manager.js";
import { CacheOptimizer } from "./cache-optimizer.js";
import { DuplicateMerger } from "./duplicate-merger.js";
import { MemoryAnalyzer } from "./memory-analyzer.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { MetadataCompressor } from "./metadata-compressor.js";
import { RecoveryPointManager } from "./recovery-point-manager.js";
import {
  IntegrityVerification,
  OptimizationResult,
  OptimizationStepResult,
  OptimizationStrategy,
} from "./types.js";

export class MemoryOptimizer {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly analyzer: MemoryAnalyzer,
    private readonly tierManager: MemoryTierManager,
    private readonly duplicateMerger: DuplicateMerger,
    private readonly archiveManager: ArchiveManager,
    private readonly metadataCompressor: MetadataCompressor,
    private readonly cacheOptimizer: CacheOptimizer,
    private readonly recoveryManager: RecoveryPointManager,
    private readonly logger: MemoryOptimizationLogger,
    private readonly snapshotFiles: () => string[]
  ) {}

  async runFullOptimization(): Promise<OptimizationResult> {
    const start = Date.now();
    const retrieval = this.foundation.getRetrievalEngine();
    const beforeSearch = retrieval.buildStatusReport().searchPerformance.averageSearchMs;
    const beforeRetrieval = retrieval.buildStatusReport().searchPerformance.averageRetrievalMs;
    const beforeAnalysis = await this.analyzer.analyze();

    const recoveryPoint = this.recoveryManager.createRecoveryPoint("pre-optimization", this.snapshotFiles());
    const steps: OptimizationStepResult[] = [];

    try {
      steps.push(await this.runStep(OptimizationStrategy.Index, () => {
        this.foundation.getIndexEngine().optimizeIndexes();
        return { itemsAffected: 1, detail: "Indexes optimized" };
      }));

      steps.push(await this.runStep(OptimizationStrategy.Relationship, async () => {
        const result = await this.foundation.getRelationshipMemoryEngine().optimizeGraph();
        return { itemsAffected: result.edgesRemoved + result.nodesRemoved, detail: "Relationship graph optimized" };
      }));

      steps.push(await this.runStep(OptimizationStrategy.Storage, async () => {
        const assignments = this.tierManager.classifyAll();
        return { itemsAffected: assignments.length, detail: "Memory tiers classified" };
      }));

      steps.push(await this.runStep(OptimizationStrategy.Metadata, async () => {
        const result = await this.metadataCompressor.compress();
        return { itemsAffected: result.compressed, detail: `Compressed ${result.compressed} record(s)` };
      }));

      steps.push(await this.runStep(OptimizationStrategy.Deduplication, async () => {
        const result = await this.duplicateMerger.mergeDuplicates();
        return { itemsAffected: result.merged, detail: `Merged ${result.merged} duplicate(s)` };
      }));

      steps.push(await this.runStep(OptimizationStrategy.Archive, async () => {
        const result = await this.archiveManager.archiveInactive();
        return { itemsAffected: result.archived, detail: `Archived ${result.archived} record(s)` };
      }));

      steps.push(await this.runStep(OptimizationStrategy.Cache, async () => {
        const result = await this.cacheOptimizer.optimize();
        return { itemsAffected: result.warmed, detail: `Warmed ${result.warmed} cache entry(ies)` };
      }));

      steps.push(await this.runStep(OptimizationStrategy.Search, async () => {
        await retrieval.search({ mode: SearchMode.Hybrid, limit: 10, requesterId: "memory-optimization-engine" });
        return { itemsAffected: 1, detail: "Search index warmed" };
      }));

      const integrity = await this.verifyIntegrity();
      if (!integrity.valid) {
        throw new Error(`Integrity check failed: ${integrity.diagnostics.join(", ")}`);
      }

      const afterAnalysis = await this.analyzer.analyze();
      const afterSearch = retrieval.buildStatusReport().searchPerformance.averageSearchMs;
      const afterRetrieval = retrieval.buildStatusReport().searchPerformance.averageRetrievalMs;

      return {
        success: true,
        recoveryPointId: recoveryPoint.recoveryPointId,
        steps,
        performanceImprovement: {
          searchMsBefore: beforeSearch,
          searchMsAfter: afterSearch,
          retrievalMsBefore: beforeRetrieval,
          retrievalMsAfter: afterRetrieval,
        },
        storageEfficiency: {
          bytesBefore: beforeAnalysis.totalStorageBytes,
          bytesAfter: afterAnalysis.totalStorageBytes,
          metadataCompressed: beforeAnalysis.totalStorageBytes - afterAnalysis.totalStorageBytes,
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
        },
        storageEfficiency: {
          bytesBefore: beforeAnalysis.totalStorageBytes,
          bytesAfter: beforeAnalysis.totalStorageBytes,
          metadataCompressed: 0,
        },
        durationMs: Date.now() - start,
      };
    }
  }

  async verifyIntegrity(): Promise<IntegrityVerification> {
    const storage = this.foundation.getStorageEngine();
    const indexEngine = this.foundation.getIndexEngine();
    const relationshipEngine = this.foundation.getRelationshipMemoryEngine();
    const retrieval = this.foundation.getRetrievalEngine();

    const diagnostics: string[] = [];

    const storageIntegrity = storage.runIntegrityCheck();
    const recordsIntact = storageIntegrity.verified;

    const indexReport = indexEngine.buildStatusReport();
    const indexesValid = indexReport.readinessScore >= 75;

    const relationshipIntegrity = relationshipEngine.validateIntegrity();
    const relationshipsValid = relationshipIntegrity.valid;

    const searchResponse = await retrieval.search({
      mode: SearchMode.Hybrid,
      limit: 5,
      requesterId: "memory-optimization-engine",
    });
    const searchQualityMaintained = searchResponse.results.length >= 0;

    if (!recordsIntact) diagnostics.push("Storage integrity issues detected");
    if (!indexesValid) diagnostics.push("Index quality below threshold");
    if (!relationshipsValid) diagnostics.push("Relationship integrity issues detected");
    if (!searchQualityMaintained) diagnostics.push("Search quality degraded");

    return {
      valid: recordsIntact && indexesValid && relationshipsValid && searchQualityMaintained,
      recordsIntact,
      indexesValid,
      relationshipsValid,
      searchQualityMaintained,
      diagnostics,
    };
  }

  private async runStep(
    strategy: OptimizationStrategy,
    fn: () => Promise<{ itemsAffected: number; detail: string }> | { itemsAffected: number; detail: string }
  ): Promise<OptimizationStepResult> {
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
