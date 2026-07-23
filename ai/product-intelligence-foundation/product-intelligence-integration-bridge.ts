import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import { ProductIntelligenceIntegrationStatus } from "./types.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";

/**
 * Integration bridge — official interfaces to Core AI systems without implementing new engines.
 */
export class ProductIntelligenceIntegrationBridge {
  private core: AiCoreManager | null = null;
  private memoryFoundation: AiMemoryFoundation | null = null;
  private knowledgeFoundation: AiKnowledgeFoundation | null = null;
  private moduleManager: AiModuleManager | null = null;
  private stateManager: AiStateManager | null = null;
  private recoveryEngine: AiRecoveryEngine | null = null;
  private systemHealthMonitor: AiSystemHealthMonitor | null = null;

  constructor(private readonly logger: ProductIntelligenceFoundationLogger) {}

  connect(
    core: AiCoreManager,
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    recoveryEngine?: AiRecoveryEngine,
    systemHealthMonitor?: AiSystemHealthMonitor
  ): void {
    this.core = core;
    this.memoryFoundation = memoryFoundation;
    this.knowledgeFoundation = knowledgeFoundation;
    this.moduleManager = moduleManager ?? null;
    this.stateManager = stateManager ?? null;
    this.recoveryEngine = recoveryEngine ?? null;
    this.systemHealthMonitor = systemHealthMonitor ?? null;

    this.logger.log("info", "integration", "Product Intelligence integration bridge connected", {
      memoryEngine: Boolean(memoryFoundation),
      knowledgeEngine: Boolean(knowledgeFoundation),
      moduleManager: Boolean(moduleManager),
    });
  }

  getStatus(): ProductIntelligenceIntegrationStatus {
    const status: ProductIntelligenceIntegrationStatus = {
      aiCore: Boolean(this.core?.isReady()),
      memoryEngine: Boolean(this.memoryFoundation?.isStartupComplete()),
      knowledgeEngine: Boolean(this.knowledgeFoundation?.isStartupComplete()),
      decisionEngine: Boolean(this.core?.decisionEngine?.isInitialized()),
      reasoningEngine: Boolean(this.core?.reasoningEngine?.isInitialized()),
      planningEngine: Boolean(this.core?.planningEngine?.isInitialized()),
      workflowEngine: Boolean(this.core?.workflowEngine?.isInitialized()),
      stateManager: Boolean(this.stateManager?.isInitialized()),
      recoveryEngine: Boolean(this.recoveryEngine?.isInitialized()),
      healthMonitor: Boolean(this.systemHealthMonitor?.isInitialized()),
      readyCount: 0,
      totalCount: 10,
    };

    const flags = [
      status.aiCore,
      status.memoryEngine,
      status.knowledgeEngine,
      status.decisionEngine,
      status.reasoningEngine,
      status.planningEngine,
      status.workflowEngine,
      status.stateManager,
      status.recoveryEngine,
      status.healthMonitor,
    ];
    status.readyCount = flags.filter(Boolean).length;

    return status;
  }

  isIntegrationReady(): boolean {
    const status = this.getStatus();
    return status.aiCore && status.memoryEngine && status.knowledgeEngine && status.readyCount >= 8;
  }

  getMemoryFoundation(): AiMemoryFoundation | null {
    return this.memoryFoundation;
  }

  getKnowledgeFoundation(): AiKnowledgeFoundation | null {
    return this.knowledgeFoundation;
  }

  reportCriticalIssue(issue: string): void {
    this.logger.log("error", "integration", "Critical product intelligence issue reported", { issue });
    if (this.recoveryEngine) {
      this.logger.log("warn", "integration", "Recovery engine notified of product intelligence issue", {
        issue,
      });
    }
    if (this.core) {
      this.logger.log("warn", "integration", "AI Core notified of critical product intelligence issue", {
        issue,
      });
    }
  }
}
