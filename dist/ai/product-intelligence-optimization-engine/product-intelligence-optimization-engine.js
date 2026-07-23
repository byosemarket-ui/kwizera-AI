import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { ProductIntelligenceOptimizationAnalyzer } from "./product-intelligence-optimization-analyzer.js";
import { ProductIntelligenceOptimizationLinker } from "./product-intelligence-optimization-linker.js";
import { ProductIntelligenceOptimizationLogger } from "./product-intelligence-optimization-logger.js";
import { ProductIntelligenceOptimizationProcessor } from "./product-intelligence-optimization-processor.js";
import { ProductIntelligenceOptimizationScorer } from "./product-intelligence-optimization-scorer.js";
import { ProductIntelligenceOptimizationRecordStore } from "./product-intelligence-optimization-stores.js";
import { ProductIntelligenceOptimizationEngineError, } from "./types.js";
/**
 * Product Intelligence Optimization Engine — continuously improves quality,
 * speed, consistency and efficiency across all Product Intelligence modules.
 */
export class AiProductIntelligenceOptimizationEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ProductIntelligenceOptimizationLogger();
    records = new ProductIntelligenceOptimizationRecordStore();
    analyzer = new ProductIntelligenceOptimizationAnalyzer();
    scorer = new ProductIntelligenceOptimizationScorer();
    linker = new ProductIntelligenceOptimizationLinker();
    processor = null;
    optimizationTimes = [];
    searchTimes = [];
    recoveryTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "optimization", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ProductIntelligenceOptimizationProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Product Intelligence Optimization Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "product-intelligence-optimization",
            moduleName: "Product Intelligence Optimization Engine",
            category: ProductIntelligenceCategory.Optimization,
            version: "0.1.0",
            status: ProductIntelligenceModuleStatus.Active,
            dependencies: [
                "product-engine",
                "product-analysis-engine",
                "product-understanding-engine",
                "audience-intelligence",
                "marketing-strategy-intelligence",
                "creative-direction",
                "storyboard-intelligence",
                "script-planning",
                "visual-planning",
                "audio-planning",
                "production-planning",
                "quality-prediction",
                "knowledge-engine",
            ],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "optimization"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Admin,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Product Intelligence Optimization Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async runOptimization(input) {
        this.ensureReady();
        const result = await this.processor.runOptimization(input);
        if (result.success)
            this.optimizationTimes.push(result.durationMs);
        return result;
    }
    getOptimization(optimizationId) {
        this.ensureReady();
        return this.records.get(optimizationId) ?? null;
    }
    getOptimizationsByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchOptimizations(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Optimization search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    restoreRecoveryPoint(recoveryId) {
        this.ensureReady();
        const start = Date.now();
        const restored = this.processor.restoreRecoveryPoint(recoveryId);
        this.recoveryTimes.push(Date.now() - start);
        return restored;
    }
    async repairOptimization(productId, platform) {
        this.ensureReady();
        const qualityEngine = this.foundation.getQualityPredictionEngine();
        let qp = qualityEngine.getQualityPredictionsByProduct(productId)[0];
        if (!qp?.productionReady) {
            const repaired = await qualityEngine.repairQualityPrediction(productId, platform);
            if (!repaired?.success || !repaired.record)
                return null;
            qp = repaired.record;
        }
        this.logger.log("info", "validation", "Repairing optimization", { productId });
        return this.runOptimization({ productId });
    }
    getCache() {
        this.ensureReady();
        return this.records.getCache();
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgImprovement = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.overallImprovementScore, 0) / all.length)
            : 0;
        const avgPlanning = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.planningImprovementScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getQualityPredictionEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            optimizationStatus: "continuous improvement across all Product Intelligence modules active",
            cacheStatus: `cache hit rate ${this.records.getCache().hitRate}%`,
            recoveryStatus: "recovery points created before every optimization run",
            optimizationsCompleted: all.length,
            averageImprovementScore: avgImprovement,
            averagePlanningImprovement: avgPlanning,
            performance: {
                averageOptimizationMs: avg(this.optimizationTimes),
                averageSearchMs: avg(this.searchTimes),
                averageRecoveryMs: avg(this.recoveryTimes),
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
    ensureReady() {
        if (!this.initialized || !this.foundation || !this.processor) {
            throw new ProductIntelligenceOptimizationEngineError("Product Intelligence Optimization Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=product-intelligence-optimization-engine.js.map