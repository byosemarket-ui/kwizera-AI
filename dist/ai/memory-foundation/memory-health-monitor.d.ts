import { MemoryHealthReport, MemoryModuleRegistration } from "./types.js";
import { MemoryFoundationLogger } from "./memory-logger.js";
import { MemoryAccessCoordinator } from "./memory-access-coordinator.js";
import { MemoryRegistry } from "./memory-registry.js";
import { MemoryStorageManager } from "./memory-storage.js";
export declare class MemoryHealthMonitor {
    private readonly logger;
    private lastReport;
    constructor(logger: MemoryFoundationLogger);
    runHealthCheck(storage: MemoryStorageManager, registry: MemoryRegistry, access: MemoryAccessCoordinator): Promise<MemoryHealthReport>;
    getLastReport(): MemoryHealthReport | null;
    verifyRegistryHealth(modules: MemoryModuleRegistration[]): boolean;
    private scoreToLevel;
    verifyLogDirectory(logDir: string): boolean;
    verifyStorageWritable(memoryRoot: string): boolean;
}
//# sourceMappingURL=memory-health-monitor.d.ts.map