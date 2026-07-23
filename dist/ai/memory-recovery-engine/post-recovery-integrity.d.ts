import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { PostRecoveryIntegrity } from "./types.js";
export declare class PostRecoveryIntegrityChecker {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, storageRoot: string, logger: MemoryRecoveryLogger);
    verify(): Promise<PostRecoveryIntegrity>;
}
//# sourceMappingURL=post-recovery-integrity.d.ts.map