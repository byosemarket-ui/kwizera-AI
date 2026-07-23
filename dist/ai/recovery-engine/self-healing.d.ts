import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { FailureReport } from "./types.js";
export declare class SelfHealing {
    private readonly logger;
    private actionCount;
    constructor(logger: RecoveryEngineLogger);
    attempt(failure: FailureReport, core: AiCoreManager, moduleManager: AiModuleManager | null, communicationBus: AiCommunicationBus | null, stateManager: AiStateManager | null): Promise<string[]>;
    getActionCount(): number;
}
//# sourceMappingURL=self-healing.d.ts.map