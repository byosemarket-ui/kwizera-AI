/**
 * Video Intelligence Foundation — central architecture for all future Video Intelligence modules.
 */
import path from "node:path";
import { VideoIntelligenceAccessCoordinator } from "./video-intelligence-access-coordinator.js";
import { VideoIntelligenceHealthMonitor } from "./video-intelligence-health-monitor.js";
import { VideoIntelligenceHistoryStore } from "./video-intelligence-history-store.js";
import { VideoIntelligenceIntegrityVerifier } from "./video-intelligence-integrity-verifier.js";
import { VideoIntelligenceIntegrationBridge } from "./video-intelligence-integration-bridge.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceQualityValidator } from "./video-intelligence-quality-validator.js";
import { VideoIntelligenceRegistry } from "./video-intelligence-registry.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
import { VideoAssetRegistry } from "./video-asset-registry.js";
import { FrameIndexManager } from "./frame-index-manager.js";
import { NonDestructiveWorkflow } from "./non-destructive-workflow.js";
import { VideoProjectManager } from "./video-project-manager.js";
import { PREPARED_VIDEO_INTELLIGENCE_MODULES } from "./video-intelligence-categories.js";
import { AiVideoAnalysisEngine } from "../video-analysis-engine/video-analysis-engine.js";
import { AiVideoUnderstandingEngine } from "../video-understanding-engine/video-understanding-engine.js";
import { AiSceneDetectionIntelligenceEngine } from "../scene-detection-intelligence-engine/scene-detection-intelligence-engine.js";
import { AiTimelineIntelligenceEngine } from "../timeline-intelligence-engine/timeline-intelligence-engine.js";
import { AiCameraMovementIntelligenceEngine } from "../camera-movement-intelligence-engine/camera-movement-intelligence-engine.js";
import { AiMotionIntelligenceEngine } from "../motion-intelligence-engine/motion-intelligence-engine.js";
import { AiVideoStyleIntelligenceEngine } from "../video-style-intelligence-engine/video-style-intelligence-engine.js";
import { AiVideoEnhancementPlanningEngine } from "../video-enhancement-planning-engine/video-enhancement-planning-engine.js";
import { AiCreativeVideoIntelligenceEngine } from "../creative-video-intelligence-engine/creative-video-intelligence-engine.js";
import { AiProductionVideoPlanningEngine } from "../production-video-planning-engine/production-video-planning-engine.js";
import { AiVideoQualityPredictionEngine } from "../video-quality-prediction-engine/video-quality-prediction-engine.js";
import { AiVideoIntelligenceOptimizationEngine } from "../video-intelligence-optimization-engine/video-intelligence-optimization-engine.js";
import { AiVideoIntelligenceHealthMonitorEngine } from "../video-intelligence-health-monitor-engine/video-intelligence-health-monitor-engine.js";
import { DEFAULT_STORAGE_ROOT } from "../../storage/paths/storage-paths.js";
import { VideoIntelligenceFoundationError, VideoIntelligenceHealthLevel, VideoIntelligenceLifecycleState, } from "./types.js";
export class AiVideoIntelligenceFoundation {
    core = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    lifecycleState = VideoIntelligenceLifecycleState.Initializing;
    startupMs = 0;
    lastIntegrity = null;
    lastHealth = null;
    logger = new VideoIntelligenceFoundationLogger();
    history = new VideoIntelligenceHistoryStore();
    integration = new VideoIntelligenceIntegrationBridge(this.logger);
    storage = new VideoIntelligenceStorageManager(this.logger);
    registry = new VideoIntelligenceRegistry(this.logger);
    integrityVerifier = new VideoIntelligenceIntegrityVerifier(this.logger);
    healthMonitor = new VideoIntelligenceHealthMonitor(this.logger);
    assetRegistry = new VideoAssetRegistry(this.logger);
    frameIndex = new FrameIndexManager(this.logger);
    workflow = new NonDestructiveWorkflow(this.logger);
    projectManager = new VideoProjectManager(this.logger);
    videoAnalysisEngine = new AiVideoAnalysisEngine();
    videoUnderstandingEngine = new AiVideoUnderstandingEngine();
    sceneDetectionEngine = new AiSceneDetectionIntelligenceEngine();
    timelineIntelligenceEngine = new AiTimelineIntelligenceEngine();
    cameraMovementEngine = new AiCameraMovementIntelligenceEngine();
    motionIntelligenceEngine = new AiMotionIntelligenceEngine();
    videoStyleIntelligenceEngine = new AiVideoStyleIntelligenceEngine();
    videoEnhancementPlanningEngine = new AiVideoEnhancementPlanningEngine();
    creativeVideoIntelligenceEngine = new AiCreativeVideoIntelligenceEngine();
    productionVideoPlanningEngine = new AiProductionVideoPlanningEngine();
    videoQualityPredictionEngine = new AiVideoQualityPredictionEngine();
    videoIntelligenceOptimizationEngine = new AiVideoIntelligenceOptimizationEngine();
    videoIntelligenceHealthMonitorEngine = new AiVideoIntelligenceHealthMonitorEngine();
    accessCoordinator = null;
    qualityValidator = null;
    initialize(core, storageRoot, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.lifecycleState = VideoIntelligenceLifecycleState.Initializing;
        this.logger.log("info", "startup", "Video Intelligence Foundation initializing", { storageRoot });
        const intelligenceRoot = this.storage.initialize(storageRoot);
        this.history.initialize(intelligenceRoot);
        this.registry.initialize(this.storage, storageRoot);
        this.assetRegistry.initialize(this.storage);
        this.frameIndex.initialize(this.storage);
        this.workflow.initialize(this.storage);
        this.projectManager.initialize(this.storage);
        this.accessCoordinator = new VideoIntelligenceAccessCoordinator(this.logger, this.history, this.registry, this.storage);
        this.qualityValidator = new VideoIntelligenceQualityValidator(this.logger, this.registry);
        this.videoAnalysisEngine.initialize(this, storageRoot);
        this.videoUnderstandingEngine.initialize(this, storageRoot);
        this.sceneDetectionEngine.initialize(this, storageRoot);
        this.timelineIntelligenceEngine.initialize(this, storageRoot);
        this.cameraMovementEngine.initialize(this, storageRoot);
        this.motionIntelligenceEngine.initialize(this, storageRoot);
        this.videoStyleIntelligenceEngine.initialize(this, storageRoot);
        this.videoEnhancementPlanningEngine.initialize(this, storageRoot);
        this.creativeVideoIntelligenceEngine.initialize(this, storageRoot);
        this.productionVideoPlanningEngine.initialize(this, storageRoot);
        this.videoQualityPredictionEngine.initialize(this, storageRoot);
        this.videoIntelligenceOptimizationEngine.initialize(this, storageRoot);
        this.videoIntelligenceHealthMonitorEngine.initialize(this, storageRoot, path.join(DEFAULT_STORAGE_ROOT, "project-state"));
        this.integration.connect(core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor);
        this.integrityVerifier.writeManifest(this.storage, storageRoot);
        this.initialized = true;
        this.lifecycleState = VideoIntelligenceLifecycleState.Loading;
        this.logger.log("info", "startup", "Video Intelligence Foundation initialized", { intelligenceRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.lifecycleState = VideoIntelligenceLifecycleState.Loading;
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        if (!this.lastIntegrity.verified && this.lastIntegrity.issues.length > 0) {
            this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
            this.registry.persist();
            this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        }
        this.assetRegistry.repairSafeIssues();
        this.workflow.repairSafeIssues();
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.assetRegistry, this.frameIndex, this.workflow, this.integration.isIntegrationReady());
        this.registry.persist();
        await this.videoAnalysisEngine.runStartup();
        await this.videoUnderstandingEngine.runStartup();
        await this.sceneDetectionEngine.runStartup();
        await this.timelineIntelligenceEngine.runStartup();
        await this.cameraMovementEngine.runStartup();
        await this.motionIntelligenceEngine.runStartup();
        await this.videoStyleIntelligenceEngine.runStartup();
        await this.videoEnhancementPlanningEngine.runStartup();
        await this.creativeVideoIntelligenceEngine.runStartup();
        await this.productionVideoPlanningEngine.runStartup();
        await this.videoQualityPredictionEngine.runStartup();
        await this.videoIntelligenceOptimizationEngine.runStartup();
        await this.videoIntelligenceHealthMonitorEngine.runStartup();
        this.startupMs = Date.now() - start;
        this.startupComplete = true;
        this.lifecycleState = VideoIntelligenceLifecycleState.Ready;
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "startup",
            success: true,
            detail: `Video Intelligence Foundation ready in ${this.startupMs}ms`,
        });
        this.logger.log("info", "startup", "Video Intelligence Foundation startup complete", {
            startupMs: this.startupMs,
            modules: this.registry.getPreparedCount(),
            healthScore: this.lastHealth.score,
            integrationReady: this.integration.isIntegrationReady(),
        });
    }
    async requestAccess(request) {
        this.ensureReady();
        this.lifecycleState = VideoIntelligenceLifecycleState.Analyzing;
        try {
            return await this.accessCoordinator.requestAccess(request);
        }
        finally {
            this.lifecycleState = VideoIntelligenceLifecycleState.Ready;
        }
    }
    registerVideoIntelligenceModule(registration) {
        this.ensureReady();
        const full = {
            ...registration,
            healthStatus: this.lastHealth?.level ?? VideoIntelligenceHealthLevel.Good,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        };
        this.registry.registerModule(full);
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "registration",
            category: registration.category,
            success: true,
            detail: `Registered ${registration.moduleId}`,
        });
    }
    validateVideoIntelligence(metadata) {
        this.ensureReady();
        this.lifecycleState = VideoIntelligenceLifecycleState.Validating;
        try {
            const result = this.qualityValidator.validateMetadata(metadata);
            this.history.append({
                timestamp: new Date().toISOString(),
                event: "validation",
                success: result.valid,
                durationMs: result.durationMs,
                detail: `Quality ${result.qualityScore}, confidence ${result.confidenceScore}`,
            });
            return result;
        }
        finally {
            this.lifecycleState = VideoIntelligenceLifecycleState.Ready;
        }
    }
    validateModule(moduleId) {
        this.ensureReady();
        return this.qualityValidator.validateModule(moduleId);
    }
    refreshIntegration(memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        if (!this.core)
            return;
        this.integration.connect(this.core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor);
    }
    async runHealthCheck() {
        this.ensureReady();
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.assetRegistry, this.frameIndex, this.workflow, this.integration.isIntegrationReady());
        return this.lastHealth;
    }
    async recover() {
        this.ensureReady();
        this.lifecycleState = VideoIntelligenceLifecycleState.Recovering;
        this.logger.log("info", "recovery", "Video Intelligence recovery initiated");
        this.registry.initialize(this.storage, this.storageRoot);
        this.assetRegistry.initialize(this.storage);
        this.frameIndex.initialize(this.storage);
        this.workflow.initialize(this.storage);
        this.projectManager.initialize(this.storage);
        this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
        this.assetRegistry.repairSafeIssues();
        this.workflow.repairSafeIssues();
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.assetRegistry, this.frameIndex, this.workflow, this.integration.isIntegrationReady());
        this.registry.persist();
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "recovery",
            success: this.lastIntegrity.verified,
            detail: "Video Intelligence recovery complete",
        });
        this.lifecycleState = VideoIntelligenceLifecycleState.Ready;
        this.logger.log("info", "recovery", "Video Intelligence recovery complete", {
            verified: this.lastIntegrity.verified,
        });
    }
    async shutdown() {
        if (!this.initialized)
            return;
        this.lifecycleState = VideoIntelligenceLifecycleState.Closing;
        this.registry.persist();
        this.lifecycleState = VideoIntelligenceLifecycleState.Closed;
        this.logger.log("info", "shutdown", "Video Intelligence Foundation shut down");
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "shutdown",
            success: true,
            detail: "Video Intelligence Foundation shut down",
        });
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    getLifecycleState() {
        return this.lifecycleState;
    }
    getIntelligenceRoot() {
        return this.storage.getIntelligenceRoot();
    }
    getRegistry() {
        return this.registry;
    }
    getAssetRegistry() {
        return this.assetRegistry;
    }
    getFrameIndexManager() {
        return this.frameIndex;
    }
    getWorkflow() {
        return this.workflow;
    }
    getProjectManager() {
        return this.projectManager;
    }
    getVideoAnalysisEngine() {
        return this.videoAnalysisEngine;
    }
    getVideoUnderstandingEngine() {
        return this.videoUnderstandingEngine;
    }
    getSceneDetectionEngine() {
        return this.sceneDetectionEngine;
    }
    getTimelineIntelligenceEngine() {
        return this.timelineIntelligenceEngine;
    }
    getCameraMovementEngine() {
        return this.cameraMovementEngine;
    }
    getMotionIntelligenceEngine() {
        return this.motionIntelligenceEngine;
    }
    getVideoStyleIntelligenceEngine() {
        return this.videoStyleIntelligenceEngine;
    }
    getVideoEnhancementPlanningEngine() {
        return this.videoEnhancementPlanningEngine;
    }
    getCreativeVideoIntelligenceEngine() {
        return this.creativeVideoIntelligenceEngine;
    }
    getProductionVideoPlanningEngine() {
        return this.productionVideoPlanningEngine;
    }
    getVideoQualityPredictionEngine() {
        return this.videoQualityPredictionEngine;
    }
    getVideoIntelligenceOptimizationEngine() {
        return this.videoIntelligenceOptimizationEngine;
    }
    getVideoIntelligenceHealthMonitorEngine() {
        return this.videoIntelligenceHealthMonitorEngine;
    }
    getLastIntegrityResult() {
        return this.lastIntegrity;
    }
    getLastHealthReport() {
        return this.lastHealth;
    }
    getPreparedModuleCount() {
        return PREPARED_VIDEO_INTELLIGENCE_MODULES.length;
    }
    buildStatusReport() {
        const persistence = this.storage.verifyPersistence();
        const knownIssues = [];
        if (this.lastIntegrity && !this.lastIntegrity.verified) {
            knownIssues.push(...this.lastIntegrity.issues);
        }
        if (this.lastHealth && this.lastHealth.issues.length > 0) {
            knownIssues.push(...this.lastHealth.issues);
        }
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 30;
        if (!persistence.passed)
            readinessScore -= 20;
        if (this.lastIntegrity && !this.lastIntegrity.verified)
            readinessScore -= 15;
        if (this.lastHealth && this.lastHealth.score < 80)
            readinessScore -= 10;
        if (!this.integration.isIntegrationReady())
            readinessScore -= 5;
        readinessScore = Math.max(0, readinessScore);
        return {
            foundationStatus: this.startupComplete ? "operational" : "initializing",
            lifecycleState: this.lifecycleState,
            registryStatus: `${this.registry.getPreparedCount()} modules prepared, ${this.registry.getRegisteredCount()} registered`,
            storageStatus: persistence.passed ? "persistent storage verified" : persistence.detail,
            persistenceStatus: persistence.passed ? "survives restart" : "persistence unverified",
            integrityStatus: this.lastIntegrity?.verified ? "verified" : "issues detected",
            healthLevel: this.lastHealth?.level ?? VideoIntelligenceHealthLevel.Good,
            integrationStatus: this.integration.getStatus(),
            registeredModules: this.registry.getRegisteredCount(),
            preparedModules: this.registry.getPreparedCount(),
            assetCount: this.assetRegistry.getCount(),
            projectCount: this.projectManager.getProjectCount(),
            indexedFrames: this.frameIndex.getCount(),
            performance: {
                startupMs: this.startupMs,
                averageReadMs: this.accessCoordinator?.getAverageReadMs() ?? 0,
                averageWriteMs: this.accessCoordinator?.getAverageWriteMs() ?? 0,
                averageValidationMs: this.qualityValidator?.getAverageValidationMs() ?? 0,
                averageIndexLookupMs: this.frameIndex.getAverageLookupMs(),
                totalAccessRequests: this.accessCoordinator?.getTotalRequests() ?? 0,
            },
            knownIssues,
            readinessScore,
            timestamp: new Date().toISOString(),
        };
    }
    ensureReady() {
        if (!this.initialized || !this.accessCoordinator || !this.qualityValidator) {
            throw new VideoIntelligenceFoundationError("Video Intelligence Foundation not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=video-intelligence-foundation.js.map