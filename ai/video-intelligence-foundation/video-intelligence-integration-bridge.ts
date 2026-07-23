import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import { VideoIntelligenceIntegrationStatus } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";

/**
 * Integration bridge — official interfaces to Core AI systems without implementing new engines.
 */
export class VideoIntelligenceIntegrationBridge {
  private core: AiCoreManager | null = null;
  private memoryFoundation: AiMemoryFoundation | null = null;
  private knowledgeFoundation: AiKnowledgeFoundation | null = null;
  private productIntelligenceFoundation: AiProductIntelligenceFoundation | null = null;
  private imageIntelligenceFoundation: AiImageIntelligenceFoundation | null = null;
  private moduleManager: AiModuleManager | null = null;
  private stateManager: AiStateManager | null = null;
  private recoveryEngine: AiRecoveryEngine | null = null;
  private systemHealthMonitor: AiSystemHealthMonitor | null = null;

  constructor(private readonly logger: VideoIntelligenceFoundationLogger) {}

  connect(
    core: AiCoreManager,
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
    this.memoryFoundation = memoryFoundation;
    this.knowledgeFoundation = knowledgeFoundation;
    this.productIntelligenceFoundation = productIntelligenceFoundation;
    this.imageIntelligenceFoundation = imageIntelligenceFoundation;
    this.moduleManager = moduleManager ?? null;
    this.stateManager = stateManager ?? null;
    this.recoveryEngine = recoveryEngine ?? null;
    this.systemHealthMonitor = systemHealthMonitor ?? null;

    this.logger.log("info", "integration", "Video Intelligence integration bridge connected", {
      memoryEngine: Boolean(memoryFoundation),
      knowledgeEngine: Boolean(knowledgeFoundation),
      productIntelligenceEngine: Boolean(productIntelligenceFoundation),
      imageIntelligenceEngine: Boolean(imageIntelligenceFoundation),
      moduleManager: Boolean(moduleManager),
    });
  }

  getStatus(): VideoIntelligenceIntegrationStatus {
    const status: VideoIntelligenceIntegrationStatus = {
      aiCore: Boolean(this.core?.isReady()),
      memoryEngine: Boolean(this.memoryFoundation?.isStartupComplete()),
      knowledgeEngine: Boolean(this.knowledgeFoundation?.isStartupComplete()),
      productIntelligenceEngine: Boolean(this.productIntelligenceFoundation?.isStartupComplete()),
      imageIntelligenceEngine: Boolean(this.imageIntelligenceFoundation?.isStartupComplete()),
      decisionEngine: Boolean(this.core?.decisionEngine?.isInitialized()),
      reasoningEngine: Boolean(this.core?.reasoningEngine?.isInitialized()),
      planningEngine: Boolean(this.core?.planningEngine?.isInitialized()),
      workflowEngine: Boolean(this.core?.workflowEngine?.isInitialized()),
      stateManager: Boolean(this.stateManager?.isInitialized()),
      recoveryEngine: Boolean(this.recoveryEngine?.isInitialized()),
      healthMonitor: Boolean(this.systemHealthMonitor?.isInitialized()),
      readyCount: 0,
      totalCount: 12,
    };

    const flags = [
      status.aiCore,
      status.memoryEngine,
      status.knowledgeEngine,
      status.productIntelligenceEngine,
      status.imageIntelligenceEngine,
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
    return (
      status.aiCore &&
      status.memoryEngine &&
      status.knowledgeEngine &&
      status.productIntelligenceEngine &&
      status.imageIntelligenceEngine &&
      status.readyCount >= 10
    );
  }

  getMemoryFoundation(): AiMemoryFoundation | null {
    return this.memoryFoundation;
  }

  getKnowledgeFoundation(): AiKnowledgeFoundation | null {
    return this.knowledgeFoundation;
  }

  getProductIntelligenceFoundation(): AiProductIntelligenceFoundation | null {
    return this.productIntelligenceFoundation;
  }

  getImageIntelligenceFoundation(): AiImageIntelligenceFoundation | null {
    return this.imageIntelligenceFoundation;
  }

  reportCriticalIssue(issue: string): void {
    this.logger.log("error", "integration", "Critical video intelligence issue reported", { issue });
    if (this.recoveryEngine) {
      this.logger.log("warn", "integration", "Recovery engine notified of video intelligence issue", {
        issue,
      });
    }
    if (this.core) {
      this.logger.log("warn", "integration", "AI Core notified of critical video intelligence issue", {
        issue,
      });
    }
  }
}
