import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";
import { CreativeDirectionAnalyzer } from "./creative-direction-analyzer.js";
import { CreativeDirectionLinker } from "./creative-direction-linker.js";
import { CreativeDirectionLogger } from "./creative-direction-logger.js";
import { CreativeDirectionProcessor } from "./creative-direction-processor.js";
import { CreativeDirectionScorer } from "./creative-direction-scorer.js";
import { CreativeDirectionRecordStore } from "./creative-direction-stores.js";
import { CreativeDirectionEngineError, } from "./types.js";
/**
 * Creative Direction Engine — transforms product understanding and marketing strategy
 * into a complete creative vision before content is generated.
 */
export class AiCreativeDirectionEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new CreativeDirectionLogger();
    records = new CreativeDirectionRecordStore();
    analyzer = new CreativeDirectionAnalyzer();
    scorer = new CreativeDirectionScorer();
    linker = new CreativeDirectionLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "creative-direction", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new CreativeDirectionProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Creative Direction Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "creative-direction",
            moduleName: "Creative Direction Engine",
            category: ProductIntelligenceCategory.CreativeDirection,
            version: "0.1.0",
            status: ProductIntelligenceModuleStatus.Active,
            dependencies: [
                "product-engine",
                "product-analysis-engine",
                "product-understanding-engine",
                "audience-intelligence",
                "marketing-strategy-intelligence",
                "knowledge-engine",
            ],
            qualityScore: 91,
            confidenceScore: 89,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "creative-direction"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Write,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Creative Direction Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async planCreativeDirection(input) {
        this.ensureReady();
        const result = await this.processor.plan(input);
        if (result.success)
            this.planningTimes.push(result.durationMs);
        return result;
    }
    getCreativeDirection(creativeId) {
        this.ensureReady();
        return this.records.get(creativeId) ?? null;
    }
    getCreativeDirectionsByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchCreativeDirections(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        const durationMs = Date.now() - start;
        this.searchTimes.push(durationMs);
        this.logger.log("info", "search", "Creative direction search executed", {
            query,
            resultCount: results.length,
            durationMs,
        });
        return results;
    }
    detectRelationships(creativeId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(creativeId);
        if (!record)
            return null;
        const understanding = this.foundation.getProductUnderstandingEngine().getUnderstanding(record.productId);
        const analysis = this.foundation.getProductAnalysisEngine().getProduct(record.productId);
        const audience = this.foundation.getTargetAudienceIntelligenceEngine().getAudience(record.audienceId);
        const strategy = this.foundation.getMarketingStrategyIntelligenceEngine().getStrategy(record.strategyId);
        if (!understanding || !analysis || !audience || !strategy)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), understanding, analysis, strategy, audience);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairCreativeDirection(productId, platform) {
        this.ensureReady();
        const strategyEngine = this.foundation.getMarketingStrategyIntelligenceEngine();
        const audienceEngine = this.foundation.getTargetAudienceIntelligenceEngine();
        let audience = audienceEngine.getAudiencesByProduct(productId)[0];
        if (!audience?.validated) {
            const repairedAudience = await audienceEngine.repairAudience(productId);
            if (!repairedAudience?.success || !repairedAudience.record)
                return null;
            audience = repairedAudience.record;
        }
        let strategy = strategyEngine.getStrategiesByProduct(productId)[0];
        if (!strategy?.validated) {
            const repairedStrategy = await strategyEngine.repairStrategy(productId, MarketingObjective.ProductPromotion);
            if (!repairedStrategy?.success || !repairedStrategy.record)
                return null;
            strategy = repairedStrategy.record;
        }
        this.logger.log("info", "validation", "Repairing creative direction", { productId });
        return this.planCreativeDirection({
            productId,
            platform,
            strategyId: strategy.strategyId,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.creativeQualityScore, 0) / all.length)
            : 0;
        const avgBrand = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.brandConsistencyScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getMarketingStrategyIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getTargetAudienceIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            creativePlanningStatus: "visual, cinematic, brand, marketing, and platform direction preparation active",
            brandAlignmentStatus: "brand colors, typography, voice, and consistency tracked",
            marketingAlignmentStatus: "hook, storytelling, CTA, and emotional flow aligned with strategy",
            directionsPrepared: all.length,
            averageCreativeQualityScore: avgQuality,
            averageBrandConsistencyScore: avgBrand,
            performance: {
                averagePlanningMs: avg(this.planningTimes),
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
            throw new CreativeDirectionEngineError("Creative Direction Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=creative-direction-engine.js.map