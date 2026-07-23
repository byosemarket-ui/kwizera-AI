import { RecoveryEngineLogger } from "./recovery-logger.js";
import { MemoryProtectionManifest } from "./types.js";
export declare class MemoryProtection {
    private readonly logger;
    constructor(logger: RecoveryEngineLogger);
    verify(storageRoot: string): MemoryProtectionManifest;
    protectDuringRecovery(storageRoot: string): void;
}
//# sourceMappingURL=memory-protection.d.ts.map