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
export declare class KnowledgeIntegrationBridge {
    private readonly logger;
    private core;
    private memoryFoundation;
    private moduleManager;
    private stateManager;
    private communicationBus;
    private recoveryEngine;
    private systemHealthMonitor;
    constructor(logger: KnowledgeFoundationLogger);
    connect(core: AiCoreManager, memoryFoundation: AiMemoryFoundation | null, moduleManager?: AiModuleManager, stateManager?: AiStateManager, communicationBus?: AiCommunicationBus, recoveryEngine?: AiRecoveryEngine, systemHealthMonitor?: AiSystemHealthMonitor): void;
    getStatus(): KnowledgeIntegrationStatus;
    isIntegrationReady(): boolean;
    getMemoryFoundation(): AiMemoryFoundation | null;
    reportCriticalKnowledgeIssue(issue: string): void;
}
//# sourceMappingURL=knowledge-integration-bridge.d.ts.map