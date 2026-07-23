import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { RecoveryPoint } from "./types.js";
export declare class RecoveryPointManager {
    private readonly foundation;
    private readonly logger;
    private recoveryDir;
    private points;
    constructor(foundation: AiMemoryFoundation, logger: MemoryOptimizationLogger);
    initialize(optimizationDir: string): void;
    createRecoveryPoint(label: string, filesToSnapshot: string[]): RecoveryPoint;
    restore(recoveryPointId: string, targetFiles: Map<string, string>): boolean;
    getLatest(): RecoveryPoint | undefined;
    list(): RecoveryPoint[];
    private persistManifest;
}
//# sourceMappingURL=recovery-point-manager.d.ts.map