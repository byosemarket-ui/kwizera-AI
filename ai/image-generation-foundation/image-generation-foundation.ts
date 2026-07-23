/**
 * AI Image Generation Foundation — central architecture for all future AI Image Generation modules.
 */
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import { ImageGenerationAccessCoordinator } from "./image-generation-access-coordinator.js";
import { ImageGenerationHealthMonitor } from "./image-generation-health-monitor.js";
import { ImageGenerationHistoryStore } from "./image-generation-history-store.js";
import { ImageGenerationIntegrityVerifier } from "./image-generation-integrity-verifier.js";
import { ImageGenerationIntegrationBridge } from "./image-generation-integration-bridge.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationQualityValidator } from "./image-generation-quality-validator.js";
import { ImageGenerationRegistry } from "./image-generation-registry.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
import {
  createDefaultGenerationAssetQuality,
  GenerationAssetRegistry,
} from "./generation-asset-registry.js";
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
import {
  ImageGenerationAccessRequest,
  ImageGenerationAccessResult,
  ImageGenerationFoundationError,
  ImageGenerationFoundationStatusReport,
  ImageGenerationHealthLevel,
  ImageGenerationHealthReport,
  ImageGenerationIntegrityResult,
  ImageGenerationLifecycleState,
  ImageGenerationModuleRegistration,
  ImageGenerationQualityMetadata,
  ImageGenerationValidationResult,
} from "./types.js";

export class AiImageGenerationFoundation {
  private core: AiCoreManager | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;
  private lifecycleState = ImageGenerationLifecycleState.Initializing;
  private startupMs = 0;
  private lastIntegrity: ImageGenerationIntegrityResult | null = null;
  private lastHealth: ImageGenerationHealthReport | null = null;

  readonly logger = new ImageGenerationFoundationLogger();
  readonly history = new ImageGenerationHistoryStore();
  readonly integration = new ImageGenerationIntegrationBridge(this.logger);

  private readonly storage = new ImageGenerationStorageManager(this.logger);
  private readonly registry = new ImageGenerationRegistry(this.logger);
  private readonly integrityVerifier = new ImageGenerationIntegrityVerifier(this.logger);
  private readonly healthMonitor = new ImageGenerationHealthMonitor(this.logger);
  readonly assetRegistry = new GenerationAssetRegistry(this.logger);
  readonly blueprintManager = new ImageGenerationBlueprintManager(this.logger);
  readonly workflow = new NonDestructiveGenerationWorkflow(this.logger);
  readonly projectManager = new GenerationProjectManager(this.logger);
  readonly textToImageGenerationEngine = new AiTextToImageGenerationEngine();
  readonly imageToImageGenerationEngine = new AiImageToImageGenerationEngine();
  readonly productImageGenerationEngine = new AiProductImageGenerationEngine();
  readonly backgroundGenerationEngine = new AiBackgroundGenerationEngine();
  readonly imageEditingEngine = new AiImageEditingEngine();
  readonly imageEnhancementEngine = new AiImageEnhancementEngine();
  readonly brandingDesignEngine = new AiBrandingDesignEngine();
  readonly multiStyleImageGenerationEngine = new AiMultiStyleImageGenerationEngine();
  readonly imageProductionEngine = new AiImageProductionEngine();
  readonly imageRenderingPreparationEngine = new AiImageRenderingPreparationEngine();
  readonly imageQualityValidationEngine = new AiImageQualityValidationEngine();
  readonly imageGenerationOptimizationEngine = new AiImageGenerationOptimizationEngine();
  readonly imageGenerationHealthMonitorEngine = new AiImageGenerationHealthMonitorEngine();

  private accessCoordinator: ImageGenerationAccessCoordinator | null = null;
  private qualityValidator: ImageGenerationQualityValidator | null = null;

  initialize(
    core: AiCoreManager,
    storageRoot: string,
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
    productIntelligenceFoundation: AiProductIntelligenceFoundation | null,
    imageIntelligenceFoundation: AiImageIntelligenceFoundation | null,
    videoIntelligenceFoundation: AiVideoIntelligenceFoundation | null,
    videoGenerationFoundation: AiVideoGenerationFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
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

    this.accessCoordinator = new ImageGenerationAccessCoordinator(
      this.logger,
      this.history,
      this.registry
    );
    this.qualityValidator = new ImageGenerationQualityValidator(this.logger, this.registry);

    this.integration.connect(
      core,
      memoryFoundation,
      knowledgeFoundation,
      productIntelligenceFoundation,
      imageIntelligenceFoundation,
      videoIntelligenceFoundation,
      videoGenerationFoundation,
      moduleManager,
      stateManager,
      recoveryEngine,
      systemHealthMonitor
    );

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

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();
    this.lifecycleState = ImageGenerationLifecycleState.Loading;

    this.lastIntegrity = this.integrityVerifier.verify(
      this.storage,
      this.registry,
      this.blueprintManager
    );
    if (!this.lastIntegrity.verified && this.lastIntegrity.issues.length > 0) {
      this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
      this.registry.persist();
      this.assetRegistry.repairSafeIssues();
      this.blueprintManager.repairSafeIssues();
      this.workflow.repairSafeIssues();
      this.lastIntegrity = this.integrityVerifier.verify(
        this.storage,
        this.registry,
        this.blueprintManager
      );
    }

    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.assetRegistry,
      this.blueprintManager,
      this.workflow,
      this.integration.isIntegrationReady()
    );

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

  async requestAccess(request: ImageGenerationAccessRequest): Promise<ImageGenerationAccessResult> {
    this.ensureReady();
    this.lifecycleState = ImageGenerationLifecycleState.Preparing;
    try {
      return await this.accessCoordinator!.requestAccess(request);
    } finally {
      this.lifecycleState = ImageGenerationLifecycleState.Ready;
    }
  }

  registerImageGenerationModule(
    registration: Omit<ImageGenerationModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt">
  ): void {
    this.ensureReady();
    const full: ImageGenerationModuleRegistration = {
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

  validateGeneration(metadata: ImageGenerationQualityMetadata): ImageGenerationValidationResult {
    this.ensureReady();
    this.lifecycleState = ImageGenerationLifecycleState.Validating;
    try {
      const result = this.qualityValidator!.validateMetadata(metadata);
      this.history.append({
        timestamp: new Date().toISOString(),
        event: "validation",
        success: result.valid,
        durationMs: result.durationMs,
        detail: `Quality ${result.qualityScore}, confidence ${result.confidenceScore}`,
      });
      return result;
    } finally {
      this.lifecycleState = ImageGenerationLifecycleState.Ready;
    }
  }

  validateModule(moduleId: string): ImageGenerationValidationResult {
    this.ensureReady();
    return this.qualityValidator!.validateModule(moduleId);
  }

  refreshIntegration(
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
    productIntelligenceFoundation: AiProductIntelligenceFoundation | null,
    imageIntelligenceFoundation: AiImageIntelligenceFoundation | null,
    videoIntelligenceFoundation: AiVideoIntelligenceFoundation | null,
    videoGenerationFoundation: AiVideoGenerationFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
    if (!this.core) return;
    this.integration.connect(
      this.core,
      memoryFoundation,
      knowledgeFoundation,
      productIntelligenceFoundation,
      imageIntelligenceFoundation,
      videoIntelligenceFoundation,
      videoGenerationFoundation,
      moduleManager,
      stateManager,
      recoveryEngine,
      systemHealthMonitor
    );
  }

  async runHealthCheck(): Promise<ImageGenerationHealthReport> {
    this.ensureReady();
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.assetRegistry,
      this.blueprintManager,
      this.workflow,
      this.integration.isIntegrationReady()
    );
    return this.lastHealth;
  }

  async recover(): Promise<void> {
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
    this.lastIntegrity = this.integrityVerifier.verify(
      this.storage,
      this.registry,
      this.blueprintManager
    );
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.assetRegistry,
      this.blueprintManager,
      this.workflow,
      this.integration.isIntegrationReady()
    );
    this.registry.persist();

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "recovery",
      success: this.lastIntegrity.verified,
      detail: "Image Generation recovery complete",
    });

    this.lifecycleState = ImageGenerationLifecycleState.Ready;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    this.lifecycleState = ImageGenerationLifecycleState.Closing;
    this.registry.persist();
    this.lifecycleState = ImageGenerationLifecycleState.Closed;
    this.logger.log("info", "shutdown", "AI Image Generation Foundation shut down");
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLifecycleState(): ImageGenerationLifecycleState {
    return this.lifecycleState;
  }

  setLifecycleGenerating(): void {
    if (this.startupComplete) this.lifecycleState = ImageGenerationLifecycleState.Generating;
  }

  setLifecycleReady(): void {
    if (this.startupComplete) this.lifecycleState = ImageGenerationLifecycleState.Ready;
  }

  getGenerationRoot(): string {
    return this.storage.getGenerationRoot();
  }

  getRegistry(): ImageGenerationRegistry {
    return this.registry;
  }

  getAssetRegistry(): GenerationAssetRegistry {
    return this.assetRegistry;
  }

  getBlueprintManager(): ImageGenerationBlueprintManager {
    return this.blueprintManager;
  }

  getWorkflow(): NonDestructiveGenerationWorkflow {
    return this.workflow;
  }

  getProjectManager(): GenerationProjectManager {
    return this.projectManager;
  }

  getTextToImageGenerationEngine(): AiTextToImageGenerationEngine {
    return this.textToImageGenerationEngine;
  }

  getImageToImageGenerationEngine(): AiImageToImageGenerationEngine {
    return this.imageToImageGenerationEngine;
  }

  getProductImageGenerationEngine(): AiProductImageGenerationEngine {
    return this.productImageGenerationEngine;
  }

  getBackgroundGenerationEngine(): AiBackgroundGenerationEngine {
    return this.backgroundGenerationEngine;
  }

  getImageEditingEngine(): AiImageEditingEngine {
    return this.imageEditingEngine;
  }

  getImageEnhancementEngine(): AiImageEnhancementEngine {
    return this.imageEnhancementEngine;
  }

  getBrandingDesignEngine(): AiBrandingDesignEngine {
    return this.brandingDesignEngine;
  }

  getMultiStyleImageGenerationEngine(): AiMultiStyleImageGenerationEngine {
    return this.multiStyleImageGenerationEngine;
  }

  getImageProductionEngine(): AiImageProductionEngine {
    return this.imageProductionEngine;
  }

  getImageRenderingPreparationEngine(): AiImageRenderingPreparationEngine {
    return this.imageRenderingPreparationEngine;
  }

  getImageQualityValidationEngine(): AiImageQualityValidationEngine {
    return this.imageQualityValidationEngine;
  }

  getImageGenerationOptimizationEngine(): AiImageGenerationOptimizationEngine {
    return this.imageGenerationOptimizationEngine;
  }

  getImageGenerationHealthMonitorEngine(): AiImageGenerationHealthMonitorEngine {
    return this.imageGenerationHealthMonitorEngine;
  }

  getLastIntegrityResult(): ImageGenerationIntegrityResult | null {
    return this.lastIntegrity;
  }

  getLastHealthReport(): ImageGenerationHealthReport | null {
    return this.lastHealth;
  }

  getPreparedModuleCount(): number {
    return PREPARED_IMAGE_GENERATION_MODULES.length;
  }

  buildStatusReport(): ImageGenerationFoundationStatusReport {
    const persistence = this.storage.verifyPersistence();
    const knownIssues: string[] = [];

    if (this.lastIntegrity && !this.lastIntegrity.verified) {
      knownIssues.push(...this.lastIntegrity.issues);
    }
    if (this.lastHealth && this.lastHealth.issues.length > 0) {
      knownIssues.push(...this.lastHealth.issues);
    }

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 30;
    if (!persistence.passed) readinessScore -= 20;
    if (this.lastIntegrity && !this.lastIntegrity.verified) readinessScore -= 15;
    if (this.lastHealth && this.lastHealth.score < 80) readinessScore -= 10;
    if (!this.integration.isIntegrationReady()) readinessScore -= 5;
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

  private ensureReady(): void {
    if (!this.initialized || !this.accessCoordinator || !this.qualityValidator) {
      throw new ImageGenerationFoundationError(
        "AI Image Generation Foundation not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}

export { createDefaultGenerationAssetQuality };
