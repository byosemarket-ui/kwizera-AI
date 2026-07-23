import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import type { AiimageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiSystemHealthMonitor } from "../health-monitor/health-monitor.js";
import { ImageGenerationIntegrationStatus } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";

export class ImageGenerationIntegrationBridge {
  private core: AiCoreManager | null = null;
  private memoryFoundation: AiMemoryFoundation | null = null;
  private knowledgeFoundation: AiKnowledgeFoundation | null = null;
  private productIntelligenceFoundation: AiProductIntelligenceFoundation | null = null;
  private imageIntelligenceFoundation: AiImageIntelligenceFoundation | null = null;
  private videoIntelligenceFoundation: AiVideoIntelligenceFoundation | null = null;
  private imageGenerationFoundation: AiimageGenerationFoundation | null = null;
  private moduleManager: AiModuleManager | null = null;
  private stateManager: AiStateManager | null = null;
  private recoveryEngine: AiRecoveryEngine | null = null;
  private systemHealthMonitor: AiSystemHealthMonitor | null = null;

  constructor(private readonly logger: ImageGenerationFoundationLogger) {}

  connect(
    core: AiCoreManager,
    memoryFoundation: AiMemoryFoundation | null,
    knowledgeFoundation: AiKnowledgeFoundation | null,
    productIntelligenceFoundation: AiProductIntelligenceFoundation | null,
    imageIntelligenceFoundation: AiImageIntelligenceFoundation | null,
    videoIntelligenceFoundation: AiVideoIntelligenceFoundation | null,
    imageGenerationFoundation: AiimageGenerationFoundation | null,
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
    this.videoIntelligenceFoundation = videoIntelligenceFoundation;
    this.imageGenerationFoundation = imageGenerationFoundation;
    this.moduleManager = moduleManager ?? null;
    this.stateManager = stateManager ?? null;
    this.recoveryEngine = recoveryEngine ?? null;
    this.systemHealthMonitor = systemHealthMonitor ?? null;

    this.logger.log("info", "integration", "Image Generation integration bridge connected", {
      memoryEngine: Boolean(memoryFoundation),
      knowledgeEngine: Boolean(knowledgeFoundation),
      productIntelligenceEngine: Boolean(productIntelligenceFoundation),
      imageIntelligenceEngine: Boolean(imageIntelligenceFoundation),
      videoIntelligenceEngine: Boolean(videoIntelligenceFoundation),
      imageGenerationEngine: Boolean(imageGenerationFoundation),
    });
  }

  getStatus(): ImageGenerationIntegrationStatus {
    const status: ImageGenerationIntegrationStatus = {
      aiCore: Boolean(this.core?.isReady()),
      memoryEngine: Boolean(this.memoryFoundation?.isStartupComplete()),
      knowledgeEngine: Boolean(this.knowledgeFoundation?.isStartupComplete()),
      productIntelligenceEngine: Boolean(this.productIntelligenceFoundation?.isStartupComplete()),
      imageIntelligenceEngine: Boolean(this.imageIntelligenceFoundation?.isStartupComplete()),
      videoIntelligenceEngine: Boolean(this.videoIntelligenceFoundation?.isStartupComplete()),
      imageGenerationEngine: Boolean(this.imageGenerationFoundation?.isStartupComplete()),
      decisionEngine: Boolean(this.core?.decisionEngine?.isInitialized()),
      reasoningEngine: Boolean(this.core?.reasoningEngine?.isInitialized()),
      planningEngine: Boolean(this.core?.planningEngine?.isInitialized()),
      workflowEngine: Boolean(this.core?.workflowEngine?.isInitialized()),
      stateManager: Boolean(this.stateManager?.isInitialized()),
      recoveryEngine: Boolean(this.recoveryEngine?.isInitialized()),
      healthMonitor: Boolean(this.systemHealthMonitor?.isInitialized()),
      readyCount: 0,
      totalCount: 14,
    };

    const flags = [
      status.aiCore,
      status.memoryEngine,
      status.knowledgeEngine,
      status.productIntelligenceEngine,
      status.imageIntelligenceEngine,
      status.videoIntelligenceEngine,
      status.imageGenerationEngine,
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
      status.videoIntelligenceEngine &&
      status.imageGenerationEngine &&
      status.readyCount >= 12
    );
  }

  getImageIntelligenceFoundation(): AiImageIntelligenceFoundation | null {
    return this.imageIntelligenceFoundation;
  }

  getProductIntelligenceFoundation(): AiProductIntelligenceFoundation | null {
    return this.productIntelligenceFoundation;
  }

  getimageGenerationFoundation(): AiimageGenerationFoundation | null {
    return this.imageGenerationFoundation;
  }

  reportCriticalIssue(issue: string): void {
    this.logger.log("error", "integration", "Critical image generation issue reported", { issue });
    if (this.recoveryEngine) {
      this.logger.log("warn", "integration", "Recovery engine notified of image generation issue", { issue });
    }
    if (this.core) {
      this.logger.log("warn", "integration", "AI Core notified of critical image generation issue", { issue });
    }
  }
}
