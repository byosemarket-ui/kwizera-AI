/**
 * AI Audio Generation Foundation — central architecture for all future AI Audio Generation modules.
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
import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import { AudioGenerationAccessCoordinator } from "./audio-generation-access-coordinator.js";
import { AudioGenerationHealthMonitor } from "./audio-generation-health-monitor.js";
import { AudioGenerationHistoryStore } from "./audio-generation-history-store.js";
import { AudioGenerationIntegrityVerifier } from "./audio-generation-integrity-verifier.js";
import { AudioGenerationIntegrationBridge } from "./audio-generation-integration-bridge.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationQualityValidator } from "./audio-generation-quality-validator.js";
import { AudioGenerationRegistry } from "./audio-generation-registry.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";
import {
  createDefaultGenerationAssetQuality,
  GenerationAssetRegistry,
} from "./audio-generation-asset-registry.js";
import { AudioGenerationBlueprintManager } from "./audio-generation-blueprint-manager.js";
import { GenerationProjectManager } from "./audio-generation-project-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { PREPARED_AUDIO_GENERATION_MODULES } from "./audio-generation-categories.js";
import { AiTextToSpeechGenerationEngine } from "../text-to-speech-generation-engine/text-to-speech-generation-engine.js";
import { AiSpeechToSpeechGenerationEngine } from "../speech-to-speech-generation-engine/speech-to-speech-generation-engine.js";
import { AiVoiceCloningGenerationEngine } from "../voice-cloning-generation-engine/voice-cloning-generation-engine.js";
import { AiMusicGenerationEngine } from "../music-generation-engine/music-generation-engine.js";
import { AiSoundEffectsGenerationEngine } from "../sound-effects-generation-engine/sound-effects-generation-engine.js";
import { AiAmbientAudioGenerationEngine } from "../ambient-audio-generation-engine/ambient-audio-generation-engine.js";
import { AiAudioEnhancementRestorationEngine } from "../audio-enhancement-restoration-engine/audio-enhancement-restoration-engine.js";
import { AiAudioMixingMasteringEngine } from "../audio-mixing-mastering-engine/audio-mixing-mastering-engine.js";
import { AiAudioProductionEngine } from "../audio-production-engine/audio-production-engine.js";
import { AiAudioRenderingPreparationEngine } from "../audio-rendering-preparation-engine/audio-rendering-preparation-engine.js";
import { AiAudioQualityValidationEngine } from "../audio-quality-validation-engine/audio-quality-validation-engine.js";
import {
  AudioGenerationAccessRequest,
  AudioGenerationAccessResult,
  AudioGenerationFoundationError,
  AudioGenerationFoundationStatusReport,
  AudioGenerationHealthLevel,
  AudioGenerationHealthReport,
  AudioGenerationIntegrityResult,
  AudioGenerationLifecycleState,
  AudioGenerationModuleRegistration,
  AudioGenerationQualityMetadata,
  AudioGenerationValidationResult,
} from "./types.js";

export class AiAudioGenerationFoundation {
  private core: AiCoreManager | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;
  private lifecycleState = AudioGenerationLifecycleState.Initializing;
  private startupMs = 0;
  private lastIntegrity: AudioGenerationIntegrityResult | null = null;
  private lastHealth: AudioGenerationHealthReport | null = null;

  readonly logger = new AudioGenerationFoundationLogger();
  readonly history = new AudioGenerationHistoryStore();
  readonly integration = new AudioGenerationIntegrationBridge(this.logger);

  private readonly storage = new AudioGenerationStorageManager(this.logger);
  private readonly registry = new AudioGenerationRegistry(this.logger);
  private readonly integrityVerifier = new AudioGenerationIntegrityVerifier(this.logger);
  private readonly healthMonitor = new AudioGenerationHealthMonitor(this.logger);
  readonly assetRegistry = new GenerationAssetRegistry(this.logger);
  readonly blueprintManager = new AudioGenerationBlueprintManager(this.logger);
  readonly workflow = new NonDestructiveGenerationWorkflow(this.logger);
  readonly projectManager = new GenerationProjectManager(this.logger);
  readonly textToSpeechGenerationEngine = new AiTextToSpeechGenerationEngine();
  readonly speechToSpeechGenerationEngine = new AiSpeechToSpeechGenerationEngine();
  readonly voiceCloningGenerationEngine = new AiVoiceCloningGenerationEngine();
  readonly musicGenerationEngine = new AiMusicGenerationEngine();
  readonly soundEffectsGenerationEngine = new AiSoundEffectsGenerationEngine();
  readonly ambientAudioGenerationEngine = new AiAmbientAudioGenerationEngine();
  readonly audioEnhancementRestorationEngine = new AiAudioEnhancementRestorationEngine();
  readonly audioMixingMasteringEngine = new AiAudioMixingMasteringEngine();
  readonly audioProductionEngine = new AiAudioProductionEngine();
  readonly audioRenderingPreparationEngine = new AiAudioRenderingPreparationEngine();
  readonly audioQualityValidationEngine = new AiAudioQualityValidationEngine();

  private accessCoordinator: AudioGenerationAccessCoordinator | null = null;
  private qualityValidator: AudioGenerationQualityValidator | null = null;

  initialize(
    core: AiCoreManager,
    storageRoot: string,
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
    productIntelligenceFoundation: AiProductIntelligenceFoundation | null,
    imageIntelligenceFoundation: AiImageIntelligenceFoundation | null,
    videoIntelligenceFoundation: AiVideoIntelligenceFoundation | null,
    videoGenerationFoundation: AiVideoGenerationFoundation | null,
    imageGenerationFoundation: AiImageGenerationFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
    this.core = core;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    this.logger.initialize(logDir);

    this.lifecycleState = AudioGenerationLifecycleState.Initializing;
    this.logger.log("info", "startup", "AI Audio Generation Foundation initializing", { storageRoot });

    const generationRoot = this.storage.initialize(storageRoot);
    this.history.initialize(generationRoot);
    this.registry.initialize(this.storage, storageRoot);
    this.assetRegistry.initialize(this.storage);
    this.blueprintManager.initialize(this.storage);
    this.workflow.initialize(this.storage);
    this.projectManager.initialize(this.storage);

    this.accessCoordinator = new AudioGenerationAccessCoordinator(
      this.logger,
      this.history,
      this.registry
    );
    this.qualityValidator = new AudioGenerationQualityValidator(this.logger, this.registry);

    this.integration.connect(
      core,
      memoryFoundation,
      knowledgeFoundation,
      productIntelligenceFoundation,
      imageIntelligenceFoundation,
      videoIntelligenceFoundation,
      videoGenerationFoundation,
      imageGenerationFoundation,
      moduleManager,
      stateManager,
      recoveryEngine,
      systemHealthMonitor
    );

    this.textToSpeechGenerationEngine.initialize(this, storageRoot);
    this.speechToSpeechGenerationEngine.initialize(this, storageRoot);
    this.voiceCloningGenerationEngine.initialize(this, storageRoot);
    this.musicGenerationEngine.initialize(this, storageRoot);
    this.soundEffectsGenerationEngine.initialize(this, storageRoot);
    this.ambientAudioGenerationEngine.initialize(this, storageRoot);
    this.audioEnhancementRestorationEngine.initialize(this, storageRoot);
    this.audioMixingMasteringEngine.initialize(this, storageRoot);
    this.audioProductionEngine.initialize(this, storageRoot);
    this.audioRenderingPreparationEngine.initialize(this, storageRoot);
    this.audioQualityValidationEngine.initialize(this, storageRoot);
    this.integrityVerifier.writeManifest(this.storage, storageRoot);
    this.initialized = true;
    this.lifecycleState = AudioGenerationLifecycleState.Loading;

    this.logger.log("info", "startup", "AI Audio Generation Foundation initialized", { generationRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();
    this.lifecycleState = AudioGenerationLifecycleState.Loading;

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
    await this.textToSpeechGenerationEngine.runStartup();
    await this.speechToSpeechGenerationEngine.runStartup();
    await this.voiceCloningGenerationEngine.runStartup();
    await this.musicGenerationEngine.runStartup();
    await this.soundEffectsGenerationEngine.runStartup();
    await this.ambientAudioGenerationEngine.runStartup();
    await this.audioEnhancementRestorationEngine.runStartup();
    await this.audioMixingMasteringEngine.runStartup();
    await this.audioProductionEngine.runStartup();
    await this.audioRenderingPreparationEngine.runStartup();
    await this.audioQualityValidationEngine.runStartup();
    this.startupMs = Date.now() - start;
    this.startupComplete = true;
    this.lifecycleState = AudioGenerationLifecycleState.Ready;

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "startup",
      success: true,
      detail: `AI Audio Generation Foundation ready in ${this.startupMs}ms`,
    });

    this.logger.log("info", "startup", "AI Audio Generation Foundation startup complete", {
      startupMs: this.startupMs,
      modules: this.registry.getPreparedCount(),
      healthScore: this.lastHealth.score,
      integrationReady: this.integration.isIntegrationReady(),
    });
  }

  async requestAccess(request: AudioGenerationAccessRequest): Promise<AudioGenerationAccessResult> {
    this.ensureReady();
    this.lifecycleState = AudioGenerationLifecycleState.Preparing;
    try {
      return await this.accessCoordinator!.requestAccess(request);
    } finally {
      this.lifecycleState = AudioGenerationLifecycleState.Ready;
    }
  }

  registerAudioGenerationModule(
    registration: Omit<AudioGenerationModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt">
  ): void {
    this.ensureReady();
    const full: AudioGenerationModuleRegistration = {
      ...registration,
      healthStatus: this.lastHealth?.level ?? AudioGenerationHealthLevel.Good,
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

  validateGeneration(metadata: AudioGenerationQualityMetadata): AudioGenerationValidationResult {
    this.ensureReady();
    this.lifecycleState = AudioGenerationLifecycleState.Validating;
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
      this.lifecycleState = AudioGenerationLifecycleState.Ready;
    }
  }

  validateModule(moduleId: string): AudioGenerationValidationResult {
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
    imageGenerationFoundation: AiImageGenerationFoundation | null,
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
      imageGenerationFoundation,
      moduleManager,
      stateManager,
      recoveryEngine,
      systemHealthMonitor
    );
  }

  async runHealthCheck(): Promise<AudioGenerationHealthReport> {
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
    this.lifecycleState = AudioGenerationLifecycleState.Recovering;
    this.logger.log("info", "recovery", "Audio Generation recovery initiated");

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
      detail: "Audio Generation recovery complete",
    });

    this.lifecycleState = AudioGenerationLifecycleState.Ready;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    this.lifecycleState = AudioGenerationLifecycleState.Closing;
    this.registry.persist();
    this.lifecycleState = AudioGenerationLifecycleState.Closed;
    this.logger.log("info", "shutdown", "AI Audio Generation Foundation shut down");
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLifecycleState(): AudioGenerationLifecycleState {
    return this.lifecycleState;
  }

  setLifecycleGenerating(): void {
    if (this.startupComplete) this.lifecycleState = AudioGenerationLifecycleState.Generating;
  }

  setLifecycleReady(): void {
    if (this.startupComplete) this.lifecycleState = AudioGenerationLifecycleState.Ready;
  }

  getGenerationRoot(): string {
    return this.storage.getGenerationRoot();
  }

  getRegistry(): AudioGenerationRegistry {
    return this.registry;
  }

  getAssetRegistry(): GenerationAssetRegistry {
    return this.assetRegistry;
  }

  getBlueprintManager(): AudioGenerationBlueprintManager {
    return this.blueprintManager;
  }

  getWorkflow(): NonDestructiveGenerationWorkflow {
    return this.workflow;
  }

  getProjectManager(): GenerationProjectManager {
    return this.projectManager;
  }

  getTextToSpeechGenerationEngine(): AiTextToSpeechGenerationEngine {
    return this.textToSpeechGenerationEngine;
  }

  getSpeechToSpeechGenerationEngine(): AiSpeechToSpeechGenerationEngine {
    return this.speechToSpeechGenerationEngine;
  }

  getVoiceCloningGenerationEngine(): AiVoiceCloningGenerationEngine {
    return this.voiceCloningGenerationEngine;
  }

  getMusicGenerationEngine(): AiMusicGenerationEngine {
    return this.musicGenerationEngine;
  }

  getSoundEffectsGenerationEngine(): AiSoundEffectsGenerationEngine {
    return this.soundEffectsGenerationEngine;
  }

  getAmbientAudioGenerationEngine(): AiAmbientAudioGenerationEngine {
    return this.ambientAudioGenerationEngine;
  }

  getAudioEnhancementRestorationEngine(): AiAudioEnhancementRestorationEngine {
    return this.audioEnhancementRestorationEngine;
  }

  getAudioMixingMasteringEngine(): AiAudioMixingMasteringEngine {
    return this.audioMixingMasteringEngine;
  }

  getAudioProductionEngine(): AiAudioProductionEngine {
    return this.audioProductionEngine;
  }

  getAudioRenderingPreparationEngine(): AiAudioRenderingPreparationEngine {
    return this.audioRenderingPreparationEngine;
  }

  getAudioQualityValidationEngine(): AiAudioQualityValidationEngine {
    return this.audioQualityValidationEngine;
  }

  getLastIntegrityResult(): AudioGenerationIntegrityResult | null {
    return this.lastIntegrity;
  }

  getLastHealthReport(): AudioGenerationHealthReport | null {
    return this.lastHealth;
  }

  getPreparedModuleCount(): number {
    return PREPARED_AUDIO_GENERATION_MODULES.length;
  }

  buildStatusReport(): AudioGenerationFoundationStatusReport {
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
      healthLevel: this.lastHealth?.level ?? AudioGenerationHealthLevel.Good,
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
      throw new AudioGenerationFoundationError(
        "AI Audio Generation Foundation not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}

export { createDefaultGenerationAssetQuality };
