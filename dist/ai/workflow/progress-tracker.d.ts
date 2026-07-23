import type { AiModuleRegistry } from "../core/module-registry.js";
import type { PlanTask } from "../planning/types.js";
import type { TaskCoordinator } from "./task-coordinator.js";
import { RecoveryEvent, TaskExecutionRecord, WorkflowState, WorkflowTracking } from "./types.js";
export declare class ProgressTracker {
    createTracking(scheduled: PlanTask[], estimatedTotalMs: number): WorkflowTracking;
    updateAfterTask(tracking: WorkflowTracking, taskId: string, durationMs: number, estimatedPerTaskMs: number): void;
    addError(tracking: WorkflowTracking, error: string): void;
    addWarning(tracking: WorkflowTracking, warning: string): void;
}
export declare class RecoveryManager {
    attemptRecovery(task: PlanTask, coordinator: TaskCoordinator, registry: AiModuleRegistry, tracking: WorkflowTracking): Promise<{
        recovered: boolean;
        record?: TaskExecutionRecord;
        event: RecoveryEvent;
    }>;
}
export declare function resolveWorkflowState(success: boolean, hadRecovery: boolean, paused: boolean): WorkflowState;
//# sourceMappingURL=progress-tracker.d.ts.map