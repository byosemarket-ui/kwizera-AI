import fs from "node:fs";
import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ArchiveManager } from "./archive-manager.js";
import { CacheOptimizer } from "./cache-optimizer.js";
import { DuplicateMerger } from "./duplicate-merger.js";
import { MemoryAnalyzer } from "./memory-analyzer.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryOptimizer } from "./memory-optimizer.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { MetadataCompressor } from "./metadata-compressor.js";
import { RecoveryPointManager } from "./recovery-point-manager.js";
import {
  ArchiveResult,
  CacheOptimizationResult,
  DuplicateGroup,
  DuplicateMergeResult,
  IntegrityVerification,
  MemoryAnalysisReport,
  MemoryOptimizationEngineError,
  MemoryOptimizationStatusReport,
  MemoryTier,
  MemoryTierAssignment,
  OptimizationResult,
  RecoveryPoint,
} from "./types.js";

/**
 * Memory Optimization Engine — keeps the memory system fast, efficient, and scalable.
 */
export class AiMemoryOptimizationEngine {
  private foundation: AiMemoryFoundation | null = null;
  private storageRoot = "";
  private optimizationDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new MemoryOptimizationLogger();

  private analyzer: MemoryAnalyzer | null = null;
  private tierManager: MemoryTierManager | null = null;
  private duplicateMerger: DuplicateMerger | null = null;
  private archiveManager: ArchiveManager | null = null;
  private metadataCompressor: MetadataCompressor | null = null;
  private cacheOptimizer: CacheOptimizer | null = null;
  private recoveryManager: RecoveryPointManager | null = null;
  private optimizer: MemoryOptimizer | null = null;

  private optimizationTimes: number[] = [];
  private analysisTimes: number[] = [];
  private totalOptimizations = 0;
  private lastOptimizationMs = 0;
  private lastTierDistribution: Record<MemoryTier, number> = {
    [MemoryTier.Active]: 0,
    [MemoryTier.FrequentlyUsed]: 0,
    [MemoryTier.Learning]: 0,
    [MemoryTier.Archived]: 0,
    [MemoryTier.Historical]: 0,
    [MemoryTier.System]: 0,
  };

  initialize(foundation: AiMemoryFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.optimizationDir = path.join(storageRoot, "memory", "optimization");

    const logDir = path.join(storageRoot, "logs");
    this.logger.initialize(logDir);

    this.analyzer = new MemoryAnalyzer(foundation, this.logger);
    this.tierManager = new MemoryTierManager(foundation, storageRoot, this.logger);
    this.tierManager.initialize(this.optimizationDir);

    this.duplicateMerger = new DuplicateMerger(foundation, this.tierManager, this.logger);
    this.archiveManager = new ArchiveManager(foundation, this.tierManager, this.logger);
    this.metadataCompressor = new MetadataCompressor(foundation, this.logger);
    this.cacheOptimizer = new CacheOptimizer(foundation, this.tierManager, this.logger);
    this.cacheOptimizer.initialize(this.optimizationDir);

    this.recoveryManager = new RecoveryPointManager(foundation, this.logger);
    this.recoveryManager.initialize(this.optimizationDir);

    this.optimizer = new MemoryOptimizer(
      foundation,
      this.analyzer,
      this.tierManager,
      this.duplicateMerger,
      this.archiveManager,
      this.metadataCompressor,
      this.cacheOptimizer,
      this.recoveryManager,
      this.logger,
      () => this.getSnapshotFiles()
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Memory Optimization Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    this.tierManager!.classifyAll();
    this.lastTierDistribution = this.tierManager!.getDistribution();

    this.startupComplete = true;
    this.logger.log("info", "startup", "Memory Optimization Engine startup complete", {
      tiers: this.lastTierDistribution,
      durationMs: Date.now() - start,
    });
  }

  async analyzeMemory(): Promise<MemoryAnalysisReport> {
    this.ensureReady();
    const start = Date.now();
    const report = await this.analyzer!.analyze();
    this.analysisTimes.push(Date.now() - start);
    return report;
  }

  async optimize(): Promise<OptimizationResult> {
    this.ensureReady();
    const start = Date.now();

    const result = await this.optimizer!.runFullOptimization();
    this.totalOptimizations++;
    this.lastOptimizationMs = Date.now() - start;
    this.optimizationTimes.push(this.lastOptimizationMs);
    this.lastTierDistribution = this.tierManager!.getDistribution();

    this.logger.log("info", "optimization", "Full optimization complete", {
      success: result.success,
      durationMs: result.durationMs,
      recoveryPointId: result.recoveryPointId,
    });

    return result;
  }

  async archiveInactive(): Promise<ArchiveResult> {
    this.ensureReady();
    return this.archiveManager!.archiveInactive();
  }

  detectDuplicates(): DuplicateGroup[] {
    this.ensureReady();
    return this.duplicateMerger!.detectDuplicates();
  }

  async mergeDuplicates(): Promise<DuplicateMergeResult> {
    this.ensureReady();
    return this.duplicateMerger!.mergeDuplicates();
  }

  async optimizeCache(): Promise<CacheOptimizationResult> {
    this.ensureReady();
    return this.cacheOptimizer!.optimize();
  }

  classifyTiers(): MemoryTierAssignment[] {
    this.ensureReady();
    const assignments = this.tierManager!.classifyAll();
    this.lastTierDistribution = this.tierManager!.getDistribution();
    return assignments;
  }

  getTier(memoryId: string): MemoryTierAssignment | undefined {
    this.ensureReady();
    return this.tierManager!.getTier(memoryId);
  }

  createRecoveryPoint(label: string): RecoveryPoint {
    this.ensureReady();
    return this.recoveryManager!.createRecoveryPoint(label, this.getSnapshotFiles());
  }

  restoreRecoveryPoint(recoveryPointId: string): boolean {
    this.ensureReady();
    const fileMap = new Map<string, string>();
    for (const filePath of this.getSnapshotFiles()) {
      fileMap.set(path.basename(filePath), filePath);
    }
    return this.recoveryManager!.restore(recoveryPointId, fileMap);
  }

  listRecoveryPoints(): RecoveryPoint[] {
    this.ensureReady();
    return this.recoveryManager!.list();
  }

  async verifyIntegrity(): Promise<IntegrityVerification> {
    this.ensureReady();
    return this.optimizer!.verifyIntegrity();
  }

  buildStatusReport(): MemoryOptimizationStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    const retrievalReport = this.foundation?.getRetrievalEngine().buildStatusReport();
    const recoveryPoints = this.recoveryManager?.list() ?? [];

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      performanceImprovement: this.totalOptimizations > 0
        ? `${this.totalOptimizations} optimization(s) completed`
        : "awaiting first optimization",
      storageEfficiency: "tier-based organization active",
      integrityStatus: "post-optimization verification enabled",
      recoveryStatus: `${recoveryPoints.length} recovery point(s) available`,
      totalOptimizations: this.totalOptimizations,
      lastOptimizationMs: this.lastOptimizationMs,
      tierDistribution: this.lastTierDistribution,
      performance: {
        averageOptimizationMs: avg(this.optimizationTimes),
        averageAnalysisMs: avg(this.analysisTimes),
        lastSearchMs: retrievalReport?.searchPerformance.lastSearchMs ?? 0,
        lastRetrievalMs: retrievalReport?.searchPerformance.lastRetrievalMs ?? 0,
        memoryUsageEstimateMb: 0,
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  private getSnapshotFiles(): string[] {
    const files = [
      path.join(this.optimizationDir, "tiers.json"),
      path.join(this.optimizationDir, "cache-priority.json"),
      path.join(this.storageRoot, "memory", "relationships", "relationship-graph.json"),
    ];
    return files.filter((f) => fs.existsSync(f));
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new MemoryOptimizationEngineError(
        "Memory Optimization Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
