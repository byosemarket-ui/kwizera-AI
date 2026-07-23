import path from "node:path";
import { ImageIntelligenceAccessCoordinator } from "./image-intelligence-access-coordinator.js";
import { ImageIntelligenceHealthMonitor } from "./image-intelligence-health-monitor.js";
import { ImageIntelligenceHistoryStore } from "./image-intelligence-history-store.js";
import { ImageIntelligenceIntegrityVerifier } from "./image-intelligence-integrity-verifier.js";
import { ImageIntelligenceIntegrationBridge } from "./image-intelligence-integration-bridge.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceQualityValidator } from "./image-intelligence-quality-validator.js";
import { ImageIntelligenceRegistry } from "./image-intelligence-registry.js";
import { ImageIntelligenceStorageManager } from "./image-intelligence-storage.js";
import { PREPARED_IMAGE_INTELLIGENCE_MODULES } from "./image-intelligence-categories.js";
import { AiImageAnalysisEngine } from "../image-analysis-engine/image-analysis-engine.js";
import { AiImageUnderstandingEngine } from "../image-understanding-engine/image-understanding-engine.js";
import { AiObjectDetectionIntelligenceEngine } from "../object-detection-intelligence-engine/object-detection-intelligence-engine.js";
import { AiBackgroundIntelligenceEngine } from "../background-intelligence-engine/background-intelligence-engine.js";
import { AiCompositionIntelligenceEngine } from "../composition-intelligence-engine/composition-intelligence-engine.js";
import { AiLightingColorIntelligenceEngine } from "../lighting-color-intelligence-engine/lighting-color-intelligence-engine.js";
import { AiBrandVisualIntelligenceEngine } from "../brand-visual-intelligence-engine/brand-visual-intelligence-engine.js";
import { AiImageEnhancementPlanningEngine } from "../image-enhancement-planning-engine/image-enhancement-planning-engine.js";
import { AiCreativeImageIntelligenceEngine } from "../creative-image-intelligence-engine/creative-image-intelligence-engine.js";
import { AiProductionImagePlanningEngine } from "../production-image-planning-engine/production-image-planning-engine.js";
import { AiImageQualityPredictionEngine } from "../image-quality-prediction-engine/image-quality-prediction-engine.js";
import { AiImageIntelligenceOptimizationEngine } from "../image-intelligence-optimization-engine/image-intelligence-optimization-engine.js";
import { AiImageIntelligenceHealthMonitorEngine } from "../image-intelligence-health-monitor-engine/image-intelligence-health-monitor-engine.js";
import { DEFAULT_STORAGE_ROOT } from "../../storage/paths/storage-paths.js";
import { ImageIntelligenceFoundationError, ImageIntelligenceHealthLevel, ImageIntelligenceLifecycleState, } from "./types.js";
/**
 * Image Intelligence Foundation — central architecture for all future Image Intelligence modules.
 */
export class AiImageIntelligenceFoundation {
    core = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    lifecycleState = ImageIntelligenceLifecycleState.Initializing;
    startupMs = 0;
    lastIntegrity = null;
    lastHealth = null;
    logger = new ImageIntelligenceFoundationLogger();
    history = new ImageIntelligenceHistoryStore();
    integration = new ImageIntelligenceIntegrationBridge(this.logger);
    storage = new ImageIntelligenceStorageManager(this.logger);
    registry = new ImageIntelligenceRegistry(this.logger);
    integrityVerifier = new ImageIntelligenceIntegrityVerifier(this.logger);
    healthMonitor = new ImageIntelligenceHealthMonitor(this.logger);
    accessCoordinator = null;
    qualityValidator = null;
    imageAnalysisEngine = new AiImageAnalysisEngine();
    imageUnderstandingEngine = new AiImageUnderstandingEngine();
    objectDetectionIntelligenceEngine = new AiObjectDetectionIntelligenceEngine();
    backgroundIntelligenceEngine = new AiBackgroundIntelligenceEngine();
    compositionIntelligenceEngine = new AiCompositionIntelligenceEngine();
    lightingColorIntelligenceEngine = new AiLightingColorIntelligenceEngine();
    brandVisualIntelligenceEngine = new AiBrandVisualIntelligenceEngine();
    imageEnhancementPlanningEngine = new AiImageEnhancementPlanningEngine();
    creativeImageIntelligenceEngine = new AiCreativeImageIntelligenceEngine();
    productionImagePlanningEngine = new AiProductionImagePlanningEngine();
    imageQualityPredictionEngine = new AiImageQualityPredictionEngine();
    imageIntelligenceOptimizationEngine = new AiImageIntelligenceOptimizationEngine();
    imageIntelligenceHealthMonitorEngine = new AiImageIntelligenceHealthMonitorEngine();
    initialize(core, storageRoot, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.lifecycleState = ImageIntelligenceLifecycleState.Initializing;
        this.logger.log("info", "startup", "Image Intelligence Foundation initializing", { storageRoot });
        const intelligenceRoot = this.storage.initialize(storageRoot);
        this.history.initialize(intelligenceRoot);
        this.registry.initialize(this.storage, storageRoot);
        this.accessCoordinator = new ImageIntelligenceAccessCoordinator(this.logger, this.history, this.registry, this.storage);
        this.qualityValidator = new ImageIntelligenceQualityValidator(this.logger, this.registry);
        this.imageAnalysisEngine.initialize(this, storageRoot);
        this.imageUnderstandingEngine.initialize(this, storageRoot);
        this.objectDetectionIntelligenceEngine.initialize(this, storageRoot);
        this.backgroundIntelligenceEngine.initialize(this, storageRoot);
        this.compositionIntelligenceEngine.initialize(this, storageRoot);
        this.lightingColorIntelligenceEngine.initialize(this, storageRoot);
        this.brandVisualIntelligenceEngine.initialize(this, storageRoot);
        this.imageEnhancementPlanningEngine.initialize(this, storageRoot);
        this.creativeImageIntelligenceEngine.initialize(this, storageRoot);
        this.productionImagePlanningEngine.initialize(this, storageRoot);
        this.imageQualityPredictionEngine.initialize(this, storageRoot);
        this.imageIntelligenceOptimizationEngine.initialize(this, storageRoot);
        this.imageIntelligenceHealthMonitorEngine.initialize(this, storageRoot, path.join(DEFAULT_STORAGE_ROOT, "project-state"));
        this.integration.connect(core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor);
        this.integrityVerifier.writeManifest(this.storage, storageRoot);
        this.initialized = true;
        this.lifecycleState = ImageIntelligenceLifecycleState.Loading;
        this.logger.log("info", "startup", "Image Intelligence Foundation initialized", { intelligenceRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.lifecycleState = ImageIntelligenceLifecycleState.Loading;
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        if (!this.lastIntegrity.verified && this.lastIntegrity.issues.length > 0) {
            this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
            this.registry.persist();
            this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        }
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.integration.isIntegrationReady());
        this.registry.persist();
        await this.imageAnalysisEngine.runStartup();
        await this.imageUnderstandingEngine.runStartup();
        await this.objectDetectionIntelligenceEngine.runStartup();
        await this.backgroundIntelligenceEngine.runStartup();
        await this.compositionIntelligenceEngine.runStartup();
        await this.lightingColorIntelligenceEngine.runStartup();
        await this.brandVisualIntelligenceEngine.runStartup();
        await this.imageEnhancementPlanningEngine.runStartup();
        await this.creativeImageIntelligenceEngine.runStartup();
        await this.productionImagePlanningEngine.runStartup();
        await this.imageQualityPredictionEngine.runStartup();
        await this.imageIntelligenceOptimizationEngine.runStartup();
        await this.imageIntelligenceHealthMonitorEngine.runStartup();
        this.startupMs = Date.now() - start;
        this.startupComplete = true;
        this.lifecycleState = ImageIntelligenceLifecycleState.Ready;
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "startup",
            success: true,
            detail: `Image Intelligence Foundation ready in ${this.startupMs}ms`,
        });
        this.logger.log("info", "startup", "Image Intelligence Foundation startup complete", {
            startupMs: this.startupMs,
            modules: this.registry.getPreparedCount(),
            healthScore: this.lastHealth.score,
            integrationReady: this.integration.isIntegrationReady(),
        });
    }
    async requestAccess(request) {
        this.ensureReady();
        this.lifecycleState = ImageIntelligenceLifecycleState.Analyzing;
        try {
            return await this.accessCoordinator.requestAccess(request);
        }
        finally {
            this.lifecycleState = ImageIntelligenceLifecycleState.Ready;
        }
    }
    registerImageIntelligenceModule(registration) {
        this.ensureReady();
        const full = {
            ...registration,
            healthStatus: this.lastHealth?.level ?? ImageIntelligenceHealthLevel.Good,
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
    validateImageIntelligence(metadata) {
        this.ensureReady();
        this.lifecycleState = ImageIntelligenceLifecycleState.Validating;
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
            this.lifecycleState = ImageIntelligenceLifecycleState.Ready;
        }
    }
    validateModule(moduleId) {
        this.ensureReady();
        return this.qualityValidator.validateModule(moduleId);
    }
    refreshIntegration(memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        if (!this.core)
            return;
        this.integration.connect(this.core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor);
    }
    async runHealthCheck() {
        this.ensureReady();
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.integration.isIntegrationReady());
        return this.lastHealth;
    }
    async recover() {
        this.ensureReady();
        this.lifecycleState = ImageIntelligenceLifecycleState.Recovering;
        this.logger.log("info", "recovery", "Image Intelligence recovery initiated");
        this.registry.initialize(this.storage, this.storageRoot);
        this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.integration.isIntegrationReady());
        this.registry.persist();
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "recovery",
            success: this.lastIntegrity.verified,
            detail: "Image Intelligence recovery complete",
        });
        this.lifecycleState = ImageIntelligenceLifecycleState.Ready;
        this.logger.log("info", "recovery", "Image Intelligence recovery complete", {
            verified: this.lastIntegrity.verified,
        });
    }
    async shutdown() {
        if (!this.initialized)
            return;
        this.lifecycleState = ImageIntelligenceLifecycleState.Closing;
        this.registry.persist();
        this.lifecycleState = ImageIntelligenceLifecycleState.Closed;
        this.logger.log("info", "shutdown", "Image Intelligence Foundation shut down");
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "shutdown",
            success: true,
            detail: "Image Intelligence Foundation shut down",
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
    getImageAnalysisEngine() {
        return this.imageAnalysisEngine;
    }
    getImageUnderstandingEngine() {
        return this.imageUnderstandingEngine;
    }
    getObjectDetectionIntelligenceEngine() {
        return this.objectDetectionIntelligenceEngine;
    }
    getBackgroundIntelligenceEngine() {
        return this.backgroundIntelligenceEngine;
    }
    getCompositionIntelligenceEngine() {
        return this.compositionIntelligenceEngine;
    }
    getLightingColorIntelligenceEngine() {
        return this.lightingColorIntelligenceEngine;
    }
    getBrandVisualIntelligenceEngine() {
        return this.brandVisualIntelligenceEngine;
    }
    getImageEnhancementPlanningEngine() {
        return this.imageEnhancementPlanningEngine;
    }
    getCreativeImageIntelligenceEngine() {
        return this.creativeImageIntelligenceEngine;
    }
    getProductionImagePlanningEngine() {
        return this.productionImagePlanningEngine;
    }
    getImageQualityPredictionEngine() {
        return this.imageQualityPredictionEngine;
    }
    getImageIntelligenceOptimizationEngine() {
        return this.imageIntelligenceOptimizationEngine;
    }
    getImageIntelligenceHealthMonitorEngine() {
        return this.imageIntelligenceHealthMonitorEngine;
    }
    getRegistry() {
        return this.registry;
    }
    getLastIntegrityResult() {
        return this.lastIntegrity;
    }
    getLastHealthReport() {
        return this.lastHealth;
    }
    getPreparedModuleCount() {
        return PREPARED_IMAGE_INTELLIGENCE_MODULES.length;
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
            healthLevel: this.lastHealth?.level ?? ImageIntelligenceHealthLevel.Good,
            integrationStatus: this.integration.getStatus(),
            registeredModules: this.registry.getRegisteredCount(),
            preparedModules: this.registry.getPreparedCount(),
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
            throw new ImageIntelligenceFoundationError("Image Intelligence Foundation not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=image-intelligence-foundation.js.map