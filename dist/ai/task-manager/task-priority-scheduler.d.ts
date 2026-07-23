import { ManagedTask, TaskPriority } from "./types.js";
export declare class TaskPriorityScheduler {
    private activeCriticalId;
    selectNext(tasks: Map<string, ManagedTask>, queueIds: string[]): ManagedTask | undefined;
    acquireCritical(taskId: string, priority: TaskPriority): void;
    releaseCritical(taskId: string): void;
    hasActiveCritical(): boolean;
}
//# sourceMappingURL=task-priority-scheduler.d.ts.map