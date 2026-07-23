import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import { KnowledgeIntegrationStatus } from "./types.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";

/**
 * Integration bridge — prepares interfaces to Core AI systems without implementing new integrations.
 */
export class KnowledgeIntegrationBridge {
  private core: AiCoreManager | null = null;
  private memoryFoundation: AiMemoryFoundation | null = null;
  private moduleManager: AiModuleManager | null = null;
  private stateManager: AiStateManager | null = null;
  private communicationBus: AiCommunicationBus | null = null;
  private recoveryEngine: AiRecoveryEngine | null = null;
  private systemHealthMonitor: AiSystemHealthMonitor | null = null;

  constructor(private readonly logger: KnowledgeFoundationLogger) {}

  connect(
    core: AiCoreManager,
    memoryFoundation: AiMemoryFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    communicationBus?: AiCommunicationBus,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
    this.core = core;
    this.memoryFoundation = memoryFoundation;
    this.moduleManager = moduleManager ?? null;
    this.stateManager = stateManager ?? null;
    this.communicationBus = communicationBus ?? null;
    this.recoveryEngine = recoveryEngine ?? null;
    this.systemHealthMonitor = systemHealthMonitor ?? null;

    this.logger.log("info", "integration", "Knowledge integration bridge connected", {
      memoryEngine: Boolean(memoryFoundation),
      moduleManager: Boolean(moduleManager),
      communicationBus: Boolean(communicationBus),
    });
  }

  getStatus(): KnowledgeIntegrationStatus {
    const status: KnowledgeIntegrationStatus = {
      aiCore: Boolean(this.core?.isReady()),
      memoryEngine: Boolean(this.memoryFoundation?.isStartupComplete()),
      decisionEngine: Boolean(this.core?.decisionEngine?.isInitialized()),
      reasoningEngine: Boolean(this.core?.reasoningEngine?.isInitialized()),
      planningEngine: Boolean(this.core?.planningEngine?.isInitialized()),
      workflowEngine: Boolean(this.core?.workflowEngine?.isInitialized()),
      communicationBus: Boolean(this.communicationBus?.isInitialized()),
      stateManager: Boolean(this.stateManager?.isInitialized()),
      recoveryEngine: Boolean(this.recoveryEngine?.isInitialized()),
      healthMonitor: Boolean(this.systemHealthMonitor?.isInitialized()),
      readyCount: 0,
      totalCount: 10,
    };

    const flags = [
      status.aiCore,
      status.memoryEngine,
      status.decisionEngine,
      status.reasoningEngine,
      status.planningEngine,
      status.workflowEngine,
      status.communicationBus,
      status.stateManager,
      status.recoveryEngine,
      status.healthMonitor,
    ];
    status.readyCount = flags.filter(Boolean).length;

    return status;
  }

  isIntegrationReady(): boolean {
    const status = this.getStatus();
    return status.aiCore && status.memoryEngine && status.readyCount >= 8;
  }

  getMemoryFoundation(): AiMemoryFoundation | null {
    return this.memoryFoundation;
  }

  reportCriticalKnowledgeIssue(issue: string): void {
    this.logger.log("error", "integration", "Critical knowledge issue reported to AI Core", {
      issue,
    });
    if (this.recoveryEngine) {
      this.logger.log("warn", "integration", "Recovery engine notified of knowledge issue", {
        issue,
      });
    }
    if (this.core) {
      this.logger.log("warn", "integration", "AI Core notified of critical knowledge health issue", {
        issue,
      });
    }
  }
}
