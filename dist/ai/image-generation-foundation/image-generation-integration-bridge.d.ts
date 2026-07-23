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
export declare class ImageGenerationIntegrationBridge {
    private readonly logger;
    private core;
    private memoryFoundation;
    private knowledgeFoundation;
    private productIntelligenceFoundation;
    private imageIntelligenceFoundation;
    private videoIntelligenceFoundation;
    private imageGenerationFoundation;
    private moduleManager;
    private stateManager;
    private recoveryEngine;
    private systemHealthMonitor;
    constructor(logger: ImageGenerationFoundationLogger);
    connect(core: AiCoreManager, memoryFoundation: AiMemoryFoundation | null, knowledgeFoundation: AiKnowledgeFoundation | null, productIntelligenceFoundation: AiProductIntelligenceFoundation | null, imageIntelligenceFoundation: AiImageIntelligenceFoundation | null, videoIntelligenceFoundation: AiVideoIntelligenceFoundation | null, imageGenerationFoundation: AiimageGenerationFoundation | null, moduleManager?: AiModuleManager, stateManager?: AiStateManager, recoveryEngine?: AiRecoveryEngine, systemHealthMonitor?: AiSystemHealthMonitor): void;
    getStatus(): ImageGenerationIntegrationStatus;
    isIntegrationReady(): boolean;
    getImageIntelligenceFoundation(): AiImageIntelligenceFoundation | null;
    getProductIntelligenceFoundation(): AiProductIntelligenceFoundation | null;
    getimageGenerationFoundation(): AiimageGenerationFoundation | null;
    reportCriticalIssue(issue: string): void;
}
//# sourceMappingURL=image-generation-integration-bridge.d.ts.map