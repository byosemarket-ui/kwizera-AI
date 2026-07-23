import path from "node:path";
import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, } from "../video-intelligence-foundation/types.js";
import { CreativeVideoAnalyzer } from "./creative-video-analyzer.js";
import { CreativeVideoLinker } from "./creative-video-linker.js";
import { CreativeVideoLogger } from "./creative-video-logger.js";
import { CreativeVideoProcessor } from "./creative-video-processor.js";
import { CreativeVideoScorer } from "./creative-video-scorer.js";
import { CreativeVideoRecordStore } from "./creative-video-stores.js";
import { CreativeVideoTemplateLibrary } from "./creative-video-template-library.js";
import { CreativeVideoIntelligenceEngineError, CreativeVideoPlatform, CreativeVideoType, CreativeVideoTemplateType, } from "./types.js";
/**
 * Creative Video Intelligence Engine — transforms video intelligence into complete creative production planning.
 */
export class AiCreativeVideoIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new CreativeVideoLogger();
    records = new CreativeVideoRecordStore();
    templateLibrary = new CreativeVideoTemplateLibrary();
    analyzer = new CreativeVideoAnalyzer();
    scorer = new CreativeVideoScorer();
    linker = new CreativeVideoLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "creative", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new CreativeVideoProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Creative Video Intelligence Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoIntelligenceModule({
            moduleId: "creative-video-intelligence",
            moduleName: "Creative Video Intelligence Engine",
            category: VideoIntelligenceCategory.CreativeVideo,
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
            ],
            qualityScore: 92,
            confidenceScore: 90,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "creative"),
            accessPermissions: [
                VideoIntelligenceAccessPermission.Read,
                VideoIntelligenceAccessPermission.Write,
                VideoIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Creative Video Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
            templates: this.templateLibrary.getAllTemplates().length,
        });
    }
    async planCreativeVideo(input) {
        this.ensureReady();
        const result = await this.processor.planCreative(input);
        if (result.success)
            this.planningTimes.push(result.durationMs);
        return result;
    }
    getCreativePlan(videoId) {
        this.ensureReady();
        return this.records.get(videoId) ?? null;
    }
    searchCreativePlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    async repairCreativePlan(videoId) {
        this.ensureReady();
        const analysisEngine = this.foundation.getVideoAnalysisEngine();
        const sceneEngine = this.foundation.getSceneDetectionEngine();
        const understandingEngine = this.foundation.getVideoUnderstandingEngine();
        const timelineEngine = this.foundation.getTimelineIntelligenceEngine();
        const cameraEngine = this.foundation.getCameraMovementEngine();
        const motionEngine = this.foundation.getMotionIntelligenceEngine();
        const styleEngine = this.foundation.getVideoStyleIntelligenceEngine();
        const enhancementEngine = this.foundation.getVideoEnhancementPlanningEngine();
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
        if (!enhancementEngine.getEnhancementPlan(videoId)?.validated) {
            await enhancementEngine.repairEnhancementPlan(videoId);
        }
        this.logger.log("info", "validation", "Repairing creative video plan", { videoId });
        return this.planCreativeVideo({
            videoId,
            relatedKnowledge: analysis.relationships.relatedKnowledge,
            relatedProjects: analysis.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgCreative = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.creativeScore, 0) / all.length)
            : 0;
        const avgProduction = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getVideoEnhancementPlanningEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getVideoStyleIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        if (!integration?.knowledgeEngine)
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            storyboardPlanningStatus: "story structure, hook, scene order, timing, product/brand reveal, CTA, ending",
            creativePlanningStatus: "story flow, emotional flow, marketing flow, viewer/conversion journey",
            marketingPlanningStatus: "product showcase, offer, brand awareness, social engagement, lead gen, CTA",
            visualPlanningStatus: "camera, motion, composition, lighting, color, typography, graphics, transitions, effects",
            audioPlanningStatus: "voice, music, SFX, timing, mood, synchronization",
            templateLibraryStatus: `${this.templateLibrary.getAllTemplates().length} creative templates`,
            relationshipStatus: `${all.length} creative plans indexed`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
            imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
            videosProcessed: all.length,
            templatesAvailable: this.templateLibrary.getAllTemplates().length,
            averageCreativeScore: avgCreative,
            averageProductionReadinessScore: avgProduction,
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
            throw new CreativeVideoIntelligenceEngineError("Creative Video Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
export { CreativeVideoPlatform, CreativeVideoType, CreativeVideoTemplateType };
//# sourceMappingURL=creative-video-intelligence-engine.js.map