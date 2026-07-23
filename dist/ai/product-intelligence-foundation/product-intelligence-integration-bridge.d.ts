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
export declare class ProductIntelligenceIntegrationBridge {
    private readonly logger;
    private core;
    private memoryFoundation;
    private knowledgeFoundation;
    private moduleManager;
    private stateManager;
    private recoveryEngine;
    private systemHealthMonitor;
    constructor(logger: ProductIntelligenceFoundationLogger);
    connect(core: AiCoreManager, memoryFoundation: AiMemoryFoundation | null, knowledgeFoundation: AiKnowledgeFoundation | null, moduleManager?: AiModuleManager, stateManager?: AiStateManager, recoveryEngine?: AiRecoveryEngine, systemHealthMonitor?: AiSystemHealthMonitor): void;
    getStatus(): ProductIntelligenceIntegrationStatus;
    isIntegrationReady(): boolean;
    getMemoryFoundation(): AiMemoryFoundation | null;
    getKnowledgeFoundation(): AiKnowledgeFoundation | null;
    reportCriticalIssue(issue: string): void;
}
//# sourceMappingURL=product-intelligence-integration-bridge.d.ts.map