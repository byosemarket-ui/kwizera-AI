import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryHealthMonitorLogger } from "./health-logger.js";
import { MemoryAuditResult } from "./types.js";
export declare class MemoryAuditor {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, storageRoot: string, logger: MemoryHealthMonitorLogger);
    runAudit(): Promise<MemoryAuditResult>;
}
//# sourceMappingURL=memory-auditor.d.ts.map