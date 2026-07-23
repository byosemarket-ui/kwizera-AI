import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryHealthMonitorLogger } from "./health-logger.js";
import { AutoRepairResult, HealthWarning } from "./types.js";
export declare class AutoRepairHandler {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: MemoryHealthMonitorLogger);
    attemptRepairs(warnings: HealthWarning[]): Promise<AutoRepairResult>;
}
//# sourceMappingURL=auto-repair-handler.d.ts.map