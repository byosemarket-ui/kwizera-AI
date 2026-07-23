import path from "node:path";
import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, } from "../video-intelligence-foundation/types.js";
import { VideoEnhancementAnalyzer } from "./video-enhancement-analyzer.js";
import { VideoEnhancementLinker } from "./video-enhancement-linker.js";
import { VideoEnhancementLogger } from "./video-enhancement-logger.js";
import { VideoEnhancementProcessor } from "./video-enhancement-processor.js";
import { VideoEnhancementScorer } from "./video-enhancement-scorer.js";
import { VideoEnhancementRecordStore } from "./video-enhancement-stores.js";
import { VideoEnhancementPlatform, EnhancementType, VideoEnhancementPlanningEngineError, } from "./types.js";
/**
 * Video Enhancement Planning Engine — prepares complete non-destructive enhancement strategy before editing.
 */
export class AiVideoEnhancementPlanningEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new VideoEnhancementLogger();
    records = new VideoEnhancementRecordStore();
    analyzer = new VideoEnhancementAnalyzer();
    scorer = new VideoEnhancementScorer();
    linker = new VideoEnhancementLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "enhancement-planning", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new VideoEnhancementProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Video Enhancement Planning Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoIntelligenceModule({
            moduleId: "video-enhancement-planning",
            moduleName: "Video Enhancement Planning Engine",
            category: VideoIntelligenceCategory.EnhancementPlanning,
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
            ],
            qualityScore: 91,
            confidenceScore: 89,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "enhancement-planning"),
            accessPermissions: [
                VideoIntelligenceAccessPermission.Read,
                VideoIntelligenceAccessPermission.Write,
                VideoIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Video Enhancement Planning Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async planEnhancement(input) {
        this.ensureReady();
        const result = await this.processor.planEnhancement(input);
        if (result.success)
            this.planningTimes.push(result.durationMs);
        return result;
    }
    getEnhancementPlan(videoId) {
        this.ensureReady();
        return this.records.get(videoId) ?? null;
    }
    searchEnhancementPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    async repairEnhancementPlan(videoId) {
        this.ensureReady();
        const analysisEngine = this.foundation.getVideoAnalysisEngine();
        const sceneEngine = this.foundation.getSceneDetectionEngine();
        const timelineEngine = this.foundation.getTimelineIntelligenceEngine();
        const cameraEngine = this.foundation.getCameraMovementEngine();
        const motionEngine = this.foundation.getMotionIntelligenceEngine();
        const styleEngine = this.foundation.getVideoStyleIntelligenceEngine();
        const understandingEngine = this.foundation.getVideoUnderstandingEngine();
        let analysis = analysisEngine.getVideo(videoId);
        if (!analysis)
            return null;
        if (!analysis.validated) {
            const repaired = await analysisEngine.repairVideo(videoId);
            if (!repaired?.success || !repaired.record)
                return null;
            analysis = repaired.record;
        }
        if (!sceneEngine.getDetection(videoId)?.validated) {
            const repairedScene = await sceneEngine.repairDetection(videoId);
            if (!repairedScene?.success)
                return null;
        }
        if (!understandingEngine.getUnderstanding(videoId)?.validated) {
            await understandingEngine.repairUnderstanding(videoId);
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
        this.logger.log("info", "validation", "Repairing enhancement plan", { videoId });
        return this.planEnhancement({
            videoId,
            relatedKnowledge: analysis.relationships.relatedKnowledge,
            relatedProjects: analysis.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgReadiness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.enhancementReadinessScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getVideoStyleIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getMotionIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        if (!integration?.knowledgeEngine)
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            qualityAnalysisStatus: "resolution, frame, motion, stabilization, noise, compression, lighting, color, clarity, audio",
            visualPlanningStatus: "resolution, frame, noise, stabilization, color correction, grading, lighting, contrast, sharpness, background",
            audioPlanningStatus: "noise reduction, voice, music, sync, loudness, echo, clarity",
            motionPlanningStatus: "smoothing, consistency, stabilization, continuity, frame interpolation prep",
            platformOptimizationStatus: "TikTok, Instagram, Facebook, YouTube, WhatsApp, Website, TV, Print",
            nonDestructiveStatus: "preserve original, undo, redo, recovery, version history",
            relationshipStatus: `${all.length} enhancement plans indexed`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
            imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
            videosProcessed: all.length,
            plansGenerated: all.length,
            averageEnhancementReadinessScore: avgReadiness,
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
            throw new VideoEnhancementPlanningEngineError("Video Enhancement Planning Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
export { VideoEnhancementPlatform, EnhancementType };
//# sourceMappingURL=video-enhancement-planning-engine.js.map