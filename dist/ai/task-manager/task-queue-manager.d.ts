import { ManagedTask, TaskQueueCategory, TaskPriority } from "./types.js";
export declare class TaskQueueManager {
    private readonly queues;
    private activeCategories;
    enqueue(task: ManagedTask): void;
    dequeue(category: TaskQueueCategory): string | undefined;
    remove(taskId: string): void;
    getQueueLength(category: TaskQueueCategory): number;
    getTotalQueued(): number;
    canRunInParallel(task: ManagedTask): boolean;
    markActive(category: TaskQueueCategory): void;
    markInactive(category: TaskQueueCategory): void;
    private sortQueue;
    static comparePriority(a: TaskPriority, b: TaskPriority): number;
}
//# sourceMappingURL=task-queue-manager.d.ts.map