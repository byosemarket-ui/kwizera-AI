/**
 * AI Video Generation Foundation — central architecture for all future AI Video Generation modules.
 */
import path from "node:path";
import { VideoGenerationAccessCoordinator } from "./video-generation-access-coordinator.js";
import { VideoGenerationHealthMonitor } from "./video-generation-health-monitor.js";
import { VideoGenerationHistoryStore } from "./video-generation-history-store.js";
import { VideoGenerationIntegrityVerifier } from "./video-generation-integrity-verifier.js";
import { VideoGenerationIntegrationBridge } from "./video-generation-integration-bridge.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationQualityValidator } from "./video-generation-quality-validator.js";
import { VideoGenerationRegistry } from "./video-generation-registry.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";
import { createDefaultGenerationAssetQuality, GenerationAssetRegistry, } from "./generation-asset-registry.js";
import { GenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { GenerationProjectManager } from "./generation-project-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { PREPARED_VIDEO_GENERATION_MODULES } from "./video-generation-categories.js";
import { AiStoryboardGenerationEngine } from "../story-generation-engine/story-generation-engine.js";
import { AiSceneGenerationEngine } from "../scene-generation-engine/scene-generation-engine.js";
import { AiCameraDirectorEngine } from "../camera-director-engine/camera-director-engine.js";
import { AiMotionGenerationEngine } from "../motion-generation-engine/motion-generation-engine.js";
import { AiAnimationGenerationEngine } from "../animation-generation-engine/animation-generation-engine.js";
import { AiVisualEffectsGenerationEngine } from "../visual-effects-generation-engine/visual-effects-generation-engine.js";
import { AiAudioSynchronizationEngine } from "../audio-synchronization-engine/audio-synchronization-engine.js";
import { AiMarketingVideoEngine } from "../marketing-video-engine/marketing-video-engine.js";
import { AiVideoProductionEngine } from "../video-production-engine/video-production-engine.js";
import { AiRenderingPreparationEngine } from "../rendering-preparation-engine/rendering-preparation-engine.js";
import { AiVideoQualityValidationEngine } from "../video-quality-validation-engine/video-quality-validation-engine.js";
import { AiVideoGenerationOptimizationEngine } from "../video-generation-optimization-engine/video-generation-optimization-engine.js";
import { AiVideoGenerationHealthMonitorEngine } from "../video-generation-health-monitor-engine/video-generation-health-monitor-engine.js";
import { VideoGenerationFoundationError, VideoGenerationHealthLevel, VideoGenerationLifecycleState, } from "./types.js";
export class AiVideoGenerationFoundation {
    core = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    lifecycleState = VideoGenerationLifecycleState.Initializing;
    startupMs = 0;
    lastIntegrity = null;
    lastHealth = null;
    logger = new VideoGenerationFoundationLogger();
    history = new VideoGenerationHistoryStore();
    integration = new VideoGenerationIntegrationBridge(this.logger);
    storage = new VideoGenerationStorageManager(this.logger);
    registry = new VideoGenerationRegistry(this.logger);
    integrityVerifier = new VideoGenerationIntegrityVerifier(this.logger);
    healthMonitor = new VideoGenerationHealthMonitor(this.logger);
    assetRegistry = new GenerationAssetRegistry(this.logger);
    blueprintManager = new GenerationBlueprintManager(this.logger);
    workflow = new NonDestructiveGenerationWorkflow(this.logger);
    projectManager = new GenerationProjectManager(this.logger);
    storyGenerationEngine = new AiStoryboardGenerationEngine();
    sceneGenerationEngine = new AiSceneGenerationEngine();
    cameraDirectorEngine = new AiCameraDirectorEngine();
    motionGenerationEngine = new AiMotionGenerationEngine();
    animationGenerationEngine = new AiAnimationGenerationEngine();
    visualEffectsGenerationEngine = new AiVisualEffectsGenerationEngine();
    audioSynchronizationEngine = new AiAudioSynchronizationEngine();
    marketingVideoEngine = new AiMarketingVideoEngine();
    videoProductionEngine = new AiVideoProductionEngine();
    renderingPreparationEngine = new AiRenderingPreparationEngine();
    videoQualityValidationEngine = new AiVideoQualityValidationEngine();
    videoGenerationOptimizationEngine = new AiVideoGenerationOptimizationEngine();
    videoGenerationHealthMonitorEngine = new AiVideoGenerationHealthMonitorEngine();
    accessCoordinator = null;
    qualityValidator = null;
    initialize(core, storageRoot, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.lifecycleState = VideoGenerationLifecycleState.Initializing;
        this.logger.log("info", "startup", "AI Video Generation Foundation initializing", { storageRoot });
        const generationRoot = this.storage.initialize(storageRoot);
        this.history.initialize(generationRoot);
        this.registry.initialize(this.storage, storageRoot);
        this.assetRegistry.initialize(this.storage);
        this.blueprintManager.initialize(this.storage);
        this.workflow.initialize(this.storage);
        this.projectManager.initialize(this.storage);
        this.storyGenerationEngine.initialize(this, storageRoot);
        this.sceneGenerationEngine.initialize(this, storageRoot);
        this.cameraDirectorEngine.initialize(this, storageRoot);
        this.motionGenerationEngine.initialize(this, storageRoot);
        this.animationGenerationEngine.initialize(this, storageRoot);
        this.visualEffectsGenerationEngine.initialize(this, storageRoot);
        this.audioSynchronizationEngine.initialize(this, storageRoot);
        this.marketingVideoEngine.initialize(this, storageRoot);
        this.videoProductionEngine.initialize(this, storageRoot);
        this.renderingPreparationEngine.initialize(this, storageRoot);
        this.videoQualityValidationEngine.initialize(this, storageRoot);
        this.videoGenerationOptimizationEngine.initialize(this, storageRoot);
        this.videoGenerationHealthMonitorEngine.initialize(this, storageRoot);
        this.accessCoordinator = new VideoGenerationAccessCoordinator(this.logger, this.history, this.registry);
        this.qualityValidator = new VideoGenerationQualityValidator(this.logger, this.registry);
        this.integration.connect(core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor);
        this.integrityVerifier.writeManifest(this.storage, storageRoot);
        this.initialized = true;
        this.lifecycleState = VideoGenerationLifecycleState.Loading;
        this.logger.log("info", "startup", "AI Video Generation Foundation initialized", { generationRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.lifecycleState = VideoGenerationLifecycleState.Loading;
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry, this.blueprintManager);
        if (!this.lastIntegrity.verified && this.lastIntegrity.issues.length > 0) {
            this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
            this.registry.persist();
            this.assetRegistry.repairSafeIssues();
            this.blueprintManager.repairSafeIssues();
            this.workflow.repairSafeIssues();
            this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry, this.blueprintManager);
        }
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.assetRegistry, this.blueprintManager, this.workflow, this.integration.isIntegrationReady());
        this.registry.persist();
        await this.storyGenerationEngine.runStartup();
        await this.sceneGenerationEngine.runStartup();
        await this.cameraDirectorEngine.runStartup();
        await this.motionGenerationEngine.runStartup();
        await this.animationGenerationEngine.runStartup();
        await this.visualEffectsGenerationEngine.runStartup();
        await this.audioSynchronizationEngine.runStartup();
        await this.marketingVideoEngine.runStartup();
        await this.videoProductionEngine.runStartup();
        await this.renderingPreparationEngine.runStartup();
        await this.videoQualityValidationEngine.runStartup();
        await this.videoGenerationOptimizationEngine.runStartup();
        await this.videoGenerationHealthMonitorEngine.runStartup();
        this.startupMs = Date.now() - start;
        this.startupComplete = true;
        this.lifecycleState = VideoGenerationLifecycleState.Ready;
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "startup",
            success: true,
            detail: `AI Video Generation Foundation ready in ${this.startupMs}ms`,
        });
        this.logger.log("info", "startup", "AI Video Generation Foundation startup complete", {
            startupMs: this.startupMs,
            modules: this.registry.getPreparedCount(),
            healthScore: this.lastHealth.score,
            integrationReady: this.integration.isIntegrationReady(),
        });
    }
    async requestAccess(request) {
        this.ensureReady();
        this.lifecycleState = VideoGenerationLifecycleState.Preparing;
        try {
            return await this.accessCoordinator.requestAccess(request);
        }
        finally {
            this.lifecycleState = VideoGenerationLifecycleState.Ready;
        }
    }
    registerVideoGenerationModule(registration) {
        this.ensureReady();
        const full = {
            ...registration,
            healthStatus: this.lastHealth?.level ?? VideoGenerationHealthLevel.Good,
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
    validateGeneration(metadata) {
        this.ensureReady();
        this.lifecycleState = VideoGenerationLifecycleState.Validating;
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
            this.lifecycleState = VideoGenerationLifecycleState.Ready;
        }
    }
    validateModule(moduleId) {
        this.ensureReady();
        return this.qualityValidator.validateModule(moduleId);
    }
    refreshIntegration(memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        if (!this.core)
            return;
        this.integration.connect(this.core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor);
    }
    async runHealthCheck() {
        this.ensureReady();
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.assetRegistry, this.blueprintManager, this.workflow, this.integration.isIntegrationReady());
        return this.lastHealth;
    }
    async recover() {
        this.ensureReady();
        this.lifecycleState = VideoGenerationLifecycleState.Recovering;
        this.logger.log("info", "recovery", "Video Generation recovery initiated");
        this.registry.initialize(this.storage, this.storageRoot);
        this.assetRegistry.initialize(this.storage);
        this.blueprintManager.initialize(this.storage);
        this.workflow.initialize(this.storage);
        this.projectManager.initialize(this.storage);
        this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
        this.assetRegistry.repairSafeIssues();
        this.blueprintManager.repairSafeIssues();
        this.workflow.repairSafeIssues();
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry, this.blueprintManager);
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.assetRegistry, this.blueprintManager, this.workflow, this.integration.isIntegrationReady());
        this.registry.persist();
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "recovery",
            success: this.lastIntegrity.verified,
            detail: "Video Generation recovery complete",
        });
        this.lifecycleState = VideoGenerationLifecycleState.Ready;
    }
    async shutdown() {
        if (!this.initialized)
            return;
        this.lifecycleState = VideoGenerationLifecycleState.Closing;
        this.registry.persist();
        this.lifecycleState = VideoGenerationLifecycleState.Closed;
        this.logger.log("info", "shutdown", "AI Video Generation Foundation shut down");
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
    setLifecycleGenerating() {
        if (this.startupComplete)
            this.lifecycleState = VideoGenerationLifecycleState.Generating;
    }
    setLifecycleReady() {
        if (this.startupComplete)
            this.lifecycleState = VideoGenerationLifecycleState.Ready;
    }
    getStoryGenerationEngine() {
        return this.storyGenerationEngine;
    }
    getSceneGenerationEngine() {
        return this.sceneGenerationEngine;
    }
    getCameraDirectorEngine() {
        return this.cameraDirectorEngine;
    }
    getMotionGenerationEngine() {
        return this.motionGenerationEngine;
    }
    getAnimationGenerationEngine() {
        return this.animationGenerationEngine;
    }
    getVisualEffectsGenerationEngine() {
        return this.visualEffectsGenerationEngine;
    }
    getAudioSynchronizationEngine() {
        return this.audioSynchronizationEngine;
    }
    getMarketingVideoEngine() {
        return this.marketingVideoEngine;
    }
    getVideoProductionEngine() {
        return this.videoProductionEngine;
    }
    getRenderingPreparationEngine() {
        return this.renderingPreparationEngine;
    }
    getVideoQualityValidationEngine() {
        return this.videoQualityValidationEngine;
    }
    getVideoGenerationOptimizationEngine() {
        return this.videoGenerationOptimizationEngine;
    }
    getVideoGenerationHealthMonitorEngine() {
        return this.videoGenerationHealthMonitorEngine;
    }
    getGenerationRoot() {
        return this.storage.getGenerationRoot();
    }
    getRegistry() {
        return this.registry;
    }
    getAssetRegistry() {
        return this.assetRegistry;
    }
    getBlueprintManager() {
        return this.blueprintManager;
    }
    getWorkflow() {
        return this.workflow;
    }
    getProjectManager() {
        return this.projectManager;
    }
    getLastIntegrityResult() {
        return this.lastIntegrity;
    }
    getLastHealthReport() {
        return this.lastHealth;
    }
    getPreparedModuleCount() {
        return PREPARED_VIDEO_GENERATION_MODULES.length;
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
            healthLevel: this.lastHealth?.level ?? VideoGenerationHealthLevel.Good,
            integrationStatus: this.integration.getStatus(),
            registeredModules: this.registry.getRegisteredCount(),
            preparedModules: this.registry.getPreparedCount(),
            assetCount: this.assetRegistry.getCount(),
            projectCount: this.projectManager.getProjectCount(),
            blueprintCount: this.blueprintManager.getCount(),
            performance: {
                startupMs: this.startupMs,
                averageReadMs: this.accessCoordinator?.getAverageReadMs() ?? 0,
                averageWriteMs: this.accessCoordinator?.getAverageWriteMs() ?? 0,
                averageValidationMs: this.qualityValidator?.getAverageValidationMs() ?? 0,
                totalAccessRequests: this.accessCoordinator?.getTotalRequests() ?? 0,
            },
            knownIssues,
            readinessScore,
            timestamp: new Date().toISOString(),
        };
    }
    ensureReady() {
        if (!this.initialized || !this.accessCoordinator || !this.qualityValidator) {
            throw new VideoGenerationFoundationError("AI Video Generation Foundation not initialized", "NOT_INITIALIZED");
        }
    }
}
export { createDefaultGenerationAssetQuality };
//# sourceMappingURL=video-generation-foundation.js.map