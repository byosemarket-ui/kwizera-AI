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
import { AudioGenerationIntegrationStatus } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
export declare class AudioGenerationIntegrationBridge {
    private readonly logger;
    private core;
    private memoryFoundation;
    private knowledgeFoundation;
    private productIntelligenceFoundation;
    private imageIntelligenceFoundation;
    private videoIntelligenceFoundation;
    private videoGenerationFoundation;
    private imageGenerationFoundation;
    private moduleManager;
    private stateManager;
    private recoveryEngine;
    private systemHealthMonitor;
    constructor(logger: AudioGenerationFoundationLogger);
    connect(core: AiCoreManager, memoryFoundation: AiMemoryFoundation | null, knowledgeFoundation: AiKnowledgeFoundation | null, productIntelligenceFoundation: AiProductIntelligenceFoundation | null, imageIntelligenceFoundation: AiImageIntelligenceFoundation | null, videoIntelligenceFoundation: AiVideoIntelligenceFoundation | null, videoGenerationFoundation: AiVideoGenerationFoundation | null, imageGenerationFoundation: AiImageGenerationFoundation | null, moduleManager?: AiModuleManager, stateManager?: AiStateManager, recoveryEngine?: AiRecoveryEngine, systemHealthMonitor?: AiSystemHealthMonitor): void;
    getStatus(): AudioGenerationIntegrationStatus;
    isIntegrationReady(): boolean;
    getImageIntelligenceFoundation(): AiImageIntelligenceFoundation | null;
    getProductIntelligenceFoundation(): AiProductIntelligenceFoundation | null;
    getVideoGenerationFoundation(): AiVideoGenerationFoundation | null;
    getImageGenerationFoundation(): AiImageGenerationFoundation | null;
    reportCriticalIssue(issue: string): void;
}
//# sourceMappingURL=audio-generation-integration-bridge.d.ts.map