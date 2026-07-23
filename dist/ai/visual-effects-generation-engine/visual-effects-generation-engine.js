import path from "node:path";
import { VideoGenerationAccessPermission, VideoGenerationCategory, VideoGenerationModuleStatus, } from "../video-generation-foundation/types.js";
import { VisualEffectsGenerationAnalyzer } from "./visual-effects-generation-analyzer.js";
import { VisualEffectsGenerationLinker } from "./visual-effects-generation-linker.js";
import { VisualEffectsGenerationLogger } from "./visual-effects-generation-logger.js";
import { VisualEffectsGenerationProcessor } from "./visual-effects-generation-processor.js";
import { VisualEffectsGenerationScorer } from "./visual-effects-generation-scorer.js";
import { VisualEffectsGenerationRecordStore } from "./visual-effects-generation-stores.js";
import { VisualEffectsGenerationEngineError, } from "./types.js";
/**
 * AI Visual Effects Generation Engine — production-ready visual effects blueprints
 * for lighting, atmospheric, product, environment, transition, and color effects.
 */
export class AiVisualEffectsGenerationEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new VisualEffectsGenerationLogger();
    records = new VisualEffectsGenerationRecordStore();
    analyzer = new VisualEffectsGenerationAnalyzer();
    scorer = new VisualEffectsGenerationScorer();
    linker = new VisualEffectsGenerationLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    syncTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "effects", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new VisualEffectsGenerationProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Visual Effects Generation Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoGenerationModule({
            moduleId: "visual-effects-planning-generation-engine",
            moduleName: "Visual Effects Generation Engine",
            category: VideoGenerationCategory.VisualEffectsPlanning,
            version: "0.1.0",
            status: VideoGenerationModuleStatus.Active,
            dependencies: ["video-generation-engine", "animation-planning-generation-engine"],
            qualityScore: 95,
            confidenceScore: 93,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "effects"),
            accessPermissions: [
                VideoGenerationAccessPermission.Read,
                VideoGenerationAccessPermission.Write,
                VideoGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Visual Effects Generation Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateVisualEffectPlans(input) {
        this.ensureReady();
        const result = await this.processor.generateVisualEffectPlans(input);
        if (result.success) {
            this.planningTimes.push(result.durationMs);
            this.syncTimes.push(result.durationMs);
        }
        return result;
    }
    getVisualEffectPlan(visualEffectPlanId) {
        this.ensureReady();
        return this.records.get(visualEffectPlanId) ?? null;
    }
    getVisualEffectPlansByScene(sceneId) {
        this.ensureReady();
        return this.records.getByScene(sceneId);
    }
    getVisualEffectPlansByStoryboard(storyboardId) {
        this.ensureReady();
        return this.records.getByStoryboard(storyboardId);
    }
    searchVisualEffectPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Visual effect plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairVisualEffectPlans(storyboardId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing visual effect plans", { storyboardId, platform });
        return this.generateVisualEffectPlans({ storyboardId, platform });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.visualEffectsScore, 0) / all.length)
            : 0;
        const avgProductionReadiness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getAnimationGenerationEngine().isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("visual-effects-planning-generation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            planningStatus: "lighting, atmospheric, product, environment, transition, text/graphic, color effects active",
            synchronizationStatus: "motion, camera, audio, animation, transition synchronization active",
            cinematicStatus: "cinematic LUT, HDR, depth of field, film grain planning active",
            visualEffectPlansGenerated: all.length,
            averageVisualEffectsScore: avgQuality,
            averageProductionReadinessScore: avgProductionReadiness,
            performance: {
                averagePlanningMs: avg(this.planningTimes),
                averageSearchMs: avg(this.searchTimes),
                averageSyncMs: avg(this.syncTimes),
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
            throw new VisualEffectsGenerationEngineError("Visual Effects Generation Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=visual-effects-generation-engine.js.map