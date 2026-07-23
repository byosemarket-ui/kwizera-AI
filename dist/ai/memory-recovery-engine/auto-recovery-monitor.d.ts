import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { MemoryRecoveryRequest } from "./types.js";
export interface CorruptionReport {
    detected: boolean;
    issues: string[];
    isolatedPaths: string[];
}
export declare class AutoRecoveryMonitor {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: MemoryRecoveryLogger);
    detectCorruption(): CorruptionReport;
    resolveBackupId(request: MemoryRecoveryRequest): string | null;
    buildEmergencyRequest(reason: string): MemoryRecoveryRequest;
    generateRecoveryId(): string;
}
//# sourceMappingURL=auto-recovery-monitor.d.ts.map