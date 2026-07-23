import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ResourceMetrics } from "./resource-monitor.js";
import { HealthWarning, MonitoredModuleHealthScore } from "./types.js";
export declare class EarlyWarningSystem {
    private readonly foundation;
    constructor(foundation: AiMemoryFoundation);
    detect(moduleScores: MonitoredModuleHealthScore[], metrics: ResourceMetrics): Promise<HealthWarning[]>;
    private warn;
}
//# sourceMappingURL=early-warning-system.d.ts.map