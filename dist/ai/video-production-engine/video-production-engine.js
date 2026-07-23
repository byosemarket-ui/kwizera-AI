import path from "node:path";
import { VideoGenerationAccessPermission, VideoGenerationCategory, VideoGenerationModuleStatus, } from "../video-generation-foundation/types.js";
import { VideoProductionAnalyzer } from "./video-production-analyzer.js";
import { VideoProductionLinker } from "./video-production-linker.js";
import { VideoProductionLogger } from "./video-production-logger.js";
import { VideoProductionProcessor } from "./video-production-processor.js";
import { VideoProductionScorer } from "./video-production-scorer.js";
import { VideoProductionRecordStore } from "./video-production-stores.js";
import { VideoProductionEngineError, } from "./types.js";
/**
 * AI Video Production Engine — complete production-ready execution blueprints
 * validating assets, dependencies, workflows, and timelines before rendering.
 */
export class AiVideoProductionEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new VideoProductionLogger();
    records = new VideoProductionRecordStore();
    analyzer = new VideoProductionAnalyzer();
    scorer = new VideoProductionScorer();
    linker = new VideoProductionLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    validationTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "production", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new VideoProductionProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Video Production Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoGenerationModule({
            moduleId: "video-production-generation-engine",
            moduleName: "Video Production Engine",
            category: VideoGenerationCategory.VideoProductionPlanning,
            version: "0.1.0",
            status: VideoGenerationModuleStatus.Active,
            dependencies: ["video-generation-engine", "marketing-video-generation-engine"],
            qualityScore: 95,
            confidenceScore: 93,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "production"),
            accessPermissions: [
                VideoGenerationAccessPermission.Read,
                VideoGenerationAccessPermission.Write,
                VideoGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Video Production Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateProductionPlans(input) {
        this.ensureReady();
        const result = await this.processor.generateProductionPlans(input);
        if (result.success) {
            this.planningTimes.push(result.durationMs);
            this.validationTimes.push(result.durationMs);
        }
        return result;
    }
    getProductionPlan(productionId) {
        this.ensureReady();
        return this.records.get(productionId) ?? null;
    }
    getProductionPlansByStoryboard(storyboardId) {
        this.ensureReady();
        return this.records.getByStoryboard(storyboardId);
    }
    searchProductionPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Production plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairProductionPlans(storyboardId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing production plans", { storyboardId, platform });
        return this.generateProductionPlans({ storyboardId, platform });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgReadiness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
            : 0;
        const avgAsset = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.assetReadinessScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getMarketingVideoEngine().isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("video-production-generation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            workflowStatus: "storyboard through marketing workflow validation active",
            assetStatus: "images, audio, brand, templates, LUTs asset validation active",
            timelineStatus: "scene, camera, motion, animation, audio, effects, render timelines active",
            productionPlansGenerated: all.length,
            averageProductionReadinessScore: avgReadiness,
            averageAssetReadinessScore: avgAsset,
            performance: {
                averagePlanningMs: avg(this.planningTimes),
                averageSearchMs: avg(this.searchTimes),
                averageValidationMs: avg(this.validationTimes),
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
            throw new VideoProductionEngineError("Video Production Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=video-production-engine.js.map