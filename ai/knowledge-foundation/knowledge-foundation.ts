import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { KnowledgeAccessCoordinator } from "./knowledge-access-coordinator.js";
import { KnowledgeHealthMonitor } from "./knowledge-health-monitor.js";
import { KnowledgeHistoryStore } from "./knowledge-history-store.js";
import { KnowledgeIntegrityVerifier } from "./knowledge-integrity-verifier.js";
import { KnowledgeIntegrationBridge } from "./knowledge-integration-bridge.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeQualityValidator } from "./knowledge-quality-validator.js";
import { KnowledgeRegistry } from "./knowledge-registry.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";
import { AiKnowledgeStorageEngine } from "../knowledge-storage-engine/knowledge-storage-engine.js";
import { AiKnowledgeRetrievalEngine } from "../knowledge-retrieval-engine/knowledge-retrieval-engine.js";
import { AiKnowledgeGraphEngine } from "../knowledge-graph-engine/knowledge-graph-engine.js";
import { AiImageKnowledgeEngine } from "../image-knowledge-engine/image-knowledge-engine.js";
import { AiVideoKnowledgeEngine } from "../video-knowledge-engine/video-knowledge-engine.js";
import { VideoProductionKnowledgeBuilder } from "../video-knowledge-engine/video-production-knowledge-builder.js";
import { AiMarketingKnowledgeEngine } from "../marketing-knowledge-engine/marketing-knowledge-engine.js";
import { AiProductKnowledgeEngine } from "../product-knowledge-engine/product-knowledge-engine.js";
import { AiBrandKnowledgeEngine } from "../brand-knowledge-engine/brand-knowledge-engine.js";
import { AiLanguageKnowledgeEngine } from "../language-knowledge-engine/language-knowledge-engine.js";
import { AiCreativeKnowledgeEngine } from "../creative-knowledge-engine/creative-knowledge-engine.js";
import { AiKnowledgeOptimizationEngine } from "../knowledge-optimization-engine/knowledge-optimization-engine.js";
import { AiKnowledgeValidationEngine } from "../knowledge-validation-engine/knowledge-validation-engine.js";
import { AiKnowledgeHealthMonitorEngine } from "../knowledge-health-monitor-engine/knowledge-health-monitor-engine.js";
import { AiKnowledgeAcquisitionEngine } from "../knowledge-acquisition-engine/knowledge-acquisition-engine.js";
import { AiKnowledgeSourceManager } from "../knowledge-source-manager/knowledge-source-manager.js";
import { AiKnowledgeResearchEngine } from "../knowledge-research-engine/knowledge-research-engine.js";
import { AiKnowledgeProcessingEngine } from "../knowledge-processing-engine/knowledge-processing-engine.js";
import { AiKnowledgeReasoningEngine } from "../knowledge-reasoning-engine/knowledge-reasoning-engine.js";
import { PREPARED_KNOWLEDGE_CATEGORIES } from "./knowledge-categories.js";
import {
  KnowledgeAccessOperation,
  KnowledgeAccessRequest,
  KnowledgeAccessResult,
  KnowledgeDomainInstallation,
  KnowledgeFoundationError,
  KnowledgeFoundationStatusReport,
  KnowledgeHealthLevel,
  KnowledgeHealthReport,
  KnowledgeIntegrityResult,
  KnowledgeLifecycleState,
  KnowledgeModuleRegistration,
  KnowledgeModuleStatus,
  KnowledgeQualityMetadata,
  KnowledgeSource,
  KnowledgeValidationResult,
  KnowledgeVerificationStatus,
} from "./types.js";

/**
 * Knowledge Foundation — central intelligence layer for KWIZERA AI STUDIO.
 * Memory stores experience. Knowledge understands experience.
 */
export class AiKnowledgeFoundation {
  private core: AiCoreManager | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;
  private lifecycleState = KnowledgeLifecycleState.Initializing;
  private startupMs = 0;
  private lastIntegrity: KnowledgeIntegrityResult | null = null;
  private lastHealth: KnowledgeHealthReport | null = null;

  readonly logger = new KnowledgeFoundationLogger();
  readonly history = new KnowledgeHistoryStore();
  readonly integration = new KnowledgeIntegrationBridge(this.logger);

  private readonly storage = new KnowledgeStorageManager(this.logger);
  private readonly registry = new KnowledgeRegistry(this.logger);
  private readonly integrityVerifier = new KnowledgeIntegrityVerifier(this.logger);
  private readonly healthMonitor = new KnowledgeHealthMonitor(this.logger);
  private accessCoordinator: KnowledgeAccessCoordinator | null = null;
  private qualityValidator: KnowledgeQualityValidator | null = null;
  readonly storageEngine = new AiKnowledgeStorageEngine();
  readonly retrievalEngine = new AiKnowledgeRetrievalEngine();
  readonly graphEngine = new AiKnowledgeGraphEngine();
  readonly imageKnowledgeEngine = new AiImageKnowledgeEngine();
  readonly videoKnowledgeEngine = new AiVideoKnowledgeEngine();
  readonly videoProductionKnowledgeBuilder = new VideoProductionKnowledgeBuilder(this);
  readonly marketingKnowledgeEngine = new AiMarketingKnowledgeEngine();
  readonly productKnowledgeEngine = new AiProductKnowledgeEngine();
  readonly brandKnowledgeEngine = new AiBrandKnowledgeEngine();
  readonly languageKnowledgeEngine = new AiLanguageKnowledgeEngine();
  readonly creativeKnowledgeEngine = new AiCreativeKnowledgeEngine();
  readonly knowledgeOptimizationEngine = new AiKnowledgeOptimizationEngine();
  readonly knowledgeValidationEngine = new AiKnowledgeValidationEngine();
  readonly knowledgeHealthMonitorEngine = new AiKnowledgeHealthMonitorEngine();
  readonly knowledgeAcquisitionEngine = new AiKnowledgeAcquisitionEngine();
  readonly knowledgeSourceManager = new AiKnowledgeSourceManager();
  readonly knowledgeResearchEngine = new AiKnowledgeResearchEngine();
  readonly knowledgeProcessingEngine = new AiKnowledgeProcessingEngine();
  readonly knowledgeReasoningEngine = new AiKnowledgeReasoningEngine();

  initialize(
    core: AiCoreManager,
    storageRoot: string,
    memoryFoundation: AiMemoryFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    communicationBus?: AiCommunicationBus,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
    this.core = core;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    this.logger.initialize(logDir);

    this.lifecycleState = KnowledgeLifecycleState.Initializing;
    this.logger.log("info", "startup", "Knowledge Foundation initializing", { storageRoot });

    const knowledgeRoot = this.storage.initialize(storageRoot);
    this.history.initialize(knowledgeRoot);
    this.registry.initialize(this.storage, storageRoot);

    this.accessCoordinator = new KnowledgeAccessCoordinator(
      this.logger,
      this.history,
      this.registry,
      this.storage
    );
    this.qualityValidator = new KnowledgeQualityValidator(this.logger, this.registry);

    this.integration.connect(
      core,
      memoryFoundation,
      moduleManager,
      stateManager,
      communicationBus,
      recoveryEngine,
      systemHealthMonitor
    );

    this.integrityVerifier.writeManifest(this.storage, storageRoot);
    this.initialized = true;
    this.lifecycleState = KnowledgeLifecycleState.Loading;

    this.logger.log("info", "startup", "Knowledge Foundation initialized", { knowledgeRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();
    this.lifecycleState = KnowledgeLifecycleState.Loading;

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

    this.storageEngine.initialize(this, this.storageRoot, this.storage.getKnowledgeRoot());
    await this.storageEngine.runStartup();

    this.retrievalEngine.initialize(this, this.storageRoot);
    await this.retrievalEngine.runStartup();

    this.graphEngine.initialize(this, this.storageRoot);
    await this.graphEngine.runStartup();

    this.imageKnowledgeEngine.initialize(this, this.storageRoot);
    await this.imageKnowledgeEngine.runStartup();

    this.videoKnowledgeEngine.initialize(this, this.storageRoot);
    await this.videoKnowledgeEngine.runStartup();

    this.marketingKnowledgeEngine.initialize(this, this.storageRoot);
    await this.marketingKnowledgeEngine.runStartup();

    this.productKnowledgeEngine.initialize(this, this.storageRoot);
    await this.productKnowledgeEngine.runStartup();

    this.brandKnowledgeEngine.initialize(this, this.storageRoot);
    await this.brandKnowledgeEngine.runStartup();

    this.languageKnowledgeEngine.initialize(this, this.storageRoot);
    await this.languageKnowledgeEngine.runStartup();

    this.creativeKnowledgeEngine.initialize(this, this.storageRoot);
    await this.creativeKnowledgeEngine.runStartup();

    this.knowledgeOptimizationEngine.initialize(this, this.storageRoot);
    await this.knowledgeOptimizationEngine.runStartup();

    this.knowledgeValidationEngine.initialize(this, this.storageRoot);
    await this.knowledgeValidationEngine.runStartup();

    this.knowledgeHealthMonitorEngine.initialize(this, this.storageRoot);
    await this.knowledgeHealthMonitorEngine.runStartup();

    this.knowledgeAcquisitionEngine.initialize(this, this.storageRoot);
    await this.knowledgeAcquisitionEngine.runStartup();

    this.knowledgeSourceManager.initialize(this, this.storageRoot);
    await this.knowledgeSourceManager.runStartup();

    this.knowledgeResearchEngine.initialize(this, this.storageRoot);
    await this.knowledgeResearchEngine.runStartup();

    await this.knowledgeReasoningEngine.initialize(this, this.storageRoot);

    this.storageEngine.setRecordChangeHandler((knowledgeId, operation) => {
      this.retrievalEngine.invalidateCache(knowledgeId);
      void this.graphEngine.evolveGraph(knowledgeId);
      void this.knowledgeValidationEngine.handleKnowledgeChange(knowledgeId, operation);
      void this.knowledgeReasoningEngine.analyzeImpact(knowledgeId, operation);
    });

    this.startupMs = Date.now() - start;
    this.startupComplete = true;
    this.lifecycleState = KnowledgeLifecycleState.Ready;

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "startup",
      success: true,
      detail: `Knowledge Foundation ready in ${this.startupMs}ms`,
    });

    this.logger.log("info", "startup", "Knowledge Foundation startup complete", {
      startupMs: this.startupMs,
      categories: this.registry.getPreparedCount(),
      healthScore: this.lastHealth.score,
      integrationReady: this.integration.isIntegrationReady(),
      storageRecords: this.storageEngine.getRecordCount(),
      retrievalEngine: "operational",
      graphEngine: "operational",
      imageKnowledgeEngine: "operational",
      videoKnowledgeEngine: "operational",
      marketingKnowledgeEngine: "operational",
      productKnowledgeEngine: "operational",
      brandKnowledgeEngine: "operational",
      languageKnowledgeEngine: "operational",
      creativeKnowledgeEngine: "operational",
      knowledgeOptimizationEngine: "operational",
      knowledgeValidationEngine: "operational",
      knowledgeHealthMonitorEngine: "operational",
      knowledgeAcquisitionEngine: "operational",
      knowledgeSourceManager: "operational",
      knowledgeResearchEngine: "operational",
      knowledgeReasoningEngine: "operational",
    });
  }

  async requestAccess(request: KnowledgeAccessRequest): Promise<KnowledgeAccessResult> {
    this.ensureReady();
    this.lifecycleState = KnowledgeLifecycleState.Reading;
    try {
      return await this.accessCoordinator!.requestAccess(request);
    } finally {
      this.lifecycleState = KnowledgeLifecycleState.Ready;
    }
  }

  registerKnowledgeModule(
    registration: Omit<KnowledgeModuleRegistration, "lastUpdate" | "healthStatus">
  ): void {
    this.ensureReady();
    const full: KnowledgeModuleRegistration = {
      ...registration,
      healthStatus: this.lastHealth?.level ?? KnowledgeHealthLevel.Good,
      lastUpdate: new Date().toISOString(),
      status: KnowledgeModuleStatus.Registered,
    };
    this.registry.registerModule(full);
    this.history.append({
      timestamp: new Date().toISOString(),
      event: "registration",
      category: registration.category,
      success: true,
      detail: `Registered ${registration.knowledgeId}`,
    });
  }

  installKnowledgeDomain(installation: KnowledgeDomainInstallation): KnowledgeModuleRegistration {
    this.ensureReady();
    const knowledgeId = installation.knowledgeId.trim();
    const subdirectory = installation.subdirectory.trim();
    if (!/^[a-z0-9-]+$/.test(knowledgeId) || !/^[a-z0-9-]+$/.test(subdirectory)) {
      throw new KnowledgeFoundationError("Knowledge domain identifiers must use lowercase letters, numbers, and hyphens.", "INVALID_DOMAIN");
    }
    const registration: KnowledgeModuleRegistration = {
      knowledgeId,
      knowledgeName: installation.knowledgeName.trim(),
      version: "0.0.0",
      status: KnowledgeModuleStatus.Prepared,
      dependencies: installation.dependencies ?? ["knowledge-engine"],
      source: installation.source ?? KnowledgeSource.KnowledgeModule,
      qualityScore: 0,
      confidenceScore: 0,
      healthStatus: KnowledgeHealthLevel.Good,
      lastUpdate: new Date().toISOString(),
      accessPermissions: installation.accessPermissions ?? [KnowledgeAccessPermission.Read, KnowledgeAccessPermission.Write, KnowledgeAccessPermission.Validate],
      category: KnowledgeCategory.Custom,
      storageLocation: this.storage.getCategoryPath(subdirectory),
      implemented: false,
    };
    this.registry.installModule(registration);
    this.history.append({
      timestamp: new Date().toISOString(),
      event: "registration",
      category: KnowledgeCategory.Custom,
      success: true,
      detail: `Installed future knowledge domain ${knowledgeId}`,
    });
    return registration;
  }

  validateKnowledge(metadata: KnowledgeQualityMetadata): KnowledgeValidationResult {
    this.ensureReady();
    this.lifecycleState = KnowledgeLifecycleState.Validating;
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
      this.lifecycleState = KnowledgeLifecycleState.Ready;
    }
  }

  validateModule(knowledgeId: string): KnowledgeValidationResult {
    this.ensureReady();
    return this.qualityValidator!.validateModule(knowledgeId);
  }

  refreshIntegration(
    memoryFoundation: AiMemoryFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    communicationBus?: AiCommunicationBus,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
    if (!this.core) return;
    this.integration.connect(
      this.core,
      memoryFoundation,
      moduleManager,
      stateManager,
      communicationBus,
      recoveryEngine,
      systemHealthMonitor
    );
  }

  async runHealthCheck(): Promise<KnowledgeHealthReport> {
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
    this.lifecycleState = KnowledgeLifecycleState.Recovering;
    this.logger.log("info", "recovery", "Knowledge recovery initiated");

    this.registry.initialize(this.storage, this.storageRoot);
    this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.integration.isIntegrationReady()
    );

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "recovery",
      success: this.lastIntegrity.verified,
      detail: "Knowledge recovery complete",
    });

    this.lifecycleState = KnowledgeLifecycleState.Ready;
    this.logger.log("info", "recovery", "Knowledge recovery complete", {
      verified: this.lastIntegrity.verified,
    });
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    this.lifecycleState = KnowledgeLifecycleState.Closing;
    this.registry.persist();
    this.lifecycleState = KnowledgeLifecycleState.Closed;
    this.logger.log("info", "shutdown", "Knowledge Foundation shut down");
    this.history.append({
      timestamp: new Date().toISOString(),
      event: "shutdown",
      success: true,
      detail: "Knowledge Foundation shut down",
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLifecycleState(): KnowledgeLifecycleState {
    return this.lifecycleState;
  }

  getKnowledgeRoot(): string {
    return this.storage.getKnowledgeRoot();
  }

  getStorageEngine(): AiKnowledgeStorageEngine {
    return this.storageEngine;
  }

  getRetrievalEngine(): AiKnowledgeRetrievalEngine {
    return this.retrievalEngine;
  }

  getGraphEngine(): AiKnowledgeGraphEngine {
    return this.graphEngine;
  }

  getImageKnowledgeEngine(): AiImageKnowledgeEngine {
    return this.imageKnowledgeEngine;
  }

  getVideoKnowledgeEngine(): AiVideoKnowledgeEngine {
    return this.videoKnowledgeEngine;
  }

  getVideoProductionKnowledgeBuilder(): VideoProductionKnowledgeBuilder {
    return this.videoProductionKnowledgeBuilder;
  }

  getMarketingKnowledgeEngine(): AiMarketingKnowledgeEngine {
    return this.marketingKnowledgeEngine;
  }

  getProductKnowledgeEngine(): AiProductKnowledgeEngine {
    return this.productKnowledgeEngine;
  }

  getBrandKnowledgeEngine(): AiBrandKnowledgeEngine {
    return this.brandKnowledgeEngine;
  }

  getLanguageKnowledgeEngine(): AiLanguageKnowledgeEngine {
    return this.languageKnowledgeEngine;
  }

  getCreativeKnowledgeEngine(): AiCreativeKnowledgeEngine {
    return this.creativeKnowledgeEngine;
  }

  getKnowledgeOptimizationEngine(): AiKnowledgeOptimizationEngine {
    return this.knowledgeOptimizationEngine;
  }

  getKnowledgeValidationEngine(): AiKnowledgeValidationEngine {
    return this.knowledgeValidationEngine;
  }

  getKnowledgeAcquisitionEngine(): AiKnowledgeAcquisitionEngine {
    return this.knowledgeAcquisitionEngine;
  }

  getKnowledgeSourceManager(): AiKnowledgeSourceManager {
    return this.knowledgeSourceManager;
  }

  getKnowledgeResearchEngine(): AiKnowledgeResearchEngine {
    return this.knowledgeResearchEngine;
  }

  getKnowledgeProcessingEngine(): AiKnowledgeProcessingEngine {
    return this.knowledgeProcessingEngine;
  }

  getKnowledgeReasoningEngine(): AiKnowledgeReasoningEngine {
    return this.knowledgeReasoningEngine;
  }

  getKnowledgeHealthMonitorEngine(): AiKnowledgeHealthMonitorEngine {
    return this.knowledgeHealthMonitorEngine;
  }

  getRegistry(): KnowledgeRegistry {
    return this.registry;
  }

  getLastIntegrityResult(): KnowledgeIntegrityResult | null {
    return this.lastIntegrity;
  }

  getLastHealthReport(): KnowledgeHealthReport | null {
    return this.lastHealth;
  }

  getPreparedCategoryCount(): number {
    return PREPARED_KNOWLEDGE_CATEGORIES.length;
  }

  buildStatusReport(): KnowledgeFoundationStatusReport {
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
      registryStatus: `${this.registry.getPreparedCount()} categories prepared, ${this.registry.getRegisteredCount()} registered`,
      storageStatus: persistence.passed ? "persistent storage verified" : persistence.detail,
      persistenceStatus: persistence.passed ? "survives restart" : "persistence unverified",
      integrityStatus: this.lastIntegrity?.verified ? "verified" : "issues detected",
      healthLevel: this.lastHealth?.level ?? KnowledgeHealthLevel.Good,
      integrationStatus: this.integration.getStatus(),
      registeredModules: this.registry.getRegisteredCount(),
      preparedCategories: this.registry.getPreparedCount(),
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
      throw new KnowledgeFoundationError(
        "Knowledge Foundation not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
