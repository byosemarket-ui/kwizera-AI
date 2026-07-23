import path from "node:path";
import { ImageIntelligenceAccessPermission, ImageIntelligenceCategory, ImageIntelligenceModuleStatus, } from "../image-intelligence-foundation/types.js";
import { BackgroundAnalyzer } from "./background-analyzer.js";
import { BackgroundLinker } from "./background-linker.js";
import { BackgroundLogger } from "./background-logger.js";
import { BackgroundProcessor } from "./background-processor.js";
import { BackgroundScorer } from "./background-scorer.js";
import { BackgroundIntelligenceRecordStore } from "./background-stores.js";
import { BackgroundIntelligenceEngineError, } from "./types.js";
/**
 * Background Intelligence Engine — understands, analyzes and plans background usage for creative production.
 */
export class AiBackgroundIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new BackgroundLogger();
    records = new BackgroundIntelligenceRecordStore();
    analyzer = new BackgroundAnalyzer();
    scorer = new BackgroundScorer();
    linker = new BackgroundLinker();
    processor = null;
    analysisTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "background", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new BackgroundProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Background Intelligence Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageIntelligenceModule({
            moduleId: "background-intelligence",
            moduleName: "Background Intelligence",
            category: ImageIntelligenceCategory.Background,
            version: "0.1.0",
            status: ImageIntelligenceModuleStatus.Active,
            dependencies: [
                "image-engine",
                "image-analysis-engine",
                "image-understanding-engine",
                "object-detection-intelligence",
            ],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "background"),
            accessPermissions: [
                ImageIntelligenceAccessPermission.Read,
                ImageIntelligenceAccessPermission.Write,
                ImageIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Background Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async analyzeBackground(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success)
            this.analysisTimes.push(result.durationMs);
        return result;
    }
    getBackground(imageId) {
        this.ensureReady();
        return this.records.get(imageId) ?? null;
    }
    searchBackgrounds(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    detectRelationships(imageId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(imageId);
        if (!record)
            return null;
        const analysis = this.foundation.getImageAnalysisEngine().getImage(imageId);
        const understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(imageId);
        const detection = this.foundation.getObjectDetectionIntelligenceEngine().getDetection(imageId);
        if (!analysis || !understanding || !detection)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), analysis, understanding, detection, record.relationships.relatedProjects, record.relationships.relatedKnowledge);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairBackground(imageId) {
        this.ensureReady();
        let analysis = this.foundation.getImageAnalysisEngine().getImage(imageId);
        let understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(imageId);
        let detection = this.foundation.getObjectDetectionIntelligenceEngine().getDetection(imageId);
        if (!analysis?.validated) {
            const repairedAnalysis = await this.foundation.getImageAnalysisEngine().repairImage(imageId);
            if (!repairedAnalysis?.success || !repairedAnalysis.record)
                return null;
            analysis = repairedAnalysis.record;
        }
        if (!understanding?.validated) {
            const repairedUnderstanding = await this.foundation.getImageUnderstandingEngine().repairUnderstanding(imageId);
            if (!repairedUnderstanding?.success)
                return null;
            understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(imageId);
            if (!understanding)
                return null;
        }
        if (!detection?.validated) {
            const repairedDetection = await this.foundation.getObjectDetectionIntelligenceEngine().repairDetection(imageId);
            if (!repairedDetection?.success)
                return null;
            detection = this.foundation.getObjectDetectionIntelligenceEngine().getDetection(imageId);
            if (!detection)
                return null;
        }
        this.logger.log("info", "validation", "Repairing background intelligence", { imageId });
        return this.analyzeBackground({
            imageId,
            relatedKnowledge: understanding.relationships.relatedKnowledge,
            relatedProjects: understanding.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.backgroundQualityScore, 0) / all.length)
            : 0;
        const avgSuitability = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.backgroundSuitabilityScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getImageAnalysisEngine().isStartupComplete())
            readinessScore -= 8;
        if (!this.foundation?.getImageUnderstandingEngine().isStartupComplete())
            readinessScore -= 8;
        if (!this.foundation?.getObjectDetectionIntelligenceEngine().isStartupComplete())
            readinessScore -= 8;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            backgroundAnalysisStatus: "type, complexity, colors, brightness, contrast, texture, pattern, depth, perspective and cleanliness analyzed",
            classificationStatus: "studio, lifestyle, indoor, outdoor, nature, office, commercial, transparent, gradient, abstract and custom",
            suitabilityStatus: "product showcase, advertisement, social media, poster, banner, thumbnail and video production",
            replacementPlanningStatus: "isolation, replacement, color harmony, lighting, perspective and shadow planning prepared",
            relationshipStatus: `${all.length} images indexed for background relationships`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
            imagesAnalyzed: all.length,
            averageQualityScore: avgQuality,
            averageSuitabilityScore: avgSuitability,
            performance: {
                averageAnalysisMs: avg(this.analysisTimes),
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
            throw new BackgroundIntelligenceEngineError("Background Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=background-intelligence-engine.js.map