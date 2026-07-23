import type { PlanTask } from "../planning/types.js";
export declare class TaskScheduler {
    schedule(executionOrder: string[], tasks: PlanTask[]): PlanTask[];
    getRemaining(completed: string[], scheduled: PlanTask[]): PlanTask[];
}
//# sourceMappingURL=task-scheduler.d.ts.map