import { ManagedTask, ManagedTaskState, TaskProgress } from "./types.js";
export declare class TaskProgressTracker {
    createInitial(): TaskProgress;
    transition(task: ManagedTask, state: ManagedTaskState, stage: string, percent: number): void;
    updateElapsed(task: ManagedTask, elapsedMs: number, estimatedMs: number): void;
    complete(task: ManagedTask): void;
}
//# sourceMappingURL=task-progress-tracker.d.ts.map