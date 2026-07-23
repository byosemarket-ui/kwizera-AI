import path from "node:path";
import { ImageIntelligenceAccessPermission, ImageIntelligenceCategory, ImageIntelligenceModuleStatus, } from "../image-intelligence-foundation/types.js";
import { ObjectDetectionAnalyzer } from "./object-detection-analyzer.js";
import { ObjectDetectionLinker } from "./object-detection-linker.js";
import { ObjectDetectionLogger } from "./object-detection-logger.js";
import { ObjectDetectionProcessor } from "./object-detection-processor.js";
import { ObjectDetectionScorer } from "./object-detection-scorer.js";
import { ObjectDetectionRecordStore } from "./object-detection-stores.js";
import { ObjectDetectionEngineError, } from "./types.js";
/**
 * Object Detection Intelligence Engine — detects, classifies and organizes visual objects in images.
 */
export class AiObjectDetectionIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ObjectDetectionLogger();
    records = new ObjectDetectionRecordStore();
    analyzer = new ObjectDetectionAnalyzer();
    scorer = new ObjectDetectionScorer();
    linker = new ObjectDetectionLinker();
    processor = null;
    detectionTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "object-detection", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ObjectDetectionProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Object Detection Intelligence Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageIntelligenceModule({
            moduleId: "object-detection-intelligence",
            moduleName: "Object Detection Intelligence",
            category: ImageIntelligenceCategory.ObjectDetection,
            version: "0.1.0",
            status: ImageIntelligenceModuleStatus.Active,
            dependencies: ["image-engine", "image-analysis-engine", "image-understanding-engine"],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "object-detection"),
            accessPermissions: [
                ImageIntelligenceAccessPermission.Read,
                ImageIntelligenceAccessPermission.Write,
                ImageIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Object Detection Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async detectObjects(input) {
        this.ensureReady();
        const result = await this.processor.detect(input);
        if (result.success)
            this.detectionTimes.push(result.durationMs);
        return result;
    }
    getDetection(imageId) {
        this.ensureReady();
        return this.records.get(imageId) ?? null;
    }
    searchDetections(query) {
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
        if (!analysis || !understanding)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), analysis, understanding, record.relationships.relatedProjects, record.relationships.relatedKnowledge);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairDetection(imageId) {
        this.ensureReady();
        let analysis = this.foundation.getImageAnalysisEngine().getImage(imageId);
        let understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(imageId);
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
        this.logger.log("info", "validation", "Repairing object detection", { imageId });
        return this.detectObjects({
            imageId,
            relatedKnowledge: understanding.relationships.relatedKnowledge,
            relatedProjects: understanding.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgDetection = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.objectDetectionScore, 0) / all.length)
            : 0;
        const avgConfidence = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.aiConfidenceScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getImageAnalysisEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getImageUnderstandingEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            objectDetectionStatus: "products, logos, text, icons, people, vehicles and 10+ object types prepared",
            productDetectionStatus: "main product, secondary products, visibility, position and grouping tracked",
            logoDetectionStatus: "logo presence, position, visibility, size and brand association active",
            relationshipStatus: `${all.length} images indexed for object relationships`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
            imagesDetected: all.length,
            totalObjectsDetected: this.records.getTotalObjects(),
            averageDetectionScore: avgDetection,
            averageConfidenceScore: avgConfidence,
            performance: {
                averageDetectionMs: avg(this.detectionTimes),
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
            throw new ObjectDetectionEngineError("Object Detection Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=object-detection-intelligence-engine.js.map