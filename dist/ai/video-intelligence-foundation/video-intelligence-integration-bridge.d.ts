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
export declare class VideoIntelligenceIntegrationBridge {
    private readonly logger;
    private core;
    private memoryFoundation;
    private knowledgeFoundation;
    private productIntelligenceFoundation;
    private imageIntelligenceFoundation;
    private moduleManager;
    private stateManager;
    private recoveryEngine;
    private systemHealthMonitor;
    constructor(logger: VideoIntelligenceFoundationLogger);
    connect(core: AiCoreManager, memoryFoundation: AiMemoryFoundation | null, knowledgeFoundation: AiKnowledgeFoundation | null, productIntelligenceFoundation: AiProductIntelligenceFoundation | null, imageIntelligenceFoundation: AiImageIntelligenceFoundation | null, moduleManager?: AiModuleManager, stateManager?: AiStateManager, recoveryEngine?: AiRecoveryEngine, systemHealthMonitor?: AiSystemHealthMonitor): void;
    getStatus(): VideoIntelligenceIntegrationStatus;
    isIntegrationReady(): boolean;
    getMemoryFoundation(): AiMemoryFoundation | null;
    getKnowledgeFoundation(): AiKnowledgeFoundation | null;
    getProductIntelligenceFoundation(): AiProductIntelligenceFoundation | null;
    getImageIntelligenceFoundation(): AiImageIntelligenceFoundation | null;
    reportCriticalIssue(issue: string): void;
}
//# sourceMappingURL=video-intelligence-integration-bridge.d.ts.map