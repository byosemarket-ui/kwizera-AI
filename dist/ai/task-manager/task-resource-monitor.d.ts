import type { AiCoreManager } from "../core/ai-core-manager.js";
import { ResourceSnapshot } from "./types.js";
export declare class TaskResourceMonitor {
    snapshot(core: AiCoreManager | null): ResourceSnapshot;
    canAcceptTask(snapshot: ResourceSnapshot): boolean;
}
//# sourceMappingURL=task-resource-monitor.d.ts.map