import fs from "node:fs";
import path from "node:path";
import { KnowledgeAccessPermission, KnowledgeCategory, KnowledgeModuleStatus, KnowledgeSource, } from "../knowledge-foundation/types.js";
import { KnowledgeCacheOptimizer } from "./knowledge-cache-optimizer.js";
import { KnowledgeAnalyzer } from "./knowledge-analyzer.js";
import { KnowledgeDeduplicator } from "./knowledge-deduplicator.js";
import { KnowledgeMetadataOptimizer } from "./knowledge-metadata-optimizer.js";
import { KnowledgeOptimizer } from "./knowledge-optimizer.js";
import { KnowledgeQualityImprover } from "./knowledge-quality-improver.js";
import { KnowledgeTierManager } from "./knowledge-tier-manager.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeRecoveryPointManager } from "./recovery-point-manager.js";
import { KnowledgeOptimizationEngineError, KnowledgeTier, } from "./types.js";
/**
 * Knowledge Optimization Engine — continuously improves knowledge quality, organization, and performance.
 */
export class AiKnowledgeOptimizationEngine {
    foundation = null;
    storageRoot = "";
    optimizationDir = "";
    initialized = false;
    startupComplete = false;
    logger = new KnowledgeOptimizationLogger();
    analyzer = null;
    tierManager = null;
    deduplicator = null;
    metadataOptimizer = null;
    qualityImprover = null;
    cacheOptimizer = null;
    recoveryManager = null;
    optimizer = null;
    optimizationTimes = [];
    analysisTimes = [];
    totalOptimizations = 0;
    lastOptimizationMs = 0;
    lastTierDistribution = {
        [KnowledgeTier.Core]: 0,
        [KnowledgeTier.FrequentlyUsed]: 0,
        [KnowledgeTier.Creative]: 0,
        [KnowledgeTier.Business]: 0,
        [KnowledgeTier.Industry]: 0,
        [KnowledgeTier.Archived]: 0,
        [KnowledgeTier.Historical]: 0,
        [KnowledgeTier.Experimental]: 0,
    };
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.optimizationDir = path.join(storageRoot, "knowledge", "optimization", "engine");
        fs.mkdirSync(this.optimizationDir, { recursive: true });
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.analyzer = new KnowledgeAnalyzer(foundation, this.logger);
        this.tierManager = new KnowledgeTierManager(foundation, storageRoot, this.logger);
        this.tierManager.initialize(this.optimizationDir);
        this.deduplicator = new KnowledgeDeduplicator(foundation, this.tierManager, this.logger);
        this.metadataOptimizer = new KnowledgeMetadataOptimizer(foundation, this.logger);
        this.qualityImprover = new KnowledgeQualityImprover(foundation, this.logger);
        this.cacheOptimizer = new KnowledgeCacheOptimizer(foundation, this.tierManager, this.logger);
        this.cacheOptimizer.initialize(this.optimizationDir);
        this.recoveryManager = new KnowledgeRecoveryPointManager(foundation, this.logger);
        this.recoveryManager.initialize(this.optimizationDir);
        this.optimizer = new KnowledgeOptimizer(foundation, this.analyzer, this.tierManager, this.deduplicator, this.metadataOptimizer, this.qualityImprover, this.cacheOptimizer, this.recoveryManager, this.logger, () => this.getSnapshotFiles());
        this.initialized = true;
        this.logger.log("info", "startup", "Knowledge Optimization Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.tierManager.classifyAll();
        this.lastTierDistribution = this.tierManager.getDistribution();
        this.foundation.registerKnowledgeModule({
            knowledgeId: "knowledge-optimization",
            knowledgeName: "Knowledge Optimization",
            category: KnowledgeCategory.Optimization,
            version: "0.1.0",
            status: KnowledgeModuleStatus.Active,
            dependencies: ["knowledge-engine", "memory-engine"],
            source: KnowledgeSource.KnowledgeModule,
            qualityScore: 95,
            confidenceScore: 92,
            storageLocation: this.optimizationDir,
            accessPermissions: [
                KnowledgeAccessPermission.Read,
                KnowledgeAccessPermission.Write,
                KnowledgeAccessPermission.Validate,
                KnowledgeAccessPermission.Admin,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Knowledge Optimization Engine startup complete", {
            tiers: this.lastTierDistribution,
            durationMs: Date.now() - start,
        });
    }
    async analyzeKnowledge() {
        this.ensureReady();
        const start = Date.now();
        const report = await this.analyzer.analyze();
        this.analysisTimes.push(Date.now() - start);
        return report;
    }
    async runOptimization() {
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
    detectDuplicates() {
        this.ensureReady();
        return this.deduplicator.detectDuplicates();
    }
    async mergeDuplicates() {
        this.ensureReady();
        return this.deduplicator.mergeDuplicates();
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
    getTier(knowledgeId) {
        this.ensureReady();
        return this.tierManager.getTier(knowledgeId);
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
        const graphReport = this.foundation?.getGraphEngine().buildStatusReport();
        const recoveryPoints = this.recoveryManager?.list() ?? [];
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            knowledgeOptimizationStatus: this.totalOptimizations > 0
                ? `${this.totalOptimizations} optimization(s) completed`
                : "awaiting first optimization",
            knowledgeQualityImprovement: "continuous quality improvement active",
            relationshipOptimizationStatus: "relationship and graph optimization enabled",
            recommendationPerformance: graphReport?.recommendationQuality ?? "awaiting recommendations",
            graphPerformance: graphReport?.graphStatus ?? "awaiting graph data",
            recoveryStatus: `${recoveryPoints.length} recovery point(s) available`,
            totalOptimizations: this.totalOptimizations,
            lastOptimizationMs: this.lastOptimizationMs,
            tierDistribution: this.lastTierDistribution,
            performance: {
                averageOptimizationMs: avg(this.optimizationTimes),
                averageAnalysisMs: avg(this.analysisTimes),
                lastSearchMs: retrievalReport?.searchPerformance.lastSearchMs ?? 0,
                lastRetrievalMs: retrievalReport?.searchPerformance.lastRetrievalMs ?? 0,
                lastRecommendationMs: graphReport?.performance.averageRecommendationMs ?? 0,
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
            path.join(this.storageRoot, "knowledge", "graph", "knowledge-graph.json"),
        ];
        return files.filter((f) => fs.existsSync(f));
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new KnowledgeOptimizationEngineError("Knowledge Optimization Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=knowledge-optimization-engine.js.map