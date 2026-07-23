import type { PlanTask } from "../planning/types.js";
import { ManagedTaskType, TaskPriority, TaskQueueCategory } from "./types.js";
export declare function inferTaskType(planTask: PlanTask): ManagedTaskType;
export declare function inferPriority(planTask: PlanTask): TaskPriority;
export declare function inferQueueCategory(taskType: ManagedTaskType): TaskQueueCategory;
export declare function mapPlanPriorityToTaskPriority(priority: string): TaskPriority;
//# sourceMappingURL=task-type-mapper.d.ts.map