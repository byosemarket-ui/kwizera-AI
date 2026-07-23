import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { ProductUnderstandingMarketingGoal } from "../product-understanding-engine/types.js";
import { AudienceAnalyzer } from "./audience-analyzer.js";
import { AudienceLinker } from "./audience-linker.js";
import { AudienceLogger } from "./audience-logger.js";
import { AudienceProcessor } from "./audience-processor.js";
import { AudienceScorer } from "./audience-scorer.js";
import { AudienceRecordStore } from "./audience-stores.js";
import { AudienceIntelligenceEngineError, } from "./types.js";
/**
 * Target Audience Intelligence Engine — understands, organizes, and analyzes audiences
 * most likely to benefit from a product or service.
 */
export class AiTargetAudienceIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new AudienceLogger();
    records = new AudienceRecordStore();
    analyzer = new AudienceAnalyzer();
    scorer = new AudienceScorer();
    linker = new AudienceLinker();
    processor = null;
    analysisTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "audience", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new AudienceProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Target Audience Intelligence Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "audience-intelligence",
            moduleName: "Target Audience Intelligence Engine",
            category: ProductIntelligenceCategory.AudienceIntelligence,
            version: "0.1.0",
            status: ProductIntelligenceModuleStatus.Active,
            dependencies: [
                "product-engine",
                "product-analysis-engine",
                "product-understanding-engine",
                "knowledge-engine",
                "memory-engine",
            ],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "audience"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Write,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Target Audience Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async analyzeAudience(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success)
            this.analysisTimes.push(result.durationMs);
        return result;
    }
    getAudience(audienceId) {
        this.ensureReady();
        return this.records.get(audienceId) ?? null;
    }
    getAudiencesByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchAudiences(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        const durationMs = Date.now() - start;
        this.searchTimes.push(durationMs);
        this.logger.log("info", "search", "Audience search executed", {
            query,
            resultCount: results.length,
            durationMs,
        });
        return results;
    }
    detectRelationships(audienceId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(audienceId);
        if (!record)
            return null;
        const understanding = this.foundation.getProductUnderstandingEngine().getUnderstanding(record.productId);
        const analysis = this.foundation.getProductAnalysisEngine().getProduct(record.productId);
        if (!understanding || !analysis)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), understanding, analysis, record.relationships.campaigns[0]);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairAudience(productId) {
        this.ensureReady();
        const understandingEngine = this.foundation.getProductUnderstandingEngine();
        const analysisEngine = this.foundation.getProductAnalysisEngine();
        let understanding = understandingEngine.getUnderstanding(productId);
        if (!understanding) {
            const repairedUnderstanding = await understandingEngine.repairUnderstanding(productId);
            if (!repairedUnderstanding?.success || !repairedUnderstanding.record)
                return null;
            understanding = repairedUnderstanding.record;
        }
        let analysis = analysisEngine.getProduct(productId);
        if (!analysis?.validated) {
            const repairedAnalysis = await analysisEngine.repairProduct(productId);
            if (!repairedAnalysis?.success || !repairedAnalysis.record)
                return null;
            analysis = repairedAnalysis.record;
        }
        this.logger.log("info", "validation", "Repairing audience intelligence", { productId });
        return this.analyzeAudience({
            productId,
            marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgRelevance = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.audienceRelevanceScore, 0) / all.length)
            : 0;
        const avgConfidence = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.audienceConfidenceScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getProductAnalysisEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getProductUnderstandingEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            audienceAnalysisStatus: "audience profiles, psychological understanding, and behavior patterns from validated product data",
            segmentationStatus: "segmentation by product type, industry, needs, goals, and communication preferences",
            relationshipStatus: `${all.length} audiences indexed for relationship detection`,
            audiencesAnalyzed: all.length,
            averageRelevanceScore: avgRelevance,
            averageConfidenceScore: avgConfidence,
            performance: {
                averageAnalysisMs: avg(this.analysisTimes),
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
            throw new AudienceIntelligenceEngineError("Target Audience Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=audience-intelligence-engine.js.map