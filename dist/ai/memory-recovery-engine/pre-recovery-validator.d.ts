import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { PreRecoveryValidation } from "./types.js";
export declare class PreRecoveryValidator {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, storageRoot: string, logger: MemoryRecoveryLogger);
    validate(backupId: string): Promise<PreRecoveryValidation>;
}
//# sourceMappingURL=pre-recovery-validator.d.ts.map