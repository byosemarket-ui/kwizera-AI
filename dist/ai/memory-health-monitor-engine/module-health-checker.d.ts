import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryHealthScoreLevel, MonitoredModuleHealthScore } from "./types.js";
export declare class ModuleHealthChecker {
    private readonly foundation;
    constructor(foundation: AiMemoryFoundation);
    checkAll(): MonitoredModuleHealthScore[];
    private checkModule;
    scoreToLevel(score: number): MemoryHealthScoreLevel;
}
//# sourceMappingURL=module-health-checker.d.ts.map