import path from "node:path";
import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, } from "../video-intelligence-foundation/types.js";
import { CameraMovementAnalyzer } from "./camera-movement-analyzer.js";
import { CameraMovementLinker } from "./camera-movement-linker.js";
import { CameraMovementLogger } from "./camera-movement-logger.js";
import { CameraMovementProcessor } from "./camera-movement-processor.js";
import { CameraMovementScorer } from "./camera-movement-scorer.js";
import { CameraMovementRecordStore } from "./camera-movement-stores.js";
import { CameraAngle, CameraMovementEngineError, CameraMovementType, ShotFraming, } from "./types.js";
/**
 * Camera Movement Intelligence Engine — analyzes, classifies and plans camera movements in videos.
 */
export class AiCameraMovementIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new CameraMovementLogger();
    records = new CameraMovementRecordStore();
    analyzer = new CameraMovementAnalyzer();
    scorer = new CameraMovementScorer();
    linker = new CameraMovementLinker();
    processor = null;
    analysisTimes = [];
    searchTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "cameras", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new CameraMovementProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Camera Movement Intelligence Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoIntelligenceModule({
            moduleId: "camera-intelligence",
            moduleName: "Camera Movement Intelligence Engine",
            category: VideoIntelligenceCategory.CameraIntelligence,
            version: "0.1.0",
            status: VideoIntelligenceModuleStatus.Active,
            dependencies: [
                "video-engine",
                "video-analysis-engine",
                "scene-intelligence",
                "timeline-intelligence",
            ],
            qualityScore: 89,
            confidenceScore: 87,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "cameras"),
            accessPermissions: [
                VideoIntelligenceAccessPermission.Read,
                VideoIntelligenceAccessPermission.Write,
                VideoIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Camera Movement Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async analyzeCamera(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success)
            this.analysisTimes.push(result.durationMs);
        return result;
    }
    getCameraAnalysis(videoId) {
        this.ensureReady();
        return this.records.get(videoId) ?? null;
    }
    searchCameraAnalysis(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    async repairCameraAnalysis(videoId) {
        this.ensureReady();
        const analysisEngine = this.foundation.getVideoAnalysisEngine();
        const sceneEngine = this.foundation.getSceneDetectionEngine();
        const timelineEngine = this.foundation.getTimelineIntelligenceEngine();
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
        if (!timelineEngine.getTimeline(videoId)?.validated) {
            await timelineEngine.repairTimeline(videoId);
        }
        this.logger.log("info", "validation", "Repairing camera movement analysis", { videoId });
        return this.analyzeCamera({
            videoId,
            relatedKnowledge: analysis.relationships.relatedKnowledge,
            relatedProjects: analysis.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgMovement = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.cameraMovementScore, 0) / all.length)
            : 0;
        const avgStability = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.stabilityScore, 0) / all.length)
            : 0;
        const totalShots = all.reduce((s, r) => s + r.shotAnalyses.length, 0);
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getSceneDetectionEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getTimelineIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        if (!integration?.knowledgeEngine)
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            movementAnalysisStatus: "static, pan, tilt, zoom, dolly, truck, pedestal, crane, orbit, handheld, gimbal, drone, tracking, follow, push-in, pull-out",
            angleDetectionStatus: "eye-level, low, high, birds-eye, overhead, dutch, side, front, rear",
            framingAnalysisStatus: "EWS, WS, full, medium, MCU, CU, ECU, hero shot",
            stabilityAnalysisStatus: "stable, slight shake, heavy shake, motion smoothness, stabilization quality",
            cinematicPlanningStatus: "camera path, movement, style, continuity, sync planning active",
            relationshipStatus: `${all.length} videos indexed for camera relationships`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
            imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
            videosProcessed: all.length,
            totalShotsAnalyzed: totalShots,
            averageCameraMovementScore: avgMovement,
            averageStabilityScore: avgStability,
            performance: {
                averageAnalysisMs: avg(this.analysisTimes),
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
            throw new CameraMovementEngineError("Camera Movement Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
export { CameraMovementType, CameraAngle, ShotFraming };
//# sourceMappingURL=camera-movement-intelligence-engine.js.map