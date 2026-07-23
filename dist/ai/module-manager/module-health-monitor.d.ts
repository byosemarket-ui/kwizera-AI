import type { AiModulePlugin } from "../core/types.js";
import { ModuleManagerLogger } from "./module-logger.js";
import { ManagedModuleState, ModuleHealthStatus, ModuleRegistryRecord } from "./types.js";
export interface ModuleHealthSnapshot {
    moduleId: string;
    status: ManagedModuleState;
    healthStatus: ModuleHealthStatus;
    cpuUsagePercent: number;
    memoryUsageMb: number;
    responseTimeMs: number;
    runtimeErrors: number;
    available: boolean;
}
export declare class ModuleHealthMonitor {
    private readonly logger;
    private readonly errorCounts;
    constructor(logger: ModuleManagerLogger);
    recordError(moduleId: string): void;
    checkModule(record: ModuleRegistryRecord, plugin?: AiModulePlugin): Promise<ModuleHealthSnapshot>;
    shouldIsolate(snapshot: ModuleHealthSnapshot): boolean;
}
//# sourceMappingURL=module-health-monitor.d.ts.map