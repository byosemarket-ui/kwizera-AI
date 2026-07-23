import path from "node:path";
import { VideoGenerationAccessPermission, VideoGenerationCategory, VideoGenerationModuleStatus, } from "../video-generation-foundation/types.js";
import { CameraDirectorAnalyzer } from "./camera-director-analyzer.js";
import { CameraDirectorLinker } from "./camera-director-linker.js";
import { CameraDirectorLogger } from "./camera-director-logger.js";
import { CameraDirectorProcessor } from "./camera-director-processor.js";
import { CameraDirectorScorer } from "./camera-director-scorer.js";
import { CameraDirectorRecordStore } from "./camera-director-stores.js";
import { CameraDirectorEngineError, } from "./types.js";
/**
 * AI Camera Director Engine — plans and directs virtual camera behavior
 * for production-ready AI video generation.
 */
export class AiCameraDirectorEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new CameraDirectorLogger();
    records = new CameraDirectorRecordStore();
    analyzer = new CameraDirectorAnalyzer();
    scorer = new CameraDirectorScorer();
    linker = new CameraDirectorLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    compositionTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "camera-plans", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new CameraDirectorProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Camera Director Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoGenerationModule({
            moduleId: "camera-planning-generation-engine",
            moduleName: "Camera Director Engine",
            category: VideoGenerationCategory.CameraPlanning,
            version: "0.1.0",
            status: VideoGenerationModuleStatus.Active,
            dependencies: ["video-generation-engine", "video-intelligence-engine"],
            qualityScore: 93,
            confidenceScore: 91,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "camera-plans"),
            accessPermissions: [
                VideoGenerationAccessPermission.Read,
                VideoGenerationAccessPermission.Write,
                VideoGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Camera Director Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async planCamera(input) {
        this.ensureReady();
        const result = await this.processor.planCamera(input);
        if (result.success) {
            this.planningTimes.push(result.durationMs);
            this.compositionTimes.push(result.durationMs);
        }
        return result;
    }
    getCameraPlan(cameraPlanId) {
        this.ensureReady();
        return this.records.get(cameraPlanId) ?? null;
    }
    getCameraPlansByScene(sceneId) {
        this.ensureReady();
        return this.records.getByScene(sceneId);
    }
    getCameraPlansByStoryboard(storyboardId) {
        this.ensureReady();
        return this.records.getByStoryboard(storyboardId);
    }
    searchCameraPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Camera plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairCameraPlan(storyboardId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing camera plans", { storyboardId, platform });
        return this.planCamera({ storyboardId, platform });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgDirection = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.cameraDirectionScore, 0) / all.length)
            : 0;
        const avgProductionReadiness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getSceneGenerationEngine().isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("camera-planning-generation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            planningStatus: "camera angles, movements, framing, and focus planning active",
            compositionStatus: "rule-of-thirds, product highlight, and brand visibility composition",
            continuityStatus: "camera, motion, lighting, and story continuity maintained",
            cameraPlansGenerated: all.length,
            averageCameraDirectionScore: avgDirection,
            averageProductionReadinessScore: avgProductionReadiness,
            performance: {
                averagePlanningMs: avg(this.planningTimes),
                averageSearchMs: avg(this.searchTimes),
                averageCompositionMs: avg(this.compositionTimes),
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
            throw new CameraDirectorEngineError("Camera Director Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=camera-director-engine.js.map