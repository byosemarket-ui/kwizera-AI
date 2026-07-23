import fs from "node:fs";
import path from "node:path";
import { ArchiveManager } from "./archive-manager.js";
import { CacheOptimizer } from "./cache-optimizer.js";
import { DuplicateMerger } from "./duplicate-merger.js";
import { MemoryAnalyzer } from "./memory-analyzer.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryOptimizer } from "./memory-optimizer.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { MetadataCompressor } from "./metadata-compressor.js";
import { RecoveryPointManager } from "./recovery-point-manager.js";
import { MemoryOptimizationEngineError, MemoryTier, } from "./types.js";
/**
 * Memory Optimization Engine — keeps the memory system fast, efficient, and scalable.
 */
export class AiMemoryOptimizationEngine {
    foundation = null;
    storageRoot = "";
    optimizationDir = "";
    initialized = false;
    startupComplete = false;
    logger = new MemoryOptimizationLogger();
    analyzer = null;
    tierManager = null;
    duplicateMerger = null;
    archiveManager = null;
    metadataCompressor = null;
    cacheOptimizer = null;
    recoveryManager = null;
    optimizer = null;
    optimizationTimes = [];
    analysisTimes = [];
    totalOptimizations = 0;
    lastOptimizationMs = 0;
    lastTierDistribution = {
        [MemoryTier.Active]: 0,
        [MemoryTier.FrequentlyUsed]: 0,
        [MemoryTier.Learning]: 0,
        [MemoryTier.Archived]: 0,
        [MemoryTier.Historical]: 0,
        [MemoryTier.System]: 0,
    };
    initialize(foundation, storageRoot) {
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
        this.optimizer = new MemoryOptimizer(foundation, this.analyzer, this.tierManager, this.duplicateMerger, this.archiveManager, this.metadataCompressor, this.cacheOptimizer, this.recoveryManager, this.logger, () => this.getSnapshotFiles());
        this.initialized = true;
        this.logger.log("info", "startup", "Memory Optimization Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.tierManager.classifyAll();
        this.lastTierDistribution = this.tierManager.getDistribution();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Memory Optimization Engine startup complete", {
            tiers: this.lastTierDistribution,
            durationMs: Date.now() - start,
        });
    }
    async analyzeMemory() {
        this.ensureReady();
        const start = Date.now();
        const report = await this.analyzer.analyze();
        this.analysisTimes.push(Date.now() - start);
        return report;
    }
    async optimize() {
        this.ensureReady();
        const start = Date.now();
        const result = await this.optimizer.runFullOptimization();
        this.totalOptimizations++;
        this.lastOptimizationMs = Date.now() - start;
        this.optimizationTimes.push(this.lastOptimizationMs);
        this.lastTierDistribution = this.tierManager.getDistribution();
        this.logger.log("info", "optimization", "Full optimization complete", {
            success: result.success,
            durationMs: result.durationMs,
            recoveryPointId: result.recoveryPointId,
        });
        return result;
    }
    async archiveInactive() {
        this.ensureReady();
        return this.archiveManager.archiveInactive();
    }
    detectDuplicates() {
        this.ensureReady();
        return this.duplicateMerger.detectDuplicates();
    }
    async mergeDuplicates() {
        this.ensureReady();
        return this.duplicateMerger.mergeDuplicates();
    }
    async optimizeCache() {
        this.ensureReady();
        return this.cacheOptimizer.optimize();
    }
    classifyTiers() {
        this.ensureReady();
        const assignments = this.tierManager.classifyAll();
        this.lastTierDistribution = this.tierManager.getDistribution();
        return assignments;
    }
    getTier(memoryId) {
        this.ensureReady();
        return this.tierManager.getTier(memoryId);
    }
    createRecoveryPoint(label) {
        this.ensureReady();
        return this.recoveryManager.createRecoveryPoint(label, this.getSnapshotFiles());
    }
    restoreRecoveryPoint(recoveryPointId) {
        this.ensureReady();
        const fileMap = new Map();
        for (const filePath of this.getSnapshotFiles()) {
            fileMap.set(path.basename(filePath), filePath);
        }
        return this.recoveryManager.restore(recoveryPointId, fileMap);
    }
    listRecoveryPoints() {
        this.ensureReady();
        return this.recoveryManager.list();
    }
    async verifyIntegrity() {
        this.ensureReady();
        return this.optimizer.verifyIntegrity();
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
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
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    getSnapshotFiles() {
        const files = [
            path.join(this.optimizationDir, "tiers.json"),
            path.join(this.optimizationDir, "cache-priority.json"),
            path.join(this.storageRoot, "memory", "relationships", "relationship-graph.json"),
        ];
        return files.filter((f) => fs.existsSync(f));
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new MemoryOptimizationEngineError("Memory Optimization Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=memory-optimization-engine.js.map