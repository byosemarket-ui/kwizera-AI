import path from "node:path";
import { AudioGenerationAccessPermission, AudioGenerationCategory, AudioGenerationModuleStatus, } from "../audio-generation-foundation/types.js";
import { VoiceCloningGenerationAnalyzer } from "./voice-cloning-generation-analyzer.js";
import { VoiceCloningGenerationLinker } from "./voice-cloning-generation-linker.js";
import { VoiceCloningGenerationLogger } from "./voice-cloning-generation-logger.js";
import { VoiceCloningGenerationProcessor } from "./voice-cloning-generation-processor.js";
import { VoiceCloningGenerationScorer } from "./voice-cloning-generation-scorer.js";
import { VoiceCloningGenerationRecordStore } from "./voice-cloning-generation-stores.js";
import { VoiceCloningGenerationEngineError, } from "./types.js";
/**
 * AI Voice Cloning Generation Engine — prepares secure, production-ready
 * voice cloning blueprints while preserving identity, quality, and compliance.
 */
export class AiVoiceCloningGenerationEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new VoiceCloningGenerationLogger();
    records = new VoiceCloningGenerationRecordStore();
    analyzer = new VoiceCloningGenerationAnalyzer();
    scorer = new VoiceCloningGenerationScorer();
    linker = new VoiceCloningGenerationLinker();
    processor = null;
    generationTimes = [];
    searchTimes = [];
    blueprintTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "voice-cloning", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new VoiceCloningGenerationProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Voice Cloning Generation Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerAudioGenerationModule({
            moduleId: "voice-cloning-generation-engine",
            moduleName: "Voice Cloning Generation Engine",
            category: AudioGenerationCategory.VoiceCloning,
            version: "0.1.0",
            status: AudioGenerationModuleStatus.Active,
            dependencies: ["audio-generation-engine", "speech-to-speech-generation-engine"],
            qualityScore: 93,
            confidenceScore: 91,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "voice-cloning"),
            accessPermissions: [
                AudioGenerationAccessPermission.Read,
                AudioGenerationAccessPermission.Write,
                AudioGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Voice Cloning Generation Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateCloningPlan(input) {
        this.ensureReady();
        const result = await this.processor.generateCloningPlan(input);
        if (result.success) {
            this.generationTimes.push(result.durationMs);
            this.blueprintTimes.push(result.durationMs);
        }
        return result;
    }
    getCloningPlan(cloningPlanId) {
        this.ensureReady();
        return this.records.get(cloningPlanId) ?? null;
    }
    getCloningPlansByVoiceSample(voiceSampleId) {
        this.ensureReady();
        return this.records.getByVoiceSample(voiceSampleId);
    }
    getCloningPlansBySpeaker(speakerId) {
        this.ensureReady();
        return this.records.getBySpeaker(speakerId);
    }
    getCloningPlansByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    getCloningPlansByLanguage(language) {
        this.ensureReady();
        return this.records.getByLanguage(language);
    }
    searchCloningPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Cloning plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairCloningPlan(productId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing voice cloning plan", { productId, platform });
        const existing = this.records.getByProduct(productId)[0];
        return this.generateCloningPlan({
            productId,
            platform,
            consentId: existing?.profile.consentId ?? "demo-consent-tech-en",
            voiceSampleId: existing?.profile.sampleId,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgSimilarity = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.voiceSimilarityScore, 0) / all.length)
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
        const module = this.foundation?.getRegistry().getModule("voice-cloning-generation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        const authorizedCount = all.filter((r) => r.authorizationCompliant).length;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            voiceAnalysisStatus: "pitch, timbre, tone, rate, rhythm, pronunciation, accent, emotion analysis active",
            authorizationValidationStatus: "consent, usage permission, project auth, licensing, expiration checks active",
            voiceProfileStatus: "voice profile creation with authorization status tracking active",
            voiceConsistencyStatus: "identity, style, accent, pronunciation, emotion, rhythm consistency active",
            voiceLibraryStatus: "7 voice library types supported (professional, narrator, character, corporate, educational, commercial, custom)",
            cloningPlansGenerated: all.length,
            averageVoiceSimilarityScore: avgSimilarity,
            averageProductionReadinessScore: avgProductionReadiness,
            performance: {
                averageGenerationMs: avg(this.generationTimes),
                averageSearchMs: avg(this.searchTimes),
                averageBlueprintMs: avg(this.blueprintTimes),
            },
            knownIssues: authorizedCount < all.length ? ["Some records lack authorization compliance"] : [],
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
            throw new VoiceCloningGenerationEngineError("Voice Cloning Generation Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=voice-cloning-generation-engine.js.map