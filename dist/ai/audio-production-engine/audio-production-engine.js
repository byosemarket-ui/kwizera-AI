import path from "node:path";
import { AudioGenerationAccessPermission, AudioGenerationCategory, AudioGenerationModuleStatus, } from "../audio-generation-foundation/types.js";
import { AudioProductionAnalyzer } from "./audio-production-analyzer.js";
import { AudioProductionLinker } from "./audio-production-linker.js";
import { AudioProductionLogger } from "./audio-production-logger.js";
import { AudioProductionProcessor } from "./audio-production-processor.js";
import { AudioProductionScorer } from "./audio-production-scorer.js";
import { AudioProductionRecordStore } from "./audio-production-stores.js";
import { AudioProductionEngineError, } from "./types.js";
/**
 * AI Audio Production Engine — transforms approved audio generation plans
 * into complete production-ready execution blueprints.
 */
export class AiAudioProductionEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new AudioProductionLogger();
    records = new AudioProductionRecordStore();
    analyzer = new AudioProductionAnalyzer();
    scorer = new AudioProductionScorer();
    linker = new AudioProductionLinker();
    processor = null;
    generationTimes = [];
    searchTimes = [];
    planningTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "production", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new AudioProductionProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Audio Production Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerAudioGenerationModule({
            moduleId: "audio-production-engine",
            moduleName: "AI Audio Production Engine",
            category: AudioGenerationCategory.AudioProduction,
            version: "0.1.0",
            status: AudioGenerationModuleStatus.Active,
            dependencies: ["audio-generation-engine", "audio-mixing-generation-engine", "audio-mastering-generation-engine"],
            qualityScore: 94,
            confidenceScore: 92,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "production"),
            accessPermissions: [
                AudioGenerationAccessPermission.Read,
                AudioGenerationAccessPermission.Write,
                AudioGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Audio Production Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateProductionPlan(input) {
        this.ensureReady();
        const result = await this.processor.generateProductionPlan(input);
        if (result.success) {
            this.generationTimes.push(result.durationMs);
            this.planningTimes.push(result.durationMs);
        }
        return result;
    }
    getProductionPlan(audioProductionId) {
        this.ensureReady();
        return this.records.get(audioProductionId) ?? null;
    }
    getProductionPlansByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    getProductionPlansByAudioPlan(audioPlanId) {
        this.ensureReady();
        return this.records.getByAudioPlan(audioPlanId);
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
    async repairProductionPlan(productId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing production plan", { productId, platform });
        const existing = this.records.getByProduct(productId)[0];
        return this.generateProductionPlan({
            productId,
            platform,
            mixingPlanId: existing?.profile.audioPlanId,
            productionPrompt: existing ? `production repair for ${existing.profile.platform}` : undefined,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgReadiness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
            : 0;
        const avgWorkflow = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.workflowScore, 0) / all.length) : 0;
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
            workflowValidationStatus: "11 workflow stages including TTS through mastering",
            assetValidationStatus: "10 asset types validated",
            trackValidationStatus: "track, bus, timeline structure validation active",
            dependencyValidationStatus: "16 dependency checks active",
            renderPreparationStatus: "sample rate, bit depth, channels, loudness prepared",
            exportPreparationStatus: "6 export formats with extensible architecture",
            productionPlansGenerated: all.length,
            averageProductionReadinessScore: avgReadiness,
            averageWorkflowScore: avgWorkflow,
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
            throw new AudioProductionEngineError("Audio Production Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=audio-production-engine.js.map