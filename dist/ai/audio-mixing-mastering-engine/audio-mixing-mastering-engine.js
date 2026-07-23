import path from "node:path";
import { AudioGenerationAccessPermission, AudioGenerationCategory, AudioGenerationModuleStatus, } from "../audio-generation-foundation/types.js";
import { AudioMixingMasteringAnalyzer } from "./audio-mixing-mastering-analyzer.js";
import { AudioMixingMasteringLinker } from "./audio-mixing-mastering-linker.js";
import { AudioMixingMasteringLogger } from "./audio-mixing-mastering-logger.js";
import { AudioMixingMasteringProcessor } from "./audio-mixing-mastering-processor.js";
import { AudioMixingMasteringScorer } from "./audio-mixing-mastering-scorer.js";
import { AudioMixingMasteringRecordStore } from "./audio-mixing-mastering-stores.js";
import { AudioMixingMasteringEngineError, } from "./types.js";
/**
 * AI Audio Mixing & Mastering Engine — prepares production-ready mixing
 * and mastering blueprints preserving clarity, balance, and loudness.
 */
export class AiAudioMixingMasteringEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new AudioMixingMasteringLogger();
    records = new AudioMixingMasteringRecordStore();
    analyzer = new AudioMixingMasteringAnalyzer();
    scorer = new AudioMixingMasteringScorer();
    linker = new AudioMixingMasteringLinker();
    processor = null;
    generationTimes = [];
    searchTimes = [];
    blueprintTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "mixing", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new AudioMixingMasteringProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Audio Mixing & Mastering Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerAudioGenerationModule({
            moduleId: "audio-mixing-generation-engine",
            moduleName: "Audio Mixing & Mastering Engine",
            category: AudioGenerationCategory.AudioMixing,
            version: "0.1.0",
            status: AudioGenerationModuleStatus.Active,
            dependencies: ["audio-generation-engine", "audio-enhancement-generation-engine"],
            qualityScore: 94,
            confidenceScore: 92,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "mixing"),
            accessPermissions: [
                AudioGenerationAccessPermission.Read,
                AudioGenerationAccessPermission.Write,
                AudioGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Audio Mixing & Mastering Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateMixMasterPlan(input) {
        this.ensureReady();
        const result = await this.processor.generateMixMasterPlan(input);
        if (result.success) {
            this.generationTimes.push(result.durationMs);
            this.blueprintTimes.push(result.durationMs);
        }
        return result;
    }
    getMixMasterPlan(mixingPlanId) {
        this.ensureReady();
        return this.records.get(mixingPlanId) ?? null;
    }
    getMixMasterPlansByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    getMixMasterPlansBySession(sessionId) {
        this.ensureReady();
        return this.records.getBySession(sessionId);
    }
    searchMixMasterPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Mix/master plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairMixMasterPlan(productId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing mix/master plan", { productId, platform });
        const existing = this.records.getByProduct(productId)[0];
        return this.generateMixMasterPlan({
            productId,
            platform,
            mixPrompt: existing ? `mix master repair for ${existing.profile.platform}` : undefined,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgMixing = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.mixingQualityScore, 0) / all.length) : 0;
        const avgProductionReadiness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("audio-mixing-generation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            multiTrackAnalysisStatus: "track count, frequency, loudness, phase, timing analysis active",
            mixingPlanningStatus: "track balance, pan, EQ, compression, reverb, delay, bus routing active",
            masteringPlanningStatus: "8 mastering techniques supported",
            loudnessPlanningStatus: "broadcast, streaming, podcast, cinema, TV, radio loudness standards",
            frequencyManagementStatus: "low/mid/high, harmonic balance, masking, tonal balance active",
            spatialAudioStatus: "stereo, mono, surround, binaural, Atmos preparation active",
            mixMasterPlansGenerated: all.length,
            averageMixingQualityScore: avgMixing,
            averageProductionReadinessScore: avgProductionReadiness,
            performance: {
                averageGenerationMs: avg(this.generationTimes),
                averageSearchMs: avg(this.searchTimes),
                averageBlueprintMs: avg(this.blueprintTimes),
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
            throw new AudioMixingMasteringEngineError("Audio Mixing & Mastering Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=audio-mixing-mastering-engine.js.map