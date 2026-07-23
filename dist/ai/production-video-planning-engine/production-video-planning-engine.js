import path from "node:path";
import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, } from "../video-intelligence-foundation/types.js";
import { ProductionVideoAnalyzer } from "./production-video-analyzer.js";
import { ProductionVideoLinker } from "./production-video-linker.js";
import { ProductionVideoLogger } from "./production-video-logger.js";
import { ProductionVideoProcessor } from "./production-video-processor.js";
import { ProductionVideoScorer } from "./production-video-scorer.js";
import { ProductionVideoPlanningRecordStore } from "./production-video-stores.js";
import { ProductionVideoExportFormat, ProductionVideoPlanningEngineError, ProductionVideoPlatform, ProductionVideoWorkflowStep, } from "./types.js";
/**
 * Production Video Planning Engine — combines all video intelligence into production-ready execution plans.
 */
export class AiProductionVideoPlanningEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ProductionVideoLogger();
    records = new ProductionVideoPlanningRecordStore();
    analyzer = new ProductionVideoAnalyzer();
    scorer = new ProductionVideoScorer();
    linker = new ProductionVideoLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "production", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ProductionVideoProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Production Video Planning Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoIntelligenceModule({
            moduleId: "production-video-planning",
            moduleName: "Production Video Planning Engine",
            category: VideoIntelligenceCategory.ProductionPlanning,
            version: "0.1.0",
            status: VideoIntelligenceModuleStatus.Active,
            dependencies: [
                "video-engine",
                "video-analysis-engine",
                "video-understanding-engine",
                "scene-intelligence",
                "timeline-intelligence",
                "camera-intelligence",
                "motion-intelligence",
                "video-style-intelligence",
                "video-enhancement-planning",
                "creative-video-intelligence",
            ],
            qualityScore: 93,
            confidenceScore: 91,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "production"),
            accessPermissions: [
                VideoIntelligenceAccessPermission.Read,
                VideoIntelligenceAccessPermission.Write,
                VideoIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Production Video Planning Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async planProductionVideo(input) {
        this.ensureReady();
        const result = await this.processor.planProduction(input);
        if (result.success)
            this.planningTimes.push(result.durationMs);
        return result;
    }
    getProductionPlan(videoId) {
        this.ensureReady();
        return this.records.get(videoId) ?? null;
    }
    searchProductionPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    async repairProductionPlan(videoId) {
        this.ensureReady();
        const analysisEngine = this.foundation.getVideoAnalysisEngine();
        const understandingEngine = this.foundation.getVideoUnderstandingEngine();
        const sceneEngine = this.foundation.getSceneDetectionEngine();
        const timelineEngine = this.foundation.getTimelineIntelligenceEngine();
        const cameraEngine = this.foundation.getCameraMovementEngine();
        const motionEngine = this.foundation.getMotionIntelligenceEngine();
        const styleEngine = this.foundation.getVideoStyleIntelligenceEngine();
        const enhancementEngine = this.foundation.getVideoEnhancementPlanningEngine();
        const creativeEngine = this.foundation.getCreativeVideoIntelligenceEngine();
        let analysis = analysisEngine.getVideo(videoId);
        if (!analysis)
            return null;
        if (!analysis.validated) {
            const repaired = await analysisEngine.repairVideo(videoId);
            if (!repaired?.success || !repaired.record)
                return null;
            analysis = repaired.record;
        }
        if (!understandingEngine.getUnderstanding(videoId)?.validated) {
            await understandingEngine.repairUnderstanding(videoId);
        }
        if (!sceneEngine.getDetection(videoId)?.validated) {
            const repairedScene = await sceneEngine.repairDetection(videoId);
            if (!repairedScene?.success)
                return null;
        }
        if (!timelineEngine.getTimeline(videoId)?.validated) {
            await timelineEngine.repairTimeline(videoId);
        }
        if (!cameraEngine.getCameraAnalysis(videoId)?.validated) {
            await cameraEngine.repairCameraAnalysis(videoId);
        }
        if (!motionEngine.getMotionAnalysis(videoId)?.validated) {
            await motionEngine.repairMotionAnalysis(videoId);
        }
        if (!styleEngine.getStyleAnalysis(videoId)?.validated) {
            await styleEngine.repairStyleAnalysis(videoId);
        }
        if (!enhancementEngine.getEnhancementPlan(videoId)?.validated) {
            await enhancementEngine.repairEnhancementPlan(videoId);
        }
        if (!creativeEngine.getCreativePlan(videoId)?.validated) {
            await creativeEngine.repairCreativePlan(videoId);
        }
        this.logger.log("info", "validation", "Repairing production video plan", { videoId });
        return this.planProductionVideo({
            videoId,
            relatedKnowledge: analysis.relationships.relatedKnowledge,
            relatedProjects: analysis.relationships.relatedProjects,
        });
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
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getCreativeVideoIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getVideoEnhancementPlanningEngine().isStartupComplete())
            readinessScore -= 10;
        if (!integration?.knowledgeEngine)
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            workflowPlanningStatus: "analysis, understanding, scene, timeline, camera, motion, style, enhancement, creative, render, export, delivery",
            assetValidationStatus: "source videos, images, audio, voice, music, SFX, logos, fonts, templates, motion graphics, effects, LUTs, captions, subtitles, brand assets",
            dependencyValidationStatus: "14 required modules including foundation bridges",
            renderPreparationStatus: "resolution, frame rate, aspect ratio, codec, bitrate, audio, color, compression, priority",
            exportPreparationStatus: "MP4, MOV, MKV, WEBM, GIF — extensible format architecture",
            deliveryPreparationStatus: "platform delivery instructions and packaging strategy",
            relationshipStatus: `${all.length} production plans indexed`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
            imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
            plansCreated: all.length,
            averageProductionReadinessScore: avgReadiness,
            averageAssetReadinessScore: avgAsset,
            performance: {
                averagePlanningMs: avg(this.planningTimes),
                averageSearchMs: avg(this.searchTimes),
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
            throw new ProductionVideoPlanningEngineError("Production Video Planning Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
export { ProductionVideoPlatform, ProductionVideoWorkflowStep, ProductionVideoExportFormat };
//# sourceMappingURL=production-video-planning-engine.js.map