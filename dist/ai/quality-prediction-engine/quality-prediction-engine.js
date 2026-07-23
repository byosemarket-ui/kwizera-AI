import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { QualityPredictionAnalyzer } from "./quality-prediction-analyzer.js";
import { QualityPredictionLinker } from "./quality-prediction-linker.js";
import { QualityPredictionLogger } from "./quality-prediction-logger.js";
import { QualityPredictionProcessor } from "./quality-prediction-processor.js";
import { QualityPredictionScorer } from "./quality-prediction-scorer.js";
import { QualityPredictionRecordStore } from "./quality-prediction-stores.js";
import { QualityPredictionEngineError, } from "./types.js";
/**
 * Quality Prediction Engine — evaluates expected quality, consistency and
 * production readiness before image or video generation begins.
 */
export class AiQualityPredictionEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new QualityPredictionLogger();
    records = new QualityPredictionRecordStore();
    analyzer = new QualityPredictionAnalyzer();
    scorer = new QualityPredictionScorer();
    linker = new QualityPredictionLinker();
    processor = null;
    predictionTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "quality-prediction", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new QualityPredictionProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Quality Prediction Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "quality-prediction",
            moduleName: "Quality Prediction Engine",
            category: ProductIntelligenceCategory.QualityPrediction,
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
                "knowledge-engine",
            ],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "quality-prediction"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Quality Prediction Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async predictQuality(input) {
        this.ensureReady();
        const result = await this.processor.predictQuality(input);
        if (result.success)
            this.predictionTimes.push(result.durationMs);
        return result;
    }
    getQualityPrediction(predictionId) {
        this.ensureReady();
        return this.records.get(predictionId) ?? null;
    }
    getQualityPredictionsByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchQualityPredictions(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Quality prediction search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    detectRelationships(predictionId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(predictionId);
        if (!record)
            return null;
        const productionPlan = this.foundation.getProductionPlanningEngine().getProductionPlan(record.productionPlanId);
        const storyboard = this.foundation.getStoryboardIntelligenceEngine().getStoryboard(record.storyboardId);
        const scriptPlan = this.foundation.getScriptPlanningEngine().getScriptPlan(record.scriptPlanId);
        const visualPlan = this.foundation.getVisualPlanningEngine().getVisualPlan(record.visualPlanId);
        const audioPlan = this.foundation.getAudioPlanningEngine().getAudioPlan(record.audioPlanId);
        const creative = this.foundation.getCreativeDirectionEngine().getCreativeDirection(record.creativeId);
        const strategy = this.foundation.getMarketingStrategyIntelligenceEngine().getStrategy(record.strategyId);
        const understanding = this.foundation.getProductUnderstandingEngine().getUnderstanding(record.productId);
        if (!productionPlan || !storyboard || !scriptPlan || !visualPlan || !audioPlan || !creative || !strategy || !understanding) {
            return record.relationships;
        }
        const updated = this.linker.detectRelationships(record, storyboard, scriptPlan, visualPlan, audioPlan, productionPlan, creative, strategy, understanding);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairQualityPrediction(productId, platform) {
        this.ensureReady();
        const productionEngine = this.foundation.getProductionPlanningEngine();
        let productionPlan = productionEngine.getProductionPlansByProduct(productId)[0];
        if (!productionPlan?.productionReady) {
            const repaired = await productionEngine.repairProductionPlan(productId, platform);
            if (!repaired?.success || !repaired.record)
                return null;
            productionPlan = repaired.record;
        }
        this.logger.log("info", "validation", "Repairing quality prediction", { productId });
        return this.predictQuality({
            productId,
            productionPlanId: productionPlan.productionPlanId,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgOverall = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.overallQualityScore, 0) / all.length)
            : 0;
        const avgReadiness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getProductionPlanningEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            qualityAnalysisStatus: "full pipeline quality analysis across all planning modules active",
            predictionStatus: "success probability, engagement and complexity predictions ready",
            riskAnalysisStatus: "critical, high, medium and low risk detection active",
            predictionsPrepared: all.length,
            averageOverallQualityScore: avgOverall,
            averageProductionReadinessScore: avgReadiness,
            performance: {
                averagePredictionMs: avg(this.predictionTimes),
                averageSearchMs: avg(this.searchTimes),
                averageRelationshipMs: avg(this.relationshipTimes),
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
            throw new QualityPredictionEngineError("Quality Prediction Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=quality-prediction-engine.js.map