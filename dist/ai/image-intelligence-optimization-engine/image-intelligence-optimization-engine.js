import path from "node:path";
import { ImageIntelligenceAccessPermission, ImageIntelligenceCategory, ImageIntelligenceModuleStatus, } from "../image-intelligence-foundation/types.js";
import { ImageIntelligenceOptimizationAnalyzer } from "./image-intelligence-optimization-analyzer.js";
import { ImageIntelligenceOptimizationLinker } from "./image-intelligence-optimization-linker.js";
import { ImageIntelligenceOptimizationLogger } from "./image-intelligence-optimization-logger.js";
import { ImageIntelligenceOptimizationProcessor } from "./image-intelligence-optimization-processor.js";
import { ImageIntelligenceOptimizationScorer } from "./image-intelligence-optimization-scorer.js";
import { ImageIntelligenceOptimizationRecordStore } from "./image-intelligence-optimization-stores.js";
import { ImageIntelligenceOptimizationEngineError, } from "./types.js";
/**
 * Image Intelligence Optimization Engine — continuously improves quality,
 * speed, consistency and efficiency across all Image Intelligence modules.
 */
export class AiImageIntelligenceOptimizationEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ImageIntelligenceOptimizationLogger();
    records = new ImageIntelligenceOptimizationRecordStore();
    analyzer = new ImageIntelligenceOptimizationAnalyzer();
    scorer = new ImageIntelligenceOptimizationScorer();
    linker = new ImageIntelligenceOptimizationLinker();
    processor = null;
    optimizationTimes = [];
    searchTimes = [];
    recoveryTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "optimization", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ImageIntelligenceOptimizationProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Image Intelligence Optimization Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageIntelligenceModule({
            moduleId: "image-intelligence-optimization",
            moduleName: "Image Intelligence Optimization Engine",
            category: ImageIntelligenceCategory.Optimization,
            version: "0.1.0",
            status: ImageIntelligenceModuleStatus.Active,
            dependencies: [
                "image-engine",
                "image-analysis-engine",
                "image-understanding-engine",
                "object-detection-intelligence",
                "background-intelligence",
                "composition-intelligence",
                "lighting-color-intelligence",
                "brand-visual-intelligence",
                "image-enhancement-planning",
                "creative-image-intelligence",
                "production-image-planning",
                "image-quality-prediction",
            ],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "optimization"),
            accessPermissions: [
                ImageIntelligenceAccessPermission.Read,
                ImageIntelligenceAccessPermission.Admin,
                ImageIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Image Intelligence Optimization Engine startup complete", {
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
    getOptimizationsByImage(imageId) {
        this.ensureReady();
        return this.records.getByImage(imageId);
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
    async repairOptimization(imageId, _platform) {
        this.ensureReady();
        const qualityEngine = this.foundation.getImageQualityPredictionEngine();
        let qp = qualityEngine.getQualityPrediction(imageId);
        if (!qp?.productionReady) {
            const repaired = await qualityEngine.repairQualityPrediction(imageId);
            if (!repaired?.success || !repaired.record)
                return null;
            qp = repaired.record;
        }
        this.logger.log("info", "validation", "Repairing optimization", { imageId });
        return this.runOptimization({ imageId });
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
        if (!this.foundation?.getImageQualityPredictionEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            optimizationStatus: "continuous improvement across all Image Intelligence modules active",
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
            throw new ImageIntelligenceOptimizationEngineError("Image Intelligence Optimization Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=image-intelligence-optimization-engine.js.map