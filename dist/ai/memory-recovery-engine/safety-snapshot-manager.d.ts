import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
export declare class SafetySnapshotManager {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    private snapshotsDir;
    constructor(foundation: AiMemoryFoundation, storageRoot: string, logger: MemoryRecoveryLogger);
    initialize(recoveryDir: string): void;
    create(label: string): Promise<string>;
}
//# sourceMappingURL=safety-snapshot-manager.d.ts.map