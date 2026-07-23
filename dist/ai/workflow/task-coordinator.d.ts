import type { AiModuleRegistry } from "../core/module-registry.js";
import type { PlanTask } from "../planning/types.js";
import { TaskExecutionRecord } from "./types.js";
export interface TaskCoordinationResult {
    record: TaskExecutionRecord;
    success: boolean;
}
/**
 * Coordinates module tasks without performing AI work.
 * Step 2E: delegates to module slots only.
 */
export declare class TaskCoordinator {
    coordinate(task: PlanTask, registry: AiModuleRegistry, simulateFailure?: boolean): TaskCoordinationResult;
}
//# sourceMappingURL=task-coordinator.d.ts.map