import { ApprovedDecisionInput, PlanTask } from "./types.js";
export declare class TaskBreakdown {
    breakDown(input: ApprovedDecisionInput, moduleIds: string[]): PlanTask[];
    getExecutionOrder(tasks: PlanTask[]): string[];
}
//# sourceMappingURL=task-breakdown.d.ts.map