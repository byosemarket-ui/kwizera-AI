import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { StoryboardAnalyzer } from "./storyboard-analyzer.js";
import { StoryboardLinker } from "./storyboard-linker.js";
import { StoryboardLogger } from "./storyboard-logger.js";
import { StoryboardProcessor } from "./storyboard-processor.js";
import { StoryboardScorer } from "./storyboard-scorer.js";
import { StoryboardRecordStore } from "./storyboard-stores.js";
import { StoryboardIntelligenceEngineError, } from "./types.js";
/**
 * Storyboard Intelligence Engine — transforms approved creative direction into
 * production-ready storyboard intelligence before any media is generated.
 */
export class AiStoryboardIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new StoryboardLogger();
    records = new StoryboardRecordStore();
    analyzer = new StoryboardAnalyzer();
    scorer = new StoryboardScorer();
    linker = new StoryboardLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "storyboard", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new StoryboardProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Storyboard Intelligence Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "storyboard-intelligence",
            moduleName: "Storyboard Intelligence Engine",
            category: ProductIntelligenceCategory.StoryboardIntelligence,
            version: "0.1.0",
            status: ProductIntelligenceModuleStatus.Active,
            dependencies: [
                "product-engine",
                "product-analysis-engine",
                "product-understanding-engine",
                "audience-intelligence",
                "marketing-strategy-intelligence",
                "creative-direction",
                "knowledge-engine",
            ],
            qualityScore: 91,
            confidenceScore: 89,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "storyboard"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Write,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Storyboard Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async createStoryboard(input) {
        this.ensureReady();
        const result = await this.processor.createStoryboard(input);
        if (result.success)
            this.planningTimes.push(result.durationMs);
        return result;
    }
    getStoryboard(storyboardId) {
        this.ensureReady();
        return this.records.get(storyboardId) ?? null;
    }
    getStoryboardsByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchStoryboards(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Storyboard search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    detectRelationships(storyboardId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(storyboardId);
        if (!record)
            return null;
        const creative = this.foundation.getCreativeDirectionEngine().getCreativeDirection(record.creativeId);
        const strategy = this.foundation.getMarketingStrategyIntelligenceEngine().getStrategy(record.strategyId);
        const understanding = this.foundation.getProductUnderstandingEngine().getUnderstanding(record.productId);
        if (!creative || !strategy || !understanding)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), creative, strategy, understanding);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairStoryboard(productId, platform) {
        this.ensureReady();
        const creativeEngine = this.foundation.getCreativeDirectionEngine();
        let creative = creativeEngine.getCreativeDirectionsByProduct(productId)[0];
        if (!creative?.validated) {
            const repaired = await creativeEngine.repairCreativeDirection(productId, platform);
            if (!repaired?.success || !repaired.record)
                return null;
            creative = repaired.record;
        }
        this.logger.log("info", "validation", "Repairing storyboard", { productId });
        return this.createStoryboard({
            productId,
            creativeId: creative.creativeId,
            includeSocialProof: false,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.storyboardQualityScore, 0) / all.length)
            : 0;
        const avgStorytelling = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.storytellingScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getCreativeDirectionEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            storyboardPlanningStatus: "scene sequences, story flow, and timing intelligence active",
            scenePlanningStatus: "full scene plans with camera, visual, and CTA placement",
            continuityStatus: `${all.length} storyboards indexed with continuity validation`,
            storyboardsPrepared: all.length,
            averageStoryboardQualityScore: avgQuality,
            averageStorytellingScore: avgStorytelling,
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
            throw new StoryboardIntelligenceEngineError("Storyboard Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=storyboard-intelligence-engine.js.map