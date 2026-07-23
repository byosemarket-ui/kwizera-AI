import path from "node:path";
import { AudioGenerationAccessPermission, AudioGenerationCategory, AudioGenerationModuleStatus, } from "../audio-generation-foundation/types.js";
import { SpeechToSpeechGenerationAnalyzer } from "./speech-to-speech-generation-analyzer.js";
import { SpeechToSpeechGenerationLinker } from "./speech-to-speech-generation-linker.js";
import { SpeechToSpeechGenerationLogger } from "./speech-to-speech-generation-logger.js";
import { SpeechToSpeechGenerationProcessor } from "./speech-to-speech-generation-processor.js";
import { SpeechToSpeechGenerationScorer } from "./speech-to-speech-generation-scorer.js";
import { SpeechToSpeechGenerationRecordStore } from "./speech-to-speech-generation-stores.js";
import { SpeechToSpeechGenerationEngineError, } from "./types.js";
/**
 * AI Speech-to-Speech Generation Engine — transforms spoken audio into
 * production-ready speech transformation blueprints.
 */
export class AiSpeechToSpeechGenerationEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new SpeechToSpeechGenerationLogger();
    records = new SpeechToSpeechGenerationRecordStore();
    analyzer = new SpeechToSpeechGenerationAnalyzer();
    scorer = new SpeechToSpeechGenerationScorer();
    linker = new SpeechToSpeechGenerationLinker();
    processor = null;
    generationTimes = [];
    searchTimes = [];
    blueprintTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "speech-to-speech", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new SpeechToSpeechGenerationProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Speech-to-Speech Generation Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerAudioGenerationModule({
            moduleId: "speech-to-speech-generation-engine",
            moduleName: "Speech-to-Speech Generation Engine",
            category: AudioGenerationCategory.SpeechToSpeech,
            version: "0.1.0",
            status: AudioGenerationModuleStatus.Active,
            dependencies: ["audio-generation-engine", "text-to-speech-generation-engine"],
            qualityScore: 92,
            confidenceScore: 90,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "speech-to-speech"),
            accessPermissions: [
                AudioGenerationAccessPermission.Read,
                AudioGenerationAccessPermission.Write,
                AudioGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Speech-to-Speech Generation Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateTransformationPlan(input) {
        this.ensureReady();
        const result = await this.processor.generateTransformationPlan(input);
        if (result.success) {
            this.generationTimes.push(result.durationMs);
            this.blueprintTimes.push(result.durationMs);
        }
        return result;
    }
    getTransformationPlan(transformationId) {
        this.ensureReady();
        return this.records.get(transformationId) ?? null;
    }
    getTransformationsBySourceAudio(sourceAudioId) {
        this.ensureReady();
        return this.records.getBySourceAudio(sourceAudioId);
    }
    getTransformationsByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    getTransformationsByLanguage(language) {
        this.ensureReady();
        return this.records.getByLanguage(language);
    }
    searchTransformationPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Transformation plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairTransformationPlan(productId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing speech transformation plan", { productId, platform });
        return this.generateTransformationPlan({
            productId,
            platform,
            generatePlatformOptimizations: true,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgTransformation = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.transformationQualityScore, 0) / all.length)
            : 0;
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
        const module = this.foundation?.getRegistry().getModule("speech-to-speech-generation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            speechAnalysisStatus: "language, segments, accent, pitch, rhythm, emotion analysis active",
            voiceTransformationStatus: "voice mapping, accent, pitch, rate, tone adaptation active",
            emotionPreservationStatus: "10 emotion types with preservation scoring",
            timingPreservationStatus: "segment timing, pauses, rhythm, breath planning active",
            platformOptimizationStatus: "7 platform speech transformation profiles prepared",
            transformationsGenerated: all.length,
            averageTransformationQualityScore: avgTransformation,
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
            throw new SpeechToSpeechGenerationEngineError("Speech-to-Speech Generation Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=speech-to-speech-generation-engine.js.map