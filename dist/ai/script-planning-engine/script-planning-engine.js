import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { ScriptPlanningAnalyzer } from "./script-planning-analyzer.js";
import { ScriptPlanningLinker } from "./script-planning-linker.js";
import { ScriptPlanningLogger } from "./script-planning-logger.js";
import { ScriptPlanningProcessor } from "./script-planning-processor.js";
import { ScriptPlanningScorer } from "./script-planning-scorer.js";
import { ScriptPlanningRecordStore } from "./script-planning-stores.js";
import { ScriptPlanningEngineError, } from "./types.js";
/**
 * Script Planning Engine — transforms approved storyboard into production-ready
 * script planning (structure, timing, communication flow) before script generation.
 */
export class AiScriptPlanningEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ScriptPlanningLogger();
    records = new ScriptPlanningRecordStore();
    analyzer = new ScriptPlanningAnalyzer();
    scorer = new ScriptPlanningScorer();
    linker = new ScriptPlanningLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "script", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ScriptPlanningProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Script Planning Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "script-planning",
            moduleName: "Script Planning Engine",
            category: ProductIntelligenceCategory.ScriptPlanning,
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
                "knowledge-engine",
            ],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "script"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Write,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Script Planning Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async createScriptPlan(input) {
        this.ensureReady();
        const result = await this.processor.createScriptPlan(input);
        if (result.success)
            this.planningTimes.push(result.durationMs);
        return result;
    }
    getScriptPlan(scriptPlanId) {
        this.ensureReady();
        return this.records.get(scriptPlanId) ?? null;
    }
    getScriptPlansByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchScriptPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Script plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    detectRelationships(scriptPlanId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(scriptPlanId);
        if (!record)
            return null;
        const storyboard = this.foundation.getStoryboardIntelligenceEngine().getStoryboard(record.storyboardId);
        const creative = this.foundation.getCreativeDirectionEngine().getCreativeDirection(record.creativeId);
        const strategy = this.foundation.getMarketingStrategyIntelligenceEngine().getStrategy(record.strategyId);
        const understanding = this.foundation.getProductUnderstandingEngine().getUnderstanding(record.productId);
        if (!storyboard || !creative || !strategy || !understanding)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), storyboard, creative, strategy, understanding);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairScriptPlan(productId, platform) {
        this.ensureReady();
        const storyboardEngine = this.foundation.getStoryboardIntelligenceEngine();
        let storyboard = storyboardEngine.getStoryboardsByProduct(productId)[0];
        if (!storyboard?.productionReady) {
            const repaired = await storyboardEngine.repairStoryboard(productId, platform);
            if (!repaired?.success || !repaired.record)
                return null;
            storyboard = repaired.record;
        }
        this.logger.log("info", "validation", "Repairing script plan", { productId });
        return this.createScriptPlan({
            productId,
            storyboardId: storyboard.storyboardId,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgPlanning = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.scriptPlanningScore, 0) / all.length)
            : 0;
        const avgStorytelling = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.storytellingScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getStoryboardIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            scriptPlanningStatus: "script structure, narration flow, and timing planning active",
            narrationPlanningStatus: "voice preparation and narration pacing rules ready",
            subtitlePlanningStatus: "subtitle timing, sync rules, and line validation active",
            scriptPlansPrepared: all.length,
            averageScriptPlanningScore: avgPlanning,
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
            throw new ScriptPlanningEngineError("Script Planning Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=script-planning-engine.js.map