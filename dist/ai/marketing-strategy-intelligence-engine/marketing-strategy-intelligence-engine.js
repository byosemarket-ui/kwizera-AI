import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { MarketingStrategyAnalyzer } from "./marketing-strategy-analyzer.js";
import { MarketingStrategyLinker } from "./marketing-strategy-linker.js";
import { MarketingStrategyLogger } from "./marketing-strategy-logger.js";
import { MarketingStrategyProcessor } from "./marketing-strategy-processor.js";
import { MarketingStrategyScorer } from "./marketing-strategy-scorer.js";
import { MarketingStrategyRecordStore } from "./marketing-strategy-stores.js";
import { MarketingObjective, MarketingStrategyEngineError, } from "./types.js";
/**
 * Marketing Strategy Intelligence Engine — analyzes products, audiences, and business goals
 * to prepare marketing strategy before creative assets are generated.
 */
export class AiMarketingStrategyIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new MarketingStrategyLogger();
    records = new MarketingStrategyRecordStore();
    analyzer = new MarketingStrategyAnalyzer();
    scorer = new MarketingStrategyScorer();
    linker = new MarketingStrategyLinker();
    processor = null;
    strategyTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "marketing-strategy", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new MarketingStrategyProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Marketing Strategy Intelligence Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "marketing-strategy-intelligence",
            moduleName: "Marketing Strategy Intelligence Engine",
            category: ProductIntelligenceCategory.MarketingStrategy,
            version: "0.1.0",
            status: ProductIntelligenceModuleStatus.Active,
            dependencies: [
                "product-engine",
                "product-analysis-engine",
                "product-understanding-engine",
                "audience-intelligence",
                "knowledge-engine",
            ],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "marketing-strategy"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Write,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Marketing Strategy Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async prepareMarketingStrategy(input) {
        this.ensureReady();
        const result = await this.processor.strategize(input);
        if (result.success)
            this.strategyTimes.push(result.durationMs);
        return result;
    }
    getStrategy(strategyId) {
        this.ensureReady();
        return this.records.get(strategyId) ?? null;
    }
    getStrategiesByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchStrategies(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        const durationMs = Date.now() - start;
        this.searchTimes.push(durationMs);
        this.logger.log("info", "search", "Strategy search executed", {
            query,
            resultCount: results.length,
            durationMs,
        });
        return results;
    }
    detectRelationships(strategyId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(strategyId);
        if (!record)
            return null;
        const understanding = this.foundation.getProductUnderstandingEngine().getUnderstanding(record.productId);
        const analysis = this.foundation.getProductAnalysisEngine().getProduct(record.productId);
        const audience = this.foundation.getTargetAudienceIntelligenceEngine().getAudience(record.audienceId);
        if (!understanding || !analysis)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), understanding, analysis, audience ?? undefined, record.relationships.campaigns[0]);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairStrategy(productId, objective) {
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
        const audienceEngine = this.foundation.getTargetAudienceIntelligenceEngine();
        let audience = audienceEngine.getAudiencesByProduct(productId)[0];
        if (!audience?.validated) {
            const repairedAudience = await audienceEngine.repairAudience(productId);
            if (!repairedAudience?.success || !repairedAudience.record)
                return null;
            audience = repairedAudience.record;
        }
        const targetObjective = objective ?? MarketingObjective.ProductPromotion;
        this.logger.log("info", "validation", "Repairing marketing strategy", { productId, objective: targetObjective });
        return this.prepareMarketingStrategy({
            productId,
            marketingObjective: targetObjective,
            brandName: understanding.identity.brand,
            audienceId: audience.audienceId,
            preferredPlatforms: undefined,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.strategyQualityScore, 0) / all.length)
            : 0;
        const avgAudience = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.audienceAlignmentScore, 0) / all.length)
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
        if (!this.foundation?.getTargetAudienceIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            strategyAnalysisStatus: "objective analysis, strategy selection, and creative direction preparation active",
            audienceAlignmentStatus: "audience needs, interests, motivation, and platform alignment tracked",
            businessAlignmentStatus: "sales, marketing, brand, customer, growth, and communication goals analyzed",
            strategiesPrepared: all.length,
            averageStrategyQualityScore: avgQuality,
            averageAudienceAlignmentScore: avgAudience,
            performance: {
                averageStrategyMs: avg(this.strategyTimes),
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
            throw new MarketingStrategyEngineError("Marketing Strategy Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=marketing-strategy-intelligence-engine.js.map