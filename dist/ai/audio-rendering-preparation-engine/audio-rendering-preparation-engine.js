import path from "node:path";
import { AudioGenerationAccessPermission, AudioGenerationCategory, AudioGenerationModuleStatus, } from "../audio-generation-foundation/types.js";
import { AudioRenderAnalyzer } from "./audio-render-analyzer.js";
import { AudioRenderLinker } from "./audio-render-linker.js";
import { AudioRenderLogger } from "./audio-render-logger.js";
import { AudioRenderProcessor } from "./audio-render-processor.js";
import { AudioRenderScorer } from "./audio-render-scorer.js";
import { AudioRenderRecordStore } from "./audio-render-stores.js";
import { AudioRenderEngineError, } from "./types.js";
/**
 * AI Audio Rendering Preparation Engine — validates and prepares assets, tracks,
 * timelines and production instructions before audio rendering begins.
 */
export class AiAudioRenderingPreparationEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new AudioRenderLogger();
    records = new AudioRenderRecordStore();
    analyzer = new AudioRenderAnalyzer();
    scorer = new AudioRenderScorer();
    linker = new AudioRenderLinker();
    processor = null;
    generationTimes = [];
    searchTimes = [];
    planningTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "rendering", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new AudioRenderProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Audio Rendering Preparation Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerAudioGenerationModule({
            moduleId: "audio-rendering-preparation-engine",
            moduleName: "AI Audio Rendering Preparation Engine",
            category: AudioGenerationCategory.RenderingPlanning,
            version: "0.1.0",
            status: AudioGenerationModuleStatus.Active,
            dependencies: [
                "audio-generation-engine",
                "audio-production-engine",
                "audio-mixing-generation-engine",
            ],
            qualityScore: 95,
            confidenceScore: 93,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "rendering"),
            accessPermissions: [
                AudioGenerationAccessPermission.Read,
                AudioGenerationAccessPermission.Write,
                AudioGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Audio Rendering Preparation Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateRenderPlan(input) {
        this.ensureReady();
        const result = await this.processor.generateRenderPlan(input);
        if (result.success) {
            this.generationTimes.push(result.durationMs);
            this.planningTimes.push(result.durationMs);
        }
        return result;
    }
    getRenderPlan(audioRenderPlanId) {
        this.ensureReady();
        return this.records.get(audioRenderPlanId) ?? null;
    }
    getRenderPlansByProduction(productionId) {
        this.ensureReady();
        return this.records.getByProduction(productionId);
    }
    getRenderPlansByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchRenderPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Render plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairRenderPlan(productId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing audio render plan", { productId, platform });
        const existingPlans = this.records.getByProduct(productId);
        const existing = existingPlans[0] ?? null;
        const productionPlan = this.foundation.getAudioProductionEngine().getProductionPlansByProduct(productId)[0] ?? null;
        return this.generateRenderPlan({
            productId,
            productionId: existing?.profile.productionId ?? productionPlan?.audioProductionId,
            audioId: existing?.profile.audioId ?? productionPlan?.profile.audioPlanId,
            audioPlanId: productionPlan?.profile.audioPlanId,
            platform: platform ?? existing?.profile.platform,
            validateTracks: true,
            validateTimeline: true,
            validateAssets: true,
            planResources: true,
            prepareOutputProfiles: true,
            generateRenderJobs: true,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgRender = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.renderReadinessScore, 0) / all.length) : 0;
        const avgTrack = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.trackIntegrityScore, 0) / all.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("audio-rendering-preparation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            renderValidationStatus: "11 render validation stages — TTS through production plans",
            trackValidationStatus: "7 track checks — hierarchy, order, groups, bus, send, automation, mute/solo",
            timelineValidationStatus: "7 timeline checks — alignment, cues, position, fades, crossfade, loop",
            resourcePlanningStatus: "CPU, GPU, RAM, storage, cache, queue, parallel preparation",
            renderPlansGenerated: all.length,
            averageRenderReadinessScore: avgRender,
            averageTrackIntegrityScore: avgTrack,
            performance: {
                averageGenerationMs: avg(this.generationTimes),
                averageSearchMs: avg(this.searchTimes),
                averagePlanningMs: avg(this.planningTimes),
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
            throw new AudioRenderEngineError("Audio Rendering Preparation Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=audio-rendering-preparation-engine.js.map