/**
 * AI Image Generation Foundation — central architecture for all future AI Image Generation modules.
 */
import path from "node:path";
import { ImageGenerationAccessCoordinator } from "./image-generation-access-coordinator.js";
import { ImageGenerationHealthMonitor } from "./image-generation-health-monitor.js";
import { ImageGenerationHistoryStore } from "./image-generation-history-store.js";
import { ImageGenerationIntegrityVerifier } from "./image-generation-integrity-verifier.js";
import { ImageGenerationIntegrationBridge } from "./image-generation-integration-bridge.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationQualityValidator } from "./image-generation-quality-validator.js";
import { ImageGenerationRegistry } from "./image-generation-registry.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
import { createDefaultGenerationAssetQuality, GenerationAssetRegistry, } from "./generation-asset-registry.js";
import { ImageGenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { GenerationProjectManager } from "./generation-project-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { PREPARED_IMAGE_GENERATION_MODULES } from "./image-generation-categories.js";
import { AiTextToImageGenerationEngine } from "../text-to-image-generation-engine/text-to-image-generation-engine.js";
import { AiImageToImageGenerationEngine } from "../image-to-image-generation-engine/image-to-image-generation-engine.js";
import { AiProductImageGenerationEngine } from "../product-image-generation-engine/product-image-generation-engine.js";
import { AiBackgroundGenerationEngine } from "../background-generation-engine/background-generation-engine.js";
import { AiImageEditingEngine } from "../image-editing-engine/image-editing-engine.js";
import { AiImageEnhancementEngine } from "../image-enhancement-engine/image-enhancement-engine.js";
import { AiBrandingDesignEngine } from "../branding-design-engine/branding-design-engine.js";
import { AiMultiStyleImageGenerationEngine } from "../multi-style-image-generation-engine/multi-style-image-generation-engine.js";
import { AiImageProductionEngine } from "../image-production-engine/image-production-engine.js";
import { AiImageRenderingPreparationEngine } from "../image-rendering-preparation-engine/image-rendering-preparation-engine.js";
import { AiImageQualityValidationEngine } from "../image-quality-validation-engine/image-quality-validation-engine.js";
import { AiImageGenerationOptimizationEngine } from "../image-generation-optimization-engine/image-generation-optimization-engine.js";
import { AiImageGenerationHealthMonitorEngine } from "../image-generation-health-monitor-engine/image-generation-health-monitor-engine.js";
import { ImageGenerationFoundationError, ImageGenerationHealthLevel, ImageGenerationLifecycleState, } from "./types.js";
export class AiImageGenerationFoundation {
    core = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    lifecycleState = ImageGenerationLifecycleState.Initializing;
    startupMs = 0;
    lastIntegrity = null;
    lastHealth = null;
    logger = new ImageGenerationFoundationLogger();
    history = new ImageGenerationHistoryStore();
    integration = new ImageGenerationIntegrationBridge(this.logger);
    storage = new ImageGenerationStorageManager(this.logger);
    registry = new ImageGenerationRegistry(this.logger);
    integrityVerifier = new ImageGenerationIntegrityVerifier(this.logger);
    healthMonitor = new ImageGenerationHealthMonitor(this.logger);
    assetRegistry = new GenerationAssetRegistry(this.logger);
    blueprintManager = new ImageGenerationBlueprintManager(this.logger);
    workflow = new NonDestructiveGenerationWorkflow(this.logger);
    projectManager = new GenerationProjectManager(this.logger);
    textToImageGenerationEngine = new AiTextToImageGenerationEngine();
    imageToImageGenerationEngine = new AiImageToImageGenerationEngine();
    productImageGenerationEngine = new AiProductImageGenerationEngine();
    backgroundGenerationEngine = new AiBackgroundGenerationEngine();
    imageEditingEngine = new AiImageEditingEngine();
    imageEnhancementEngine = new AiImageEnhancementEngine();
    brandingDesignEngine = new AiBrandingDesignEngine();
    multiStyleImageGenerationEngine = new AiMultiStyleImageGenerationEngine();
    imageProductionEngine = new AiImageProductionEngine();
    imageRenderingPreparationEngine = new AiImageRenderingPreparationEngine();
    imageQualityValidationEngine = new AiImageQualityValidationEngine();
    imageGenerationOptimizationEngine = new AiImageGenerationOptimizationEngine();
    imageGenerationHealthMonitorEngine = new AiImageGenerationHealthMonitorEngine();
    accessCoordinator = null;
    qualityValidator = null;
    initialize(core, storageRoot, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, videoGenerationFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.lifecycleState = ImageGenerationLifecycleState.Initializing;
        this.logger.log("info", "startup", "AI Image Generation Foundation initializing", { storageRoot });
        const generationRoot = this.storage.initialize(storageRoot);
        this.history.initialize(generationRoot);
        this.registry.initialize(this.storage, storageRoot);
        this.assetRegistry.initialize(this.storage);
        this.blueprintManager.initialize(this.storage);
        this.workflow.initialize(this.storage);
        this.projectManager.initialize(this.storage);
        this.accessCoordinator = new ImageGenerationAccessCoordinator(this.logger, this.history, this.registry);
        this.qualityValidator = new ImageGenerationQualityValidator(this.logger, this.registry);
        this.integration.connect(core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, videoGenerationFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor);
        this.integrityVerifier.writeManifest(this.storage, storageRoot);
        this.textToImageGenerationEngine.initialize(this, storageRoot);
        this.imageToImageGenerationEngine.initialize(this, storageRoot);
        this.productImageGenerationEngine.initialize(this, storageRoot);
        this.backgroundGenerationEngine.initialize(this, storageRoot);
        this.imageEditingEngine.initialize(this, storageRoot);
        this.imageEnhancementEngine.initialize(this, storageRoot);
        this.brandingDesignEngine.initialize(this, storageRoot);
        this.multiStyleImageGenerationEngine.initialize(this, storageRoot);
        this.imageProductionEngine.initialize(this, storageRoot);
        this.imageRenderingPreparationEngine.initialize(this, storageRoot);
        this.imageQualityValidationEngine.initialize(this, storageRoot);
        this.imageGenerationOptimizationEngine.initialize(this, storageRoot);
        this.imageGenerationHealthMonitorEngine.initialize(this, storageRoot);
        this.initialized = true;
        this.lifecycleState = ImageGenerationLifecycleState.Loading;
        this.logger.log("info", "startup", "AI Image Generation Foundation initialized", { generationRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.lifecycleState = ImageGenerationLifecycleState.Loading;
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
        await this.textToImageGenerationEngine.runStartup();
        await this.imageToImageGenerationEngine.runStartup();
        await this.productImageGenerationEngine.runStartup();
        await this.backgroundGenerationEngine.runStartup();
        await this.imageEditingEngine.runStartup();
        await this.imageEnhancementEngine.runStartup();
        await this.brandingDesignEngine.runStartup();
        await this.multiStyleImageGenerationEngine.runStartup();
        await this.imageProductionEngine.runStartup();
        await this.imageRenderingPreparationEngine.runStartup();
        await this.imageQualityValidationEngine.runStartup();
        await this.imageGenerationOptimizationEngine.runStartup();
        await this.imageGenerationHealthMonitorEngine.runStartup();
        this.startupMs = Date.now() - start;
        this.startupComplete = true;
        this.lifecycleState = ImageGenerationLifecycleState.Ready;
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "startup",
            success: true,
            detail: `AI Image Generation Foundation ready in ${this.startupMs}ms`,
        });
        this.logger.log("info", "startup", "AI Image Generation Foundation startup complete", {
            startupMs: this.startupMs,
            modules: this.registry.getPreparedCount(),
            healthScore: this.lastHealth.score,
            integrationReady: this.integration.isIntegrationReady(),
        });
    }
    async requestAccess(request) {
        this.ensureReady();
        this.lifecycleState = ImageGenerationLifecycleState.Preparing;
        try {
            return await this.accessCoordinator.requestAccess(request);
        }
        finally {
            this.lifecycleState = ImageGenerationLifecycleState.Ready;
        }
    }
    registerImageGenerationModule(registration) {
        this.ensureReady();
        const full = {
            ...registration,
            healthStatus: this.lastHealth?.level ?? ImageGenerationHealthLevel.Good,
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
        this.lifecycleState = ImageGenerationLifecycleState.Validating;
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
            this.lifecycleState = ImageGenerationLifecycleState.Ready;
        }
    }
    validateModule(moduleId) {
        this.ensureReady();
        return this.qualityValidator.validateModule(moduleId);
    }
    refreshIntegration(memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, videoGenerationFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        if (!this.core)
            return;
        this.integration.connect(this.core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, videoGenerationFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor);
    }
    async runHealthCheck() {
        this.ensureReady();
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.assetRegistry, this.blueprintManager, this.workflow, this.integration.isIntegrationReady());
        return this.lastHealth;
    }
    async recover() {
        this.ensureReady();
        this.lifecycleState = ImageGenerationLifecycleState.Recovering;
        this.logger.log("info", "recovery", "Image Generation recovery initiated");
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
            detail: "Image Generation recovery complete",
        });
        this.lifecycleState = ImageGenerationLifecycleState.Ready;
    }
    async shutdown() {
        if (!this.initialized)
            return;
        this.lifecycleState = ImageGenerationLifecycleState.Closing;
        this.registry.persist();
        this.lifecycleState = ImageGenerationLifecycleState.Closed;
        this.logger.log("info", "shutdown", "AI Image Generation Foundation shut down");
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
            this.lifecycleState = ImageGenerationLifecycleState.Generating;
    }
    setLifecycleReady() {
        if (this.startupComplete)
            this.lifecycleState = ImageGenerationLifecycleState.Ready;
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
    getTextToImageGenerationEngine() {
        return this.textToImageGenerationEngine;
    }
    getImageToImageGenerationEngine() {
        return this.imageToImageGenerationEngine;
    }
    getProductImageGenerationEngine() {
        return this.productImageGenerationEngine;
    }
    getBackgroundGenerationEngine() {
        return this.backgroundGenerationEngine;
    }
    getImageEditingEngine() {
        return this.imageEditingEngine;
    }
    getImageEnhancementEngine() {
        return this.imageEnhancementEngine;
    }
    getBrandingDesignEngine() {
        return this.brandingDesignEngine;
    }
    getMultiStyleImageGenerationEngine() {
        return this.multiStyleImageGenerationEngine;
    }
    getImageProductionEngine() {
        return this.imageProductionEngine;
    }
    getImageRenderingPreparationEngine() {
        return this.imageRenderingPreparationEngine;
    }
    getImageQualityValidationEngine() {
        return this.imageQualityValidationEngine;
    }
    getImageGenerationOptimizationEngine() {
        return this.imageGenerationOptimizationEngine;
    }
    getImageGenerationHealthMonitorEngine() {
        return this.imageGenerationHealthMonitorEngine;
    }
    getLastIntegrityResult() {
        return this.lastIntegrity;
    }
    getLastHealthReport() {
        return this.lastHealth;
    }
    getPreparedModuleCount() {
        return PREPARED_IMAGE_GENERATION_MODULES.length;
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
            healthLevel: this.lastHealth?.level ?? ImageGenerationHealthLevel.Good,
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
            throw new ImageGenerationFoundationError("AI Image Generation Foundation not initialized", "NOT_INITIALIZED");
        }
    }
}
export { createDefaultGenerationAssetQuality };
//# sourceMappingURL=image-generation-foundation.js.map