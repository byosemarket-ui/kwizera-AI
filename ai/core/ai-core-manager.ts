import { AiPluginManager } from "../plugin-management/plugin-manager.js";
import { createInternalPlugins } from "../plugin-management/internal-plugins.js";
import { AiConnectorManager } from "../connector-management/connector-manager.js";
import { AiDesktopIntegrationManager } from "../desktop-integration/desktop-integration-manager.js";
import { AiLifecycleManager } from "./lifecycle.js";
import { AiCoreLogger } from "./logger.js";
import { AiModuleRegistry } from "./module-registry.js";
import { AiConfigurationManager } from "./ai-configuration-manager.js";
import { AiContextManager } from "./ai-context-manager.js";
import { AiSessionManager } from "./ai-session-manager.js";
import { AiRuntime } from "./ai-runtime.js";
import { AiHealthMonitor } from "./ai-health-monitor.js";
import { AiStartupManager } from "./ai-startup-manager.js";
import { AiShutdownManager } from "./ai-shutdown-manager.js";
import { AiCoordinator } from "./ai-coordinator.js";
import { AiController } from "./ai-controller.js";
import { AiCoreStatusReport, AiLifecycleState } from "./types.js";
import { AiDecisionEngine } from "../decision/decision-engine.js";
import { createDecisionEnginePlugin } from "../decision/decision-engine-plugin.js";
import { AiReasoningEngine } from "../reasoning/reasoning-engine.js";
import { createReasoningEnginePlugin } from "../reasoning/reasoning-engine-plugin.js";
import { AiPlanningEngine } from "../planning/planning-engine.js";
import { createPlanningEnginePlugin } from "../planning/planning-engine-plugin.js";
import { AiWorkflowEngine } from "../workflow/workflow-engine.js";
import { createWorkflowEnginePlugin } from "../workflow/workflow-engine-plugin.js";
import { AiRecommendationEngine } from "../recommendation/recommendation-engine.js";
import { createRecommendationEnginePlugin } from "../recommendation/recommendation-engine-plugin.js";
import { AiMultiDomainEngine } from "../multi-domain/multi-domain-engine.js";
import { createMultiDomainEnginePlugin } from "../multi-domain/multi-domain-engine-plugin.js";
import { AiSelfReviewEngine } from "../self-review/self-review-engine.js";
import { createSelfReviewEnginePlugin } from "../self-review/self-review-engine-plugin.js";
import { AiProfessionalReasoningCertificationEngine } from "../professional-reasoning-certification/professional-reasoning-certification-engine.js";
import { createProfessionalReasoningCertificationPlugin } from "../professional-reasoning-certification/professional-reasoning-certification-plugin.js";
import { AiTaskManager } from "../task-manager/task-manager.js";
import { createTaskManagerPlugin } from "../task-manager/task-manager-plugin.js";
import { AiModuleManager } from "../module-manager/module-manager.js";
import { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import { AiStateManager } from "../state-manager/state-manager.js";
import { ApplicationState, SystemState } from "../state-manager/types.js";
import { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import { createRecoveryEnginePlugin } from "../recovery-engine/recovery-engine-plugin.js";
import { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import { createHealthMonitorPlugin } from "../health-monitor/health-monitor-plugin.js";
import { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { createMemoryFoundationPlugin } from "../memory-foundation/memory-foundation-plugin.js";
import { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { createKnowledgeFoundationPlugin } from "../knowledge-foundation/knowledge-foundation-plugin.js";
import { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { createProductIntelligenceFoundationPlugin } from "../product-intelligence-foundation/product-intelligence-foundation-plugin.js";
import { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { createImageIntelligenceFoundationPlugin } from "../image-intelligence-foundation/image-intelligence-foundation-plugin.js";
import { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { createVideoIntelligenceFoundationPlugin } from "../video-intelligence-foundation/video-intelligence-foundation-plugin.js";
import { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { createVideoGenerationFoundationPlugin } from "../video-generation-foundation/video-generation-foundation-plugin.js";
import { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { createImageGenerationFoundationPlugin } from "../image-generation-foundation/image-generation-foundation-plugin.js";
import { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { createAudioGenerationFoundationPlugin } from "../audio-generation-foundation/audio-generation-foundation-plugin.js";
import { AiModelManager } from "../model-management/ai-model-manager.js";
import { createModelManagementPlugin } from "../model-management/model-management-plugin.js";
import { AiToolManager } from "../tool-management/tool-manager.js";
import { createBuiltInTools } from "../tool-management/built-in-tools.js";
import { AiConversationEngine, createConversationEnginePlugin } from "../conversation/conversation-engine.js";
import { FoundationKnowledgeSearchProvider, FoundationMemorySearchProvider } from "../decision/providers/foundation-search-providers.js";

export interface AiCoreManagerOptions {
  configRoot?: string;
  storageRootOverride?: string;
  skipReasoningEngine?: boolean;
  skipDecisionEngine?: boolean;
  skipPlanningEngine?: boolean;
  skipWorkflowEngine?: boolean;
  skipRecommendationEngine?: boolean;
  skipMultiDomainEngine?: boolean;
  skipSelfReviewEngine?: boolean;
  skipProfessionalReasoningCertification?: boolean;
  skipTaskManager?: boolean;
  skipMemoryFoundation?: boolean;
  skipKnowledgeFoundation?: boolean;
  skipProductIntelligenceFoundation?: boolean;
  skipImageIntelligenceFoundation?: boolean;
  skipVideoIntelligenceFoundation?: boolean;
  skipVideoGenerationFoundation?: boolean;
  skipImageGenerationFoundation?: boolean;
  skipAudioGenerationFoundation?: boolean;
}

/**
 * AI Core Manager — wires all foundation components together.
 */
export class AiCoreManager {
  readonly lifecycle = new AiLifecycleManager();
  readonly logger = new AiCoreLogger();
  readonly configuration = new AiConfigurationManager({
    configRoot: undefined,
  });
  readonly context = new AiContextManager();
  readonly sessions = new AiSessionManager();
  readonly runtime = new AiRuntime();
  readonly registry = new AiModuleRegistry();
  readonly health = new AiHealthMonitor();
  readonly startup = new AiStartupManager();
  readonly shutdown = new AiShutdownManager();

  readonly coordinator: AiCoordinator;
  readonly controller: AiController;

  private _decisionEngine: AiDecisionEngine | null = null;
  private _reasoningEngine: AiReasoningEngine | null = null;
  private _planningEngine: AiPlanningEngine | null = null;
  private _workflowEngine: AiWorkflowEngine | null = null;
  private _recommendationEngine: AiRecommendationEngine | null = null;
  private _multiDomainEngine: AiMultiDomainEngine | null = null;
  private _selfReviewEngine: AiSelfReviewEngine | null = null;
  private _professionalReasoningCertification: AiProfessionalReasoningCertificationEngine | null = null;
  private _taskManager: AiTaskManager | null = null;
  private _moduleManager: AiModuleManager | null = null;
  private _communicationBus: AiCommunicationBus | null = null;
  private _stateManager: AiStateManager | null = null;
  private _recoveryEngine: AiRecoveryEngine | null = null;
  private _systemHealthMonitor: AiSystemHealthMonitor | null = null;
  private _memoryFoundation: AiMemoryFoundation | null = null;
  private _knowledgeFoundation: AiKnowledgeFoundation | null = null;
  private _productIntelligenceFoundation: AiProductIntelligenceFoundation | null = null;
  private _imageIntelligenceFoundation: AiImageIntelligenceFoundation | null = null;
  private _videoIntelligenceFoundation: AiVideoIntelligenceFoundation | null = null;
  private _videoGenerationFoundation: AiVideoGenerationFoundation | null = null;
  private _imageGenerationFoundation: AiImageGenerationFoundation | null = null;
  private _audioGenerationFoundation: AiAudioGenerationFoundation | null = null;
  private _modelManager: AiModelManager | null = null;
  private _toolManager: AiToolManager | null = null;
  private _connectorManager: AiConnectorManager | null = null;
  private _desktopIntegrationManager: AiDesktopIntegrationManager | null = null;
  private _pluginManager: AiPluginManager | null = null;
  private _conversationEngine: AiConversationEngine | null = null;

  private started = false;
  private readonly options: AiCoreManagerOptions;

  constructor(options: AiCoreManagerOptions = {}) {
    this.options = options;
    this.configuration = new AiConfigurationManager({
      configRoot: options.configRoot,
    });

    this.coordinator = new AiCoordinator(
      this.lifecycle,
      this.registry,
      this.sessions,
      this.context,
      this.logger
    );

    this.controller = new AiController({
      lifecycle: this.lifecycle,
      startup: this.startup,
      shutdown: this.shutdown,
      configuration: this.configuration,
      runtime: this.runtime,
      registry: this.registry,
      logger: this.logger,
      health: this.health,
      coordinator: this.coordinator,
      sessions: this.sessions,
    });
  }

  async start(correlationId?: string): Promise<void> {
    await this.startup.start(
      {
        lifecycle: this.lifecycle,
        logger: this.logger,
        configuration: this.configuration,
        context: this.context,
        runtime: this.runtime,
        registry: this.registry,
        sessions: this.sessions,
        health: this.health,
      },
      {
        storageRootOverride: this.options.storageRootOverride,
        correlationId,
      }
    );
    this.started = true;

    const storageRoot =
      this.options.storageRootOverride ??
      this.configuration.getConfiguration().storage.storageRoot;

    this._stateManager = new AiStateManager();
    this._stateManager.initialize(this, storageRoot);
    const restored = await this._stateManager.restoreOnStartup();
    const appState = this._stateManager.getApplicationState();
    if (
      appState === ApplicationState.Stopped ||
      appState === ApplicationState.Starting ||
      appState === ApplicationState.Recovering
    ) {
      this._stateManager.setApplicationState(ApplicationState.Loading, {
        systemAction: restored ? "post-restore-engine-init" : "engine-initialization",
      });
    }

    this._moduleManager = new AiModuleManager();
    this._moduleManager.initialize(this, storageRoot);
    this._moduleManager.setStateManager(this._stateManager);

    this._communicationBus = new AiCommunicationBus();
    this._communicationBus.initialize(this, this._moduleManager, storageRoot);
    this._moduleManager.setCommunicationBus(this._communicationBus);

    if (!this.options.skipMemoryFoundation) {
      this._memoryFoundation = new AiMemoryFoundation();
      this._memoryFoundation.initialize(
        this,
        storageRoot,
        this._moduleManager,
        this._stateManager,
        this._communicationBus
      );
      await this._memoryFoundation.runStartup();
      const memoryPlugin = createMemoryFoundationPlugin(this._memoryFoundation, this);
      await this._moduleManager.registerAndInitialize(memoryPlugin);
    }

    if (!this.options.skipReasoningEngine) {
      this._reasoningEngine = new AiReasoningEngine({
        storageRoot,
        memoryProvider: new FoundationMemorySearchProvider(this),
        knowledgeProvider: new FoundationKnowledgeSearchProvider(this),
      });
      const reasoningPlugin = createReasoningEnginePlugin(this._reasoningEngine, this);
      await this._moduleManager.registerAndInitialize(reasoningPlugin);
    }

    if (!this.options.skipDecisionEngine) {
      this._decisionEngine = new AiDecisionEngine({
        storageRoot,
        memoryProvider: new FoundationMemorySearchProvider(this),
        knowledgeProvider: new FoundationKnowledgeSearchProvider(this),
      });
      if (this._reasoningEngine) {
        this._decisionEngine.setReasoningEngine(this._reasoningEngine);
      }
      const plugin = createDecisionEnginePlugin(this._decisionEngine, this);
      await this._moduleManager.registerAndInitialize(plugin);
    }

    if (!this.options.skipPlanningEngine) {
      this._planningEngine = new AiPlanningEngine({ storageRoot });
      const planningPlugin = createPlanningEnginePlugin(this._planningEngine, this);
      await this._moduleManager.registerAndInitialize(planningPlugin);
      if (this._decisionEngine) {
        this._decisionEngine.setPlanningEngine(this._planningEngine);
      }
    }

    if (!this.options.skipTaskManager) {
      this._taskManager = new AiTaskManager({ storageRoot });
      const taskPlugin = createTaskManagerPlugin(this._taskManager, this);
      await this._moduleManager.registerAndInitialize(taskPlugin);
    }

    if (!this.options.skipWorkflowEngine) {
      this._workflowEngine = new AiWorkflowEngine({ storageRoot });
      if (this._taskManager) {
        this._workflowEngine.setTaskManager(this._taskManager);
      }
      const workflowPlugin = createWorkflowEnginePlugin(this._workflowEngine, this);
      await this._moduleManager.registerAndInitialize(workflowPlugin);
    }

    if (!this.options.skipRecommendationEngine) {
      this._recommendationEngine = new AiRecommendationEngine({ storageRoot });
      const recommendationPlugin = createRecommendationEnginePlugin(this._recommendationEngine, this);
      await this._moduleManager.registerAndInitialize(recommendationPlugin);
    }

    if (!this.options.skipMultiDomainEngine) {
      this._multiDomainEngine = new AiMultiDomainEngine({ storageRoot });
      const multiDomainPlugin = createMultiDomainEnginePlugin(this._multiDomainEngine, this);
      await this._moduleManager.registerAndInitialize(multiDomainPlugin);
    }

    if (!this.options.skipSelfReviewEngine) {
      this._selfReviewEngine = new AiSelfReviewEngine({ storageRoot });
      const selfReviewPlugin = createSelfReviewEnginePlugin(this._selfReviewEngine, this);
      await this._moduleManager.registerAndInitialize(selfReviewPlugin);
    }

    if (!this.options.skipProfessionalReasoningCertification) {
      this._professionalReasoningCertification = new AiProfessionalReasoningCertificationEngine({ storageRoot });
      const certificationPlugin = createProfessionalReasoningCertificationPlugin(
        this._professionalReasoningCertification,
        this
      );
      await this._moduleManager.registerAndInitialize(certificationPlugin);
    }

    if (!this.options.skipKnowledgeFoundation) {
      this._knowledgeFoundation = new AiKnowledgeFoundation();
      this._knowledgeFoundation.initialize(
        this,
        storageRoot,
        this._memoryFoundation,
        this._moduleManager,
        this._stateManager,
        this._communicationBus
      );
      await this._knowledgeFoundation.runStartup();
      const knowledgePlugin = createKnowledgeFoundationPlugin(this._knowledgeFoundation, this);
      await this._moduleManager.registerAndInitialize(knowledgePlugin);
    }

    this._conversationEngine = new AiConversationEngine();
    await this._conversationEngine.initialize(this, storageRoot);
    await this._moduleManager.registerAndInitialize(createConversationEnginePlugin(this._conversationEngine));

    if (!this.options.skipProductIntelligenceFoundation && this._knowledgeFoundation) {
      this._productIntelligenceFoundation = new AiProductIntelligenceFoundation();
      this._productIntelligenceFoundation.initialize(
        this,
        storageRoot,
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._moduleManager,
        this._stateManager
      );
      await this._productIntelligenceFoundation.runStartup();
      const productIntelligencePlugin = createProductIntelligenceFoundationPlugin(
        this._productIntelligenceFoundation,
        this
      );
      await this._moduleManager.registerAndInitialize(productIntelligencePlugin);
    }

    if (!this.options.skipImageIntelligenceFoundation && this._productIntelligenceFoundation) {
      this._imageIntelligenceFoundation = new AiImageIntelligenceFoundation();
      this._imageIntelligenceFoundation.initialize(
        this,
        storageRoot,
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._moduleManager,
        this._stateManager
      );
      await this._imageIntelligenceFoundation.runStartup();
      const imageIntelligencePlugin = createImageIntelligenceFoundationPlugin(
        this._imageIntelligenceFoundation,
        this
      );
      await this._moduleManager.registerAndInitialize(imageIntelligencePlugin);
    }

    if (!this.options.skipVideoIntelligenceFoundation && this._imageIntelligenceFoundation) {
      this._videoIntelligenceFoundation = new AiVideoIntelligenceFoundation();
      this._videoIntelligenceFoundation.initialize(
        this,
        storageRoot,
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._imageIntelligenceFoundation,
        this._moduleManager,
        this._stateManager
      );
      await this._videoIntelligenceFoundation.runStartup();
      const videoIntelligencePlugin = createVideoIntelligenceFoundationPlugin(
        this._videoIntelligenceFoundation,
        this
      );
      await this._moduleManager.registerAndInitialize(videoIntelligencePlugin);
    }

    if (!this.options.skipVideoGenerationFoundation && this._videoIntelligenceFoundation) {
      this._videoGenerationFoundation = new AiVideoGenerationFoundation();
      this._videoGenerationFoundation.initialize(
        this,
        storageRoot,
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._imageIntelligenceFoundation,
        this._videoIntelligenceFoundation,
        this._moduleManager,
        this._stateManager
      );
      await this._videoGenerationFoundation.runStartup();
      const videoGenerationPlugin = createVideoGenerationFoundationPlugin(
        this._videoGenerationFoundation,
        this
      );
      await this._moduleManager.registerAndInitialize(videoGenerationPlugin);
    }

    if (!this.options.skipImageGenerationFoundation && this._videoGenerationFoundation) {
      this._imageGenerationFoundation = new AiImageGenerationFoundation();
      this._imageGenerationFoundation.initialize(
        this,
        storageRoot,
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._imageIntelligenceFoundation,
        this._videoIntelligenceFoundation,
        this._videoGenerationFoundation,
        this._moduleManager,
        this._stateManager
      );
      await this._imageGenerationFoundation.runStartup();
      const imageGenerationPlugin = createImageGenerationFoundationPlugin(
        this._imageGenerationFoundation,
        this
      );
      await this._moduleManager.registerAndInitialize(imageGenerationPlugin);
    }

    if (!this.options.skipAudioGenerationFoundation && this._imageGenerationFoundation) {
      this._audioGenerationFoundation = new AiAudioGenerationFoundation();
      this._audioGenerationFoundation.initialize(
        this,
        storageRoot,
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._imageIntelligenceFoundation,
        this._videoIntelligenceFoundation,
        this._videoGenerationFoundation,
        this._imageGenerationFoundation,
        this._moduleManager,
        this._stateManager
      );
      await this._audioGenerationFoundation.runStartup();
      const audioGenerationPlugin = createAudioGenerationFoundationPlugin(
        this._audioGenerationFoundation,
        this
      );
      await this._moduleManager.registerAndInitialize(audioGenerationPlugin);
    }

    this._recoveryEngine = new AiRecoveryEngine();
    this._recoveryEngine.initialize(
      this,
      storageRoot,
      this._moduleManager,
      this._stateManager,
      this._communicationBus
    );
    await this._recoveryEngine.runStartupRecovery();

    const recoveryPlugin = createRecoveryEnginePlugin(this._recoveryEngine, this);
    await this._moduleManager.registerAndInitialize(recoveryPlugin);

    this._systemHealthMonitor = new AiSystemHealthMonitor();
    this._systemHealthMonitor.initialize(
      this,
      storageRoot,
      this._moduleManager,
      this._stateManager,
      this._communicationBus,
      this._recoveryEngine
    );
    await this._systemHealthMonitor.runHealthScan();

    const healthPlugin = createHealthMonitorPlugin(this._systemHealthMonitor, this);
    await this._moduleManager.registerAndInitialize(healthPlugin);

    if (this._knowledgeFoundation) {
      this._knowledgeFoundation.refreshIntegration(
        this._memoryFoundation,
        this._moduleManager,
        this._stateManager,
        this._communicationBus,
        this._recoveryEngine,
        this._systemHealthMonitor
      );
      await this._knowledgeFoundation.runHealthCheck();
    }

    if (this._productIntelligenceFoundation) {
      this._productIntelligenceFoundation.refreshIntegration(
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._moduleManager,
        this._stateManager,
        this._recoveryEngine,
        this._systemHealthMonitor
      );
      await this._productIntelligenceFoundation.runHealthCheck();
    }

    if (this._imageIntelligenceFoundation) {
      this._imageIntelligenceFoundation.refreshIntegration(
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._moduleManager,
        this._stateManager,
        this._recoveryEngine,
        this._systemHealthMonitor
      );
      await this._imageIntelligenceFoundation.runHealthCheck();
    }

    if (this._videoIntelligenceFoundation) {
      this._videoIntelligenceFoundation.refreshIntegration(
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._imageIntelligenceFoundation,
        this._moduleManager,
        this._stateManager,
        this._recoveryEngine,
        this._systemHealthMonitor
      );
      await this._videoIntelligenceFoundation.runHealthCheck();
    }

    if (this._videoGenerationFoundation) {
      this._videoGenerationFoundation.refreshIntegration(
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._imageIntelligenceFoundation,
        this._videoIntelligenceFoundation,
        this._moduleManager,
        this._stateManager,
        this._recoveryEngine,
        this._systemHealthMonitor
      );
      await this._videoGenerationFoundation.runHealthCheck();
    }

    if (this._imageGenerationFoundation) {
      this._imageGenerationFoundation.refreshIntegration(
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._imageIntelligenceFoundation,
        this._videoIntelligenceFoundation,
        this._videoGenerationFoundation,
        this._moduleManager,
        this._stateManager,
        this._recoveryEngine,
        this._systemHealthMonitor
      );
      await this._imageGenerationFoundation.runHealthCheck();
    }

    if (this._audioGenerationFoundation) {
      this._audioGenerationFoundation.refreshIntegration(
        this._memoryFoundation,
        this._knowledgeFoundation,
        this._productIntelligenceFoundation,
        this._imageIntelligenceFoundation,
        this._videoIntelligenceFoundation,
        this._videoGenerationFoundation,
        this._imageGenerationFoundation,
        this._moduleManager,
        this._stateManager,
        this._recoveryEngine,
        this._systemHealthMonitor
      );
      await this._audioGenerationFoundation.runHealthCheck();
    }

    this._modelManager = new AiModelManager();
    await this._modelManager.initialize(storageRoot, this);
    const modelManagementPlugin = createModelManagementPlugin(this._modelManager, this);
    await this._moduleManager.registerAndInitialize(modelManagementPlugin);

    this._toolManager = new AiToolManager();
    await this._toolManager.initialize(this, storageRoot);
    await this._toolManager.discover(createBuiltInTools(this));
    await this._toolManager.monitor();

    this._pluginManager = new AiPluginManager();
    await this._pluginManager.initialize(this, this._toolManager, storageRoot);
    const internalPlugins = createInternalPlugins(this);
    await this._pluginManager.discover(internalPlugins);
    for (const plugin of internalPlugins) await this._pluginManager.load(plugin.manifest.id);
    await this._pluginManager.monitor();

    this._connectorManager = new AiConnectorManager();
    await this._connectorManager.initialize(this, this._toolManager, storageRoot);
    await this._connectorManager.monitor();

    this._desktopIntegrationManager = new AiDesktopIntegrationManager();
    await this._desktopIntegrationManager.initialize(this, this._toolManager, storageRoot);

    this._stateManager.syncAiCoreState(this.getLifecycleState(), {
      systemAction: "startup-complete",
    });
    this._stateManager.setSystemState(SystemState.Operational);
    this._stateManager.createSnapshot("application-ready");
  }

  get reasoningEngine(): AiReasoningEngine | null {
    return this._reasoningEngine;
  }

  get decisionEngine(): AiDecisionEngine | null {
    return this._decisionEngine;
  }

  get planningEngine(): AiPlanningEngine | null {
    return this._planningEngine;
  }

  get workflowEngine(): AiWorkflowEngine | null {
    return this._workflowEngine;
  }

  get recommendationEngine(): AiRecommendationEngine | null {
    return this._recommendationEngine;
  }

  get multiDomainEngine(): AiMultiDomainEngine | null {
    return this._multiDomainEngine;
  }

  get selfReviewEngine(): AiSelfReviewEngine | null {
    return this._selfReviewEngine;
  }

  get professionalReasoningCertification(): AiProfessionalReasoningCertificationEngine | null {
    return this._professionalReasoningCertification;
  }

  get taskManager(): AiTaskManager | null {
    return this._taskManager;
  }

  get moduleManager(): AiModuleManager | null {
    return this._moduleManager;
  }

  get communicationBus(): AiCommunicationBus | null {
    return this._communicationBus;
  }

  get stateManager(): AiStateManager | null {
    return this._stateManager;
  }

  get recoveryEngine(): AiRecoveryEngine | null {
    return this._recoveryEngine;
  }

  get systemHealthMonitor(): AiSystemHealthMonitor | null {
    return this._systemHealthMonitor;
  }

  get memoryFoundation(): AiMemoryFoundation | null {
    return this._memoryFoundation;
  }

  get knowledgeFoundation(): AiKnowledgeFoundation | null {
    return this._knowledgeFoundation;
  }

  get productIntelligenceFoundation(): AiProductIntelligenceFoundation | null {
    return this._productIntelligenceFoundation;
  }

  get imageIntelligenceFoundation(): AiImageIntelligenceFoundation | null {
    return this._imageIntelligenceFoundation;
  }

  get videoIntelligenceFoundation(): AiVideoIntelligenceFoundation | null {
    return this._videoIntelligenceFoundation;
  }

  get videoGenerationFoundation(): AiVideoGenerationFoundation | null {
    return this._videoGenerationFoundation;
  }

  get imageGenerationFoundation(): AiImageGenerationFoundation | null {
    return this._imageGenerationFoundation;
  }

  get audioGenerationFoundation(): AiAudioGenerationFoundation | null {
    return this._audioGenerationFoundation;
  }

  get modelManager(): AiModelManager | null {
    return this._modelManager;
  }

  get toolManager(): AiToolManager | null {
    return this._toolManager;
  }

  get pluginManager(): AiPluginManager | null {
    return this._pluginManager;
  }

  get connectorManager(): AiConnectorManager | null {
    return this._connectorManager;
  }

  get conversationEngine(): AiConversationEngine | null {
    return this._conversationEngine;
  }

  get desktopIntegrationManager(): AiDesktopIntegrationManager | null {
    return this._desktopIntegrationManager;
  }

  isReady(): boolean {
    if (!this.started) {
      return false;
    }
    const state = this.lifecycle.getState();
    return state === AiLifecycleState.Ready || state === AiLifecycleState.Running;
  }

  getConfig() {
    return this.configuration.getConfiguration();
  }

  async stop(reason = "requested"): Promise<void> {
    if (this._desktopIntegrationManager) await this._desktopIntegrationManager.shutdown();
    if (this._pluginManager) await this._pluginManager.shutdown();
    this._desktopIntegrationManager = null;
    this._connectorManager = null;
    this._conversationEngine = null;
    this._pluginManager = null;
    this._toolManager = null;
    if (this._modelManager) {
      for (const model of this._modelManager.list().filter((item) => item.status === "loaded")) {
        await this._modelManager.unload(model.id);
      }
    }
    if (this._audioGenerationFoundation) {
      await this._audioGenerationFoundation.shutdown();
    }
    if (this._imageGenerationFoundation) {
      await this._imageGenerationFoundation.shutdown();
    }
    if (this._videoGenerationFoundation) {
      await this._videoGenerationFoundation.shutdown();
    }
    if (this._videoIntelligenceFoundation) {
      await this._videoIntelligenceFoundation.shutdown();
    }
    if (this._imageIntelligenceFoundation) {
      await this._imageIntelligenceFoundation.shutdown();
    }
    if (this._productIntelligenceFoundation) {
      await this._productIntelligenceFoundation.shutdown();
    }
    if (this._knowledgeFoundation) {
      await this._knowledgeFoundation.shutdown();
    }
    if (this._memoryFoundation) {
      await this._memoryFoundation.shutdown();
    }
    if (this._moduleManager) {
      if (this._professionalReasoningCertification) {
        await this._moduleManager.unloadModule("professional-reasoning-certification");
      }
      if (this._selfReviewEngine) {
        await this._moduleManager.unloadModule("self-review-engine");
      }
      if (this._multiDomainEngine) {
        await this._moduleManager.unloadModule("multi-domain-engine");
      }
      if (this._recommendationEngine) {
        await this._moduleManager.unloadModule("recommendation-engine");
      }
      if (this._workflowEngine) {
        await this._moduleManager.unloadModule("workflow-engine");
      }
      if (this._decisionEngine) {
        await this._moduleManager.unloadModule("decision-engine");
      }
      if (this._taskManager) {
        await this._moduleManager.unloadModule("task-manager");
      }
      if (this._planningEngine) {
        await this._moduleManager.unloadModule("planning-engine");
      }
      if (this._reasoningEngine) {
        await this._moduleManager.unloadModule("reasoning-engine");
      }
    } else {
      if (this._decisionEngine) {
        await this.registry.shutdownModule("decision-engine", this.logger);
      }
      if (this._professionalReasoningCertification) {
        await this.registry.shutdownModule("professional-reasoning-certification", this.logger);
      }
      if (this._selfReviewEngine) {
        await this.registry.shutdownModule("self-review-engine", this.logger);
      }
      if (this._multiDomainEngine) {
        await this.registry.shutdownModule("multi-domain-engine", this.logger);
      }
      if (this._recommendationEngine) {
        await this.registry.shutdownModule("recommendation-engine", this.logger);
      }
      if (this._workflowEngine) {
        await this.registry.shutdownModule("workflow-engine", this.logger);
      }
      if (this._taskManager) {
        await this.registry.shutdownModule("task-manager", this.logger);
      }
      if (this._planningEngine) {
        await this.registry.shutdownModule("planning-engine", this.logger);
      }
      if (this._reasoningEngine) {
        await this.registry.shutdownModule("reasoning-engine", this.logger);
      }
    }
    await this.shutdown.shutdown(
      {
        lifecycle: this.lifecycle,
        logger: this.logger,
        context: this.context,
        runtime: this.runtime,
        sessions: this.sessions,
      },
      reason
    );
    if (this._stateManager) {
      this._stateManager.saveShutdownSnapshot(reason);
    }
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  getLifecycleState(): AiLifecycleState {
    return this.lifecycle.getState();
  }

  getStatusReport(): AiCoreStatusReport {
    return this.controller.buildStatusReport();
  }
}
