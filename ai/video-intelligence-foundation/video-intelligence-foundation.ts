/**
 * Video Intelligence Foundation — central architecture for all future Video Intelligence modules.
 */
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
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
import {
  VideoIntelligenceAccessRequest,
  VideoIntelligenceAccessResult,
  VideoIntelligenceFoundationError,
  VideoIntelligenceFoundationStatusReport,
  VideoIntelligenceHealthLevel,
  VideoIntelligenceHealthReport,
  VideoIntelligenceIntegrityResult,
  VideoIntelligenceLifecycleState,
  VideoIntelligenceModuleRegistration,
  VideoIntelligenceQualityMetadata,
  VideoIntelligenceValidationResult,
} from "./types.js";

export class AiVideoIntelligenceFoundation {
  private core: AiCoreManager | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;
  private lifecycleState = VideoIntelligenceLifecycleState.Initializing;
  private startupMs = 0;
  private lastIntegrity: VideoIntelligenceIntegrityResult | null = null;
  private lastHealth: VideoIntelligenceHealthReport | null = null;

  readonly logger = new VideoIntelligenceFoundationLogger();
  readonly history = new VideoIntelligenceHistoryStore();
  readonly integration = new VideoIntelligenceIntegrationBridge(this.logger);

  private readonly storage = new VideoIntelligenceStorageManager(this.logger);
  private readonly registry = new VideoIntelligenceRegistry(this.logger);
  private readonly integrityVerifier = new VideoIntelligenceIntegrityVerifier(this.logger);
  private readonly healthMonitor = new VideoIntelligenceHealthMonitor(this.logger);
  readonly assetRegistry = new VideoAssetRegistry(this.logger);
  readonly frameIndex = new FrameIndexManager(this.logger);
  readonly workflow = new NonDestructiveWorkflow(this.logger);
  readonly projectManager = new VideoProjectManager(this.logger);
  readonly videoAnalysisEngine = new AiVideoAnalysisEngine();
  readonly videoUnderstandingEngine = new AiVideoUnderstandingEngine();
  readonly sceneDetectionEngine = new AiSceneDetectionIntelligenceEngine();
  readonly timelineIntelligenceEngine = new AiTimelineIntelligenceEngine();
  readonly cameraMovementEngine = new AiCameraMovementIntelligenceEngine();
  readonly motionIntelligenceEngine = new AiMotionIntelligenceEngine();
  readonly videoStyleIntelligenceEngine = new AiVideoStyleIntelligenceEngine();
  readonly videoEnhancementPlanningEngine = new AiVideoEnhancementPlanningEngine();
  readonly creativeVideoIntelligenceEngine = new AiCreativeVideoIntelligenceEngine();
  readonly productionVideoPlanningEngine = new AiProductionVideoPlanningEngine();
  readonly videoQualityPredictionEngine = new AiVideoQualityPredictionEngine();
  readonly videoIntelligenceOptimizationEngine = new AiVideoIntelligenceOptimizationEngine();
  readonly videoIntelligenceHealthMonitorEngine = new AiVideoIntelligenceHealthMonitorEngine();

  private accessCoordinator: VideoIntelligenceAccessCoordinator | null = null;
  private qualityValidator: VideoIntelligenceQualityValidator | null = null;

  initialize(
    core: AiCoreManager,
    storageRoot: string,
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
    productIntelligenceFoundation: AiProductIntelligenceFoundation | null,
    imageIntelligenceFoundation: AiImageIntelligenceFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
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

    this.accessCoordinator = new VideoIntelligenceAccessCoordinator(
      this.logger,
      this.history,
      this.registry,
      this.storage
    );
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
    this.videoIntelligenceHealthMonitorEngine.initialize(
      this,
      storageRoot,
      path.join(storageRoot, "project-state")
    );

    this.integration.connect(
      core,
      memoryFoundation,
      knowledgeFoundation,
      productIntelligenceFoundation,
      imageIntelligenceFoundation,
      moduleManager,
      stateManager,
      recoveryEngine,
      systemHealthMonitor
    );

    this.integrityVerifier.writeManifest(this.storage, storageRoot);
    this.initialized = true;
    this.lifecycleState = VideoIntelligenceLifecycleState.Loading;

    this.logger.log("info", "startup", "Video Intelligence Foundation initialized", { intelligenceRoot });
  }

  async runStartup(): Promise<void> {
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

    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.assetRegistry,
      this.frameIndex,
      this.workflow,
      this.integration.isIntegrationReady()
    );

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

  async requestAccess(request: VideoIntelligenceAccessRequest): Promise<VideoIntelligenceAccessResult> {
    this.ensureReady();
    this.lifecycleState = VideoIntelligenceLifecycleState.Analyzing;
    try {
      return await this.accessCoordinator!.requestAccess(request);
    } finally {
      this.lifecycleState = VideoIntelligenceLifecycleState.Ready;
    }
  }

  registerVideoIntelligenceModule(
    registration: Omit<VideoIntelligenceModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt">
  ): void {
    this.ensureReady();
    const full: VideoIntelligenceModuleRegistration = {
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

  validateVideoIntelligence(metadata: VideoIntelligenceQualityMetadata): VideoIntelligenceValidationResult {
    this.ensureReady();
    this.lifecycleState = VideoIntelligenceLifecycleState.Validating;
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
      this.lifecycleState = VideoIntelligenceLifecycleState.Ready;
    }
  }

  validateModule(moduleId: string): VideoIntelligenceValidationResult {
    this.ensureReady();
    return this.qualityValidator!.validateModule(moduleId);
  }

  refreshIntegration(
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
    productIntelligenceFoundation: AiProductIntelligenceFoundation | null,
    imageIntelligenceFoundation: AiImageIntelligenceFoundation | null,
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
      moduleManager,
      stateManager,
      recoveryEngine,
      systemHealthMonitor
    );
  }

  async runHealthCheck(): Promise<VideoIntelligenceHealthReport> {
    this.ensureReady();
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.assetRegistry,
      this.frameIndex,
      this.workflow,
      this.integration.isIntegrationReady()
    );
    return this.lastHealth;
  }

  async recover(): Promise<void> {
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
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!,
      this.assetRegistry,
      this.frameIndex,
      this.workflow,
      this.integration.isIntegrationReady()
    );
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

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
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

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLifecycleState(): VideoIntelligenceLifecycleState {
    return this.lifecycleState;
  }

  getIntelligenceRoot(): string {
    return this.storage.getIntelligenceRoot();
  }

  getRegistry(): VideoIntelligenceRegistry {
    return this.registry;
  }

  getAssetRegistry(): VideoAssetRegistry {
    return this.assetRegistry;
  }

  getFrameIndexManager(): FrameIndexManager {
    return this.frameIndex;
  }

  getWorkflow(): NonDestructiveWorkflow {
    return this.workflow;
  }

  getProjectManager(): VideoProjectManager {
    return this.projectManager;
  }

  getVideoAnalysisEngine(): AiVideoAnalysisEngine {
    return this.videoAnalysisEngine;
  }

  getVideoUnderstandingEngine(): AiVideoUnderstandingEngine {
    return this.videoUnderstandingEngine;
  }

  getSceneDetectionEngine(): AiSceneDetectionIntelligenceEngine {
    return this.sceneDetectionEngine;
  }

  getTimelineIntelligenceEngine(): AiTimelineIntelligenceEngine {
    return this.timelineIntelligenceEngine;
  }

  getCameraMovementEngine(): AiCameraMovementIntelligenceEngine {
    return this.cameraMovementEngine;
  }

  getMotionIntelligenceEngine(): AiMotionIntelligenceEngine {
    return this.motionIntelligenceEngine;
  }

  getVideoStyleIntelligenceEngine(): AiVideoStyleIntelligenceEngine {
    return this.videoStyleIntelligenceEngine;
  }

  getVideoEnhancementPlanningEngine(): AiVideoEnhancementPlanningEngine {
    return this.videoEnhancementPlanningEngine;
  }

  getCreativeVideoIntelligenceEngine(): AiCreativeVideoIntelligenceEngine {
    return this.creativeVideoIntelligenceEngine;
  }

  getProductionVideoPlanningEngine(): AiProductionVideoPlanningEngine {
    return this.productionVideoPlanningEngine;
  }

  getVideoQualityPredictionEngine(): AiVideoQualityPredictionEngine {
    return this.videoQualityPredictionEngine;
  }

  getVideoIntelligenceOptimizationEngine(): AiVideoIntelligenceOptimizationEngine {
    return this.videoIntelligenceOptimizationEngine;
  }

  getVideoIntelligenceHealthMonitorEngine(): AiVideoIntelligenceHealthMonitorEngine {
    return this.videoIntelligenceHealthMonitorEngine;
  }

  getLastIntegrityResult(): VideoIntelligenceIntegrityResult | null {
    return this.lastIntegrity;
  }

  getLastHealthReport(): VideoIntelligenceHealthReport | null {
    return this.lastHealth;
  }

  getPreparedModuleCount(): number {
    return PREPARED_VIDEO_INTELLIGENCE_MODULES.length;
  }

  buildStatusReport(): VideoIntelligenceFoundationStatusReport {
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

  private ensureReady(): void {
    if (!this.initialized || !this.accessCoordinator || !this.qualityValidator) {
      throw new VideoIntelligenceFoundationError(
        "Video Intelligence Foundation not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
