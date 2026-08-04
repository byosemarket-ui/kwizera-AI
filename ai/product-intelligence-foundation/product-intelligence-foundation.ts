import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import { ProductIntelligenceAccessCoordinator } from "./product-intelligence-access-coordinator.js";
import { ProductIntelligenceHealthMonitor } from "./product-intelligence-health-monitor.js";
import { ProductIntelligenceHistoryStore } from "./product-intelligence-history-store.js";
import { ProductIntelligenceIntegrityVerifier } from "./product-intelligence-integrity-verifier.js";
import { ProductIntelligenceIntegrationBridge } from "./product-intelligence-integration-bridge.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
import { ProductIntelligenceQualityValidator } from "./product-intelligence-quality-validator.js";
import { ProductIntelligenceRegistry } from "./product-intelligence-registry.js";
import { ProductIntelligenceStorageManager } from "./product-intelligence-storage.js";
import { AiProductAnalysisEngine } from "../product-analysis-engine/product-analysis-engine.js";
import { AiProductUnderstandingEngine } from "../product-understanding-engine/product-understanding-engine.js";
import { AiTargetAudienceIntelligenceEngine } from "../audience-intelligence-engine/audience-intelligence-engine.js";
import { AiMarketingStrategyIntelligenceEngine } from "../marketing-strategy-intelligence-engine/marketing-strategy-intelligence-engine.js";
import { AiCreativeDirectionEngine } from "../creative-direction-engine/creative-direction-engine.js";
import { AiStoryboardIntelligenceEngine } from "../storyboard-intelligence-engine/storyboard-intelligence-engine.js";
import { AiScriptPlanningEngine } from "../script-planning-engine/script-planning-engine.js";
import { AiVisualPlanningEngine } from "../visual-planning-engine/visual-planning-engine.js";
import { AiAudioPlanningEngine } from "../audio-planning-engine/audio-planning-engine.js";
import { AiProductionPlanningEngine } from "../production-planning-engine/production-planning-engine.js";
import { AiQualityPredictionEngine } from "../quality-prediction-engine/quality-prediction-engine.js";
import { AiProductIntelligenceOptimizationEngine } from "../product-intelligence-optimization-engine/product-intelligence-optimization-engine.js";
import { AiProductIntelligenceHealthMonitorEngine } from "../product-intelligence-health-monitor-engine/product-intelligence-health-monitor-engine.js";
import { PREPARED_PRODUCT_INTELLIGENCE_MODULES } from "./product-intelligence-categories.js";
import {
  ProductIntelligenceAccessOperation,
  ProductIntelligenceAccessRequest,
  ProductIntelligenceAccessResult,
  ProductIntelligenceFoundationError,
  ProductIntelligenceFoundationStatusReport,
  ProductIntelligenceHealthLevel,
  ProductIntelligenceHealthReport,
  ProductIntelligenceIntegrityResult,
  ProductIntelligenceLifecycleState,
  ProductIntelligenceModuleRegistration,
  ProductIntelligenceModuleStatus,
  ProductIntelligenceQualityMetadata,
  ProductIntelligenceValidationResult,
} from "./types.js";

/**
 * Product Intelligence Foundation — central intelligence layer for understanding products
 * before creative content is generated.
 */
export class AiProductIntelligenceFoundation {
  private core: AiCoreManager | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;
  private lifecycleState = ProductIntelligenceLifecycleState.Initializing;
  private startupMs = 0;
  private lastIntegrity: ProductIntelligenceIntegrityResult | null = null;
  private lastHealth: ProductIntelligenceHealthReport | null = null;

  readonly logger = new ProductIntelligenceFoundationLogger();
  readonly history = new ProductIntelligenceHistoryStore();
  readonly integration = new ProductIntelligenceIntegrationBridge(this.logger);

  private readonly storage = new ProductIntelligenceStorageManager(this.logger);
  private readonly registry = new ProductIntelligenceRegistry(this.logger);
  private readonly integrityVerifier = new ProductIntelligenceIntegrityVerifier(this.logger);
  private readonly healthMonitor = new ProductIntelligenceHealthMonitor(this.logger);
  private accessCoordinator: ProductIntelligenceAccessCoordinator | null = null;
  private qualityValidator: ProductIntelligenceQualityValidator | null = null;
  readonly productAnalysisEngine = new AiProductAnalysisEngine();
  readonly productUnderstandingEngine = new AiProductUnderstandingEngine();
  readonly targetAudienceIntelligenceEngine = new AiTargetAudienceIntelligenceEngine();
  readonly marketingStrategyIntelligenceEngine = new AiMarketingStrategyIntelligenceEngine();
  readonly creativeDirectionEngine = new AiCreativeDirectionEngine();
  readonly storyboardIntelligenceEngine = new AiStoryboardIntelligenceEngine();
  readonly scriptPlanningEngine = new AiScriptPlanningEngine();
  readonly visualPlanningEngine = new AiVisualPlanningEngine();
  readonly audioPlanningEngine = new AiAudioPlanningEngine();
  readonly productionPlanningEngine = new AiProductionPlanningEngine();
  readonly qualityPredictionEngine = new AiQualityPredictionEngine();
  readonly productIntelligenceOptimizationEngine = new AiProductIntelligenceOptimizationEngine();
  readonly productIntelligenceHealthMonitorEngine = new AiProductIntelligenceHealthMonitorEngine();

  initialize(
    core: AiCoreManager,
    storageRoot: string,
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
    this.core = core;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    this.logger.initialize(logDir);

    this.lifecycleState = ProductIntelligenceLifecycleState.Initializing;
    this.logger.log("info", "startup", "Product Intelligence Foundation initializing", { storageRoot });

    const intelligenceRoot = this.storage.initialize(storageRoot);
    this.history.initialize(intelligenceRoot);
    this.registry.initialize(this.storage, storageRoot);

    this.accessCoordinator = new ProductIntelligenceAccessCoordinator(
      this.logger,
      this.history,
      this.registry,
      this.storage
    );
    this.qualityValidator = new ProductIntelligenceQualityValidator(this.logger, this.registry);

    this.productAnalysisEngine.initialize(this, storageRoot);
    this.productUnderstandingEngine.initialize(this, storageRoot);
    this.targetAudienceIntelligenceEngine.initialize(this, storageRoot);
    this.marketingStrategyIntelligenceEngine.initialize(this, storageRoot);
    this.creativeDirectionEngine.initialize(this, storageRoot);
    this.storyboardIntelligenceEngine.initialize(this, storageRoot);
    this.scriptPlanningEngine.initialize(this, storageRoot);
    this.visualPlanningEngine.initialize(this, storageRoot);
    this.audioPlanningEngine.initialize(this, storageRoot);
    this.productionPlanningEngine.initialize(this, storageRoot);
    this.qualityPredictionEngine.initialize(this, storageRoot);
    this.productIntelligenceOptimizationEngine.initialize(this, storageRoot);
    this.productIntelligenceHealthMonitorEngine.initialize(
      this,
      storageRoot,
      path.join(storageRoot, "project-state")
    );

    this.integration.connect(
      core,
      memoryFoundation,
      knowledgeFoundation,
      moduleManager,
      stateManager,
      recoveryEngine,
      systemHealthMonitor
    );

    this.integrityVerifier.writeManifest(this.storage, storageRoot);
    this.initialized = true;
    this.lifecycleState = ProductIntelligenceLifecycleState.Loading;

    this.logger.log("info", "startup", "Product Intelligence Foundation initialized", { intelligenceRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();
    this.lifecycleState = ProductIntelligenceLifecycleState.Loading;

    this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
    if (!this.lastIntegrity.verified && this.lastIntegrity.issues.length > 0) {
      this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
      this.registry.persist();
      this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
    }

    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.integration.isIntegrationReady()
    );

    this.registry.persist();

    await this.productAnalysisEngine.runStartup();
    await this.productUnderstandingEngine.runStartup();
    await this.targetAudienceIntelligenceEngine.runStartup();
    await this.marketingStrategyIntelligenceEngine.runStartup();
    await this.creativeDirectionEngine.runStartup();
    await this.storyboardIntelligenceEngine.runStartup();
    await this.scriptPlanningEngine.runStartup();
    await this.visualPlanningEngine.runStartup();
    await this.audioPlanningEngine.runStartup();
    await this.productionPlanningEngine.runStartup();
    await this.qualityPredictionEngine.runStartup();
    await this.productIntelligenceOptimizationEngine.runStartup();
    await this.productIntelligenceHealthMonitorEngine.runStartup();

    this.startupMs = Date.now() - start;
    this.startupComplete = true;
    this.lifecycleState = ProductIntelligenceLifecycleState.Ready;

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "startup",
      success: true,
      detail: `Product Intelligence Foundation ready in ${this.startupMs}ms`,
    });

    this.logger.log("info", "startup", "Product Intelligence Foundation startup complete", {
      startupMs: this.startupMs,
      modules: this.registry.getPreparedCount(),
      healthScore: this.lastHealth.score,
      integrationReady: this.integration.isIntegrationReady(),
    });
  }

  async requestAccess(request: ProductIntelligenceAccessRequest): Promise<ProductIntelligenceAccessResult> {
    this.ensureReady();
    this.lifecycleState = ProductIntelligenceLifecycleState.Analyzing;
    try {
      return await this.accessCoordinator!.requestAccess(request);
    } finally {
      this.lifecycleState = ProductIntelligenceLifecycleState.Ready;
    }
  }

  registerProductIntelligenceModule(
    registration: Omit<ProductIntelligenceModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt">
  ): void {
    this.ensureReady();
    const full: ProductIntelligenceModuleRegistration = {
      ...registration,
      healthStatus: this.lastHealth?.level ?? ProductIntelligenceHealthLevel.Good,
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

  validateProductIntelligence(metadata: ProductIntelligenceQualityMetadata): ProductIntelligenceValidationResult {
    this.ensureReady();
    this.lifecycleState = ProductIntelligenceLifecycleState.Validating;
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
      this.lifecycleState = ProductIntelligenceLifecycleState.Ready;
    }
  }

  validateModule(moduleId: string): ProductIntelligenceValidationResult {
    this.ensureReady();
    return this.qualityValidator!.validateModule(moduleId);
  }

  refreshIntegration(
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
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
      moduleManager,
      stateManager,
      recoveryEngine,
      systemHealthMonitor
    );
  }

  async runHealthCheck(): Promise<ProductIntelligenceHealthReport> {
    this.ensureReady();
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.integration.isIntegrationReady()
    );
    return this.lastHealth;
  }

  async recover(): Promise<void> {
    this.ensureReady();
    this.lifecycleState = ProductIntelligenceLifecycleState.Recovering;
    this.logger.log("info", "recovery", "Product Intelligence recovery initiated");

    this.registry.initialize(this.storage, this.storageRoot);
    this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
    this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.integration.isIntegrationReady()
    );
    this.registry.persist();

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "recovery",
      success: this.lastIntegrity.verified,
      detail: "Product Intelligence recovery complete",
    });

    this.lifecycleState = ProductIntelligenceLifecycleState.Ready;
    this.logger.log("info", "recovery", "Product Intelligence recovery complete", {
      verified: this.lastIntegrity.verified,
    });
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    this.lifecycleState = ProductIntelligenceLifecycleState.Closing;
    this.registry.persist();
    this.lifecycleState = ProductIntelligenceLifecycleState.Closed;
    this.logger.log("info", "shutdown", "Product Intelligence Foundation shut down");
    this.history.append({
      timestamp: new Date().toISOString(),
      event: "shutdown",
      success: true,
      detail: "Product Intelligence Foundation shut down",
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLifecycleState(): ProductIntelligenceLifecycleState {
    return this.lifecycleState;
  }

  getIntelligenceRoot(): string {
    return this.storage.getIntelligenceRoot();
  }

  getProductAnalysisEngine(): AiProductAnalysisEngine {
    return this.productAnalysisEngine;
  }

  getProductUnderstandingEngine(): AiProductUnderstandingEngine {
    return this.productUnderstandingEngine;
  }

  getTargetAudienceIntelligenceEngine(): AiTargetAudienceIntelligenceEngine {
    return this.targetAudienceIntelligenceEngine;
  }

  getMarketingStrategyIntelligenceEngine(): AiMarketingStrategyIntelligenceEngine {
    return this.marketingStrategyIntelligenceEngine;
  }

  getCreativeDirectionEngine(): AiCreativeDirectionEngine {
    return this.creativeDirectionEngine;
  }

  getStoryboardIntelligenceEngine(): AiStoryboardIntelligenceEngine {
    return this.storyboardIntelligenceEngine;
  }

  getScriptPlanningEngine(): AiScriptPlanningEngine {
    return this.scriptPlanningEngine;
  }

  getVisualPlanningEngine(): AiVisualPlanningEngine {
    return this.visualPlanningEngine;
  }

  getAudioPlanningEngine(): AiAudioPlanningEngine {
    return this.audioPlanningEngine;
  }

  getProductionPlanningEngine(): AiProductionPlanningEngine {
    return this.productionPlanningEngine;
  }

  getQualityPredictionEngine(): AiQualityPredictionEngine {
    return this.qualityPredictionEngine;
  }

  getProductIntelligenceOptimizationEngine(): AiProductIntelligenceOptimizationEngine {
    return this.productIntelligenceOptimizationEngine;
  }

  getProductIntelligenceHealthMonitorEngine(): AiProductIntelligenceHealthMonitorEngine {
    return this.productIntelligenceHealthMonitorEngine;
  }

  getRegistry(): ProductIntelligenceRegistry {
    return this.registry;
  }

  getLastIntegrityResult(): ProductIntelligenceIntegrityResult | null {
    return this.lastIntegrity;
  }

  getLastHealthReport(): ProductIntelligenceHealthReport | null {
    return this.lastHealth;
  }

  getPreparedModuleCount(): number {
    return PREPARED_PRODUCT_INTELLIGENCE_MODULES.length;
  }

  buildStatusReport(): ProductIntelligenceFoundationStatusReport {
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
      healthLevel: this.lastHealth?.level ?? ProductIntelligenceHealthLevel.Good,
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

  private ensureReady(): void {
    if (!this.initialized || !this.accessCoordinator || !this.qualityValidator) {
      throw new ProductIntelligenceFoundationError(
        "Product Intelligence Foundation not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
