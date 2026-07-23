import path from "node:path";
import { ImageIntelligenceAccessPermission, ImageIntelligenceCategory, ImageIntelligenceModuleStatus, } from "../image-intelligence-foundation/types.js";
import { CompositionAnalyzer } from "./composition-analyzer.js";
import { CompositionLinker } from "./composition-linker.js";
import { CompositionLogger } from "./composition-logger.js";
import { CompositionProcessor } from "./composition-processor.js";
import { CompositionScorer } from "./composition-scorer.js";
import { CompositionIntelligenceRecordStore } from "./composition-stores.js";
import { CompositionIntelligenceEngineError, } from "./types.js";
/**
 * Composition Intelligence Engine — analyzes, understands and plans image composition for creative production.
 */
export class AiCompositionIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new CompositionLogger();
    records = new CompositionIntelligenceRecordStore();
    analyzer = new CompositionAnalyzer();
    scorer = new CompositionScorer();
    linker = new CompositionLinker();
    processor = null;
    analysisTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "composition", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new CompositionProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Composition Intelligence Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageIntelligenceModule({
            moduleId: "composition-intelligence",
            moduleName: "Composition Intelligence",
            category: ImageIntelligenceCategory.Composition,
            version: "0.1.0",
            status: ImageIntelligenceModuleStatus.Active,
            dependencies: [
                "image-engine",
                "image-analysis-engine",
                "image-understanding-engine",
                "object-detection-intelligence",
            ],
            qualityScore: 91,
            confidenceScore: 89,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "composition"),
            accessPermissions: [
                ImageIntelligenceAccessPermission.Read,
                ImageIntelligenceAccessPermission.Write,
                ImageIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Composition Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async analyzeComposition(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success)
            this.analysisTimes.push(result.durationMs);
        return result;
    }
    getComposition(imageId) {
        this.ensureReady();
        return this.records.get(imageId) ?? null;
    }
    searchCompositions(query) {
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
        const background = this.foundation.getBackgroundIntelligenceEngine().getBackground(imageId);
        if (!analysis || !understanding || !detection)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), analysis, understanding, detection, background, record.relationships.relatedProjects, record.relationships.relatedKnowledge);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairComposition(imageId) {
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
        const background = this.foundation.getBackgroundIntelligenceEngine().getBackground(imageId);
        if (!background?.validated) {
            await this.foundation.getBackgroundIntelligenceEngine().repairBackground(imageId);
        }
        this.logger.log("info", "validation", "Repairing composition intelligence", { imageId });
        return this.analyzeComposition({
            imageId,
            relatedKnowledge: understanding.relationships.relatedKnowledge,
            relatedProjects: understanding.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.compositionQualityScore, 0) / all.length)
            : 0;
        const avgHierarchy = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.visualHierarchyScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getImageAnalysisEngine().isStartupComplete())
            readinessScore -= 7;
        if (!this.foundation?.getImageUnderstandingEngine().isStartupComplete())
            readinessScore -= 7;
        if (!this.foundation?.getObjectDetectionIntelligenceEngine().isStartupComplete())
            readinessScore -= 7;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            compositionAnalysisStatus: "rule of thirds, center, symmetry, balance, negative space, leading lines, depth, perspective, framing and cropping analyzed",
            visualHierarchyStatus: "main subject, product priority, brand visibility, CTA and reading flow evaluated",
            productPlacementStatus: "position, scale, alignment, visibility, focus and emphasis tracked",
            improvementPlanningStatus: "crop, reposition, balance, focus, framing and hierarchy strategies prepared",
            relationshipStatus: `${all.length} images indexed for composition relationships`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
            imagesAnalyzed: all.length,
            averageQualityScore: avgQuality,
            averageHierarchyScore: avgHierarchy,
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
            throw new CompositionIntelligenceEngineError("Composition Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=composition-intelligence-engine.js.map