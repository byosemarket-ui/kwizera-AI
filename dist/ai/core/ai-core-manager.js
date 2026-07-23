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
import { AiLifecycleState } from "./types.js";
import { AiDecisionEngine } from "../decision/decision-engine.js";
import { createDecisionEnginePlugin } from "../decision/decision-engine-plugin.js";
import { AiReasoningEngine } from "../reasoning/reasoning-engine.js";
import { createReasoningEnginePlugin } from "../reasoning/reasoning-engine-plugin.js";
import { AiPlanningEngine } from "../planning/planning-engine.js";
import { createPlanningEnginePlugin } from "../planning/planning-engine-plugin.js";
import { AiWorkflowEngine } from "../workflow/workflow-engine.js";
import { createWorkflowEnginePlugin } from "../workflow/workflow-engine-plugin.js";
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
/**
 * AI Core Manager — wires all foundation components together.
 */
export class AiCoreManager {
    lifecycle = new AiLifecycleManager();
    logger = new AiCoreLogger();
    configuration = new AiConfigurationManager({
        configRoot: undefined,
    });
    context = new AiContextManager();
    sessions = new AiSessionManager();
    runtime = new AiRuntime();
    registry = new AiModuleRegistry();
    health = new AiHealthMonitor();
    startup = new AiStartupManager();
    shutdown = new AiShutdownManager();
    coordinator;
    controller;
    _decisionEngine = null;
    _reasoningEngine = null;
    _planningEngine = null;
    _workflowEngine = null;
    _taskManager = null;
    _moduleManager = null;
    _communicationBus = null;
    _stateManager = null;
    _recoveryEngine = null;
    _systemHealthMonitor = null;
    _memoryFoundation = null;
    _knowledgeFoundation = null;
    _productIntelligenceFoundation = null;
    _imageIntelligenceFoundation = null;
    _videoIntelligenceFoundation = null;
    _videoGenerationFoundation = null;
    _imageGenerationFoundation = null;
    _audioGenerationFoundation = null;
    started = false;
    options;
    constructor(options = {}) {
        this.options = options;
        this.configuration = new AiConfigurationManager({
            configRoot: options.configRoot,
        });
        this.coordinator = new AiCoordinator(this.lifecycle, this.registry, this.sessions, this.context, this.logger);
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
    async start(correlationId) {
        await this.startup.start({
            lifecycle: this.lifecycle,
            logger: this.logger,
            configuration: this.configuration,
            context: this.context,
            runtime: this.runtime,
            registry: this.registry,
            sessions: this.sessions,
            health: this.health,
        }, {
            storageRootOverride: this.options.storageRootOverride,
            correlationId,
        });
        this.started = true;
        const storageRoot = this.options.storageRootOverride ??
            this.configuration.getConfiguration().storage.storageRoot;
        this._stateManager = new AiStateManager();
        this._stateManager.initialize(this, storageRoot);
        const restored = await this._stateManager.restoreOnStartup();
        const appState = this._stateManager.getApplicationState();
        if (appState === ApplicationState.Stopped ||
            appState === ApplicationState.Starting ||
            appState === ApplicationState.Recovering) {
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
            this._memoryFoundation.initialize(this, storageRoot, this._moduleManager, this._stateManager, this._communicationBus);
            await this._memoryFoundation.runStartup();
            const memoryPlugin = createMemoryFoundationPlugin(this._memoryFoundation, this);
            await this._moduleManager.registerAndInitialize(memoryPlugin);
        }
        if (!this.options.skipReasoningEngine) {
            this._reasoningEngine = new AiReasoningEngine({ storageRoot });
            const reasoningPlugin = createReasoningEnginePlugin(this._reasoningEngine, this);
            await this._moduleManager.registerAndInitialize(reasoningPlugin);
        }
        if (!this.options.skipDecisionEngine) {
            this._decisionEngine = new AiDecisionEngine({ storageRoot });
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
        if (!this.options.skipKnowledgeFoundation) {
            this._knowledgeFoundation = new AiKnowledgeFoundation();
            this._knowledgeFoundation.initialize(this, storageRoot, this._memoryFoundation, this._moduleManager, this._stateManager, this._communicationBus);
            await this._knowledgeFoundation.runStartup();
            const knowledgePlugin = createKnowledgeFoundationPlugin(this._knowledgeFoundation, this);
            await this._moduleManager.registerAndInitialize(knowledgePlugin);
        }
        if (!this.options.skipProductIntelligenceFoundation && this._knowledgeFoundation) {
            this._productIntelligenceFoundation = new AiProductIntelligenceFoundation();
            this._productIntelligenceFoundation.initialize(this, storageRoot, this._memoryFoundation, this._knowledgeFoundation, this._moduleManager, this._stateManager);
            await this._productIntelligenceFoundation.runStartup();
            const productIntelligencePlugin = createProductIntelligenceFoundationPlugin(this._productIntelligenceFoundation, this);
            await this._moduleManager.registerAndInitialize(productIntelligencePlugin);
        }
        if (!this.options.skipImageIntelligenceFoundation && this._productIntelligenceFoundation) {
            this._imageIntelligenceFoundation = new AiImageIntelligenceFoundation();
            this._imageIntelligenceFoundation.initialize(this, storageRoot, this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._moduleManager, this._stateManager);
            await this._imageIntelligenceFoundation.runStartup();
            const imageIntelligencePlugin = createImageIntelligenceFoundationPlugin(this._imageIntelligenceFoundation, this);
            await this._moduleManager.registerAndInitialize(imageIntelligencePlugin);
        }
        if (!this.options.skipVideoIntelligenceFoundation && this._imageIntelligenceFoundation) {
            this._videoIntelligenceFoundation = new AiVideoIntelligenceFoundation();
            this._videoIntelligenceFoundation.initialize(this, storageRoot, this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._imageIntelligenceFoundation, this._moduleManager, this._stateManager);
            await this._videoIntelligenceFoundation.runStartup();
            const videoIntelligencePlugin = createVideoIntelligenceFoundationPlugin(this._videoIntelligenceFoundation, this);
            await this._moduleManager.registerAndInitialize(videoIntelligencePlugin);
        }
        if (!this.options.skipVideoGenerationFoundation && this._videoIntelligenceFoundation) {
            this._videoGenerationFoundation = new AiVideoGenerationFoundation();
            this._videoGenerationFoundation.initialize(this, storageRoot, this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._imageIntelligenceFoundation, this._videoIntelligenceFoundation, this._moduleManager, this._stateManager);
            await this._videoGenerationFoundation.runStartup();
            const videoGenerationPlugin = createVideoGenerationFoundationPlugin(this._videoGenerationFoundation, this);
            await this._moduleManager.registerAndInitialize(videoGenerationPlugin);
        }
        if (!this.options.skipImageGenerationFoundation && this._videoGenerationFoundation) {
            this._imageGenerationFoundation = new AiImageGenerationFoundation();
            this._imageGenerationFoundation.initialize(this, storageRoot, this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._imageIntelligenceFoundation, this._videoIntelligenceFoundation, this._videoGenerationFoundation, this._moduleManager, this._stateManager);
            await this._imageGenerationFoundation.runStartup();
            const imageGenerationPlugin = createImageGenerationFoundationPlugin(this._imageGenerationFoundation, this);
            await this._moduleManager.registerAndInitialize(imageGenerationPlugin);
        }
        if (!this.options.skipAudioGenerationFoundation && this._imageGenerationFoundation) {
            this._audioGenerationFoundation = new AiAudioGenerationFoundation();
            this._audioGenerationFoundation.initialize(this, storageRoot, this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._imageIntelligenceFoundation, this._videoIntelligenceFoundation, this._videoGenerationFoundation, this._imageGenerationFoundation, this._moduleManager, this._stateManager);
            await this._audioGenerationFoundation.runStartup();
            const audioGenerationPlugin = createAudioGenerationFoundationPlugin(this._audioGenerationFoundation, this);
            await this._moduleManager.registerAndInitialize(audioGenerationPlugin);
        }
        this._recoveryEngine = new AiRecoveryEngine();
        this._recoveryEngine.initialize(this, storageRoot, this._moduleManager, this._stateManager, this._communicationBus);
        await this._recoveryEngine.runStartupRecovery();
        const recoveryPlugin = createRecoveryEnginePlugin(this._recoveryEngine, this);
        await this._moduleManager.registerAndInitialize(recoveryPlugin);
        this._systemHealthMonitor = new AiSystemHealthMonitor();
        this._systemHealthMonitor.initialize(this, storageRoot, this._moduleManager, this._stateManager, this._communicationBus, this._recoveryEngine);
        await this._systemHealthMonitor.runHealthScan();
        const healthPlugin = createHealthMonitorPlugin(this._systemHealthMonitor, this);
        await this._moduleManager.registerAndInitialize(healthPlugin);
        if (this._knowledgeFoundation) {
            this._knowledgeFoundation.refreshIntegration(this._memoryFoundation, this._moduleManager, this._stateManager, this._communicationBus, this._recoveryEngine, this._systemHealthMonitor);
            await this._knowledgeFoundation.runHealthCheck();
        }
        if (this._productIntelligenceFoundation) {
            this._productIntelligenceFoundation.refreshIntegration(this._memoryFoundation, this._knowledgeFoundation, this._moduleManager, this._stateManager, this._recoveryEngine, this._systemHealthMonitor);
            await this._productIntelligenceFoundation.runHealthCheck();
        }
        if (this._imageIntelligenceFoundation) {
            this._imageIntelligenceFoundation.refreshIntegration(this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._moduleManager, this._stateManager, this._recoveryEngine, this._systemHealthMonitor);
            await this._imageIntelligenceFoundation.runHealthCheck();
        }
        if (this._videoIntelligenceFoundation) {
            this._videoIntelligenceFoundation.refreshIntegration(this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._imageIntelligenceFoundation, this._moduleManager, this._stateManager, this._recoveryEngine, this._systemHealthMonitor);
            await this._videoIntelligenceFoundation.runHealthCheck();
        }
        if (this._videoGenerationFoundation) {
            this._videoGenerationFoundation.refreshIntegration(this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._imageIntelligenceFoundation, this._videoIntelligenceFoundation, this._moduleManager, this._stateManager, this._recoveryEngine, this._systemHealthMonitor);
            await this._videoGenerationFoundation.runHealthCheck();
        }
        if (this._imageGenerationFoundation) {
            this._imageGenerationFoundation.refreshIntegration(this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._imageIntelligenceFoundation, this._videoIntelligenceFoundation, this._videoGenerationFoundation, this._moduleManager, this._stateManager, this._recoveryEngine, this._systemHealthMonitor);
            await this._imageGenerationFoundation.runHealthCheck();
        }
        if (this._audioGenerationFoundation) {
            this._audioGenerationFoundation.refreshIntegration(this._memoryFoundation, this._knowledgeFoundation, this._productIntelligenceFoundation, this._imageIntelligenceFoundation, this._videoIntelligenceFoundation, this._videoGenerationFoundation, this._imageGenerationFoundation, this._moduleManager, this._stateManager, this._recoveryEngine, this._systemHealthMonitor);
            await this._audioGenerationFoundation.runHealthCheck();
        }
        this._stateManager.syncAiCoreState(this.getLifecycleState(), {
            systemAction: "startup-complete",
        });
        this._stateManager.setSystemState(SystemState.Operational);
        this._stateManager.createSnapshot("application-ready");
    }
    get reasoningEngine() {
        return this._reasoningEngine;
    }
    get decisionEngine() {
        return this._decisionEngine;
    }
    get planningEngine() {
        return this._planningEngine;
    }
    get workflowEngine() {
        return this._workflowEngine;
    }
    get taskManager() {
        return this._taskManager;
    }
    get moduleManager() {
        return this._moduleManager;
    }
    get communicationBus() {
        return this._communicationBus;
    }
    get stateManager() {
        return this._stateManager;
    }
    get recoveryEngine() {
        return this._recoveryEngine;
    }
    get systemHealthMonitor() {
        return this._systemHealthMonitor;
    }
    get memoryFoundation() {
        return this._memoryFoundation;
    }
    get knowledgeFoundation() {
        return this._knowledgeFoundation;
    }
    get productIntelligenceFoundation() {
        return this._productIntelligenceFoundation;
    }
    get imageIntelligenceFoundation() {
        return this._imageIntelligenceFoundation;
    }
    get videoIntelligenceFoundation() {
        return this._videoIntelligenceFoundation;
    }
    get videoGenerationFoundation() {
        return this._videoGenerationFoundation;
    }
    get imageGenerationFoundation() {
        return this._imageGenerationFoundation;
    }
    get audioGenerationFoundation() {
        return this._audioGenerationFoundation;
    }
    isReady() {
        if (!this.started) {
            return false;
        }
        const state = this.lifecycle.getState();
        return state === AiLifecycleState.Ready || state === AiLifecycleState.Running;
    }
    getConfig() {
        return this.configuration.getConfiguration();
    }
    async stop(reason = "requested") {
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
        }
        else {
            if (this._decisionEngine) {
                await this.registry.shutdownModule("decision-engine", this.logger);
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
        await this.shutdown.shutdown({
            lifecycle: this.lifecycle,
            logger: this.logger,
            context: this.context,
            runtime: this.runtime,
            sessions: this.sessions,
        }, reason);
        if (this._stateManager) {
            this._stateManager.saveShutdownSnapshot(reason);
        }
        this.started = false;
    }
    isStarted() {
        return this.started;
    }
    getLifecycleState() {
        return this.lifecycle.getState();
    }
    getStatusReport() {
        return this.controller.buildStatusReport();
    }
}
//# sourceMappingURL=ai-core-manager.js.map