import type { AiModuleRegistry } from "../core/module-registry.js";
import type { PlanTask } from "../planning/types.js";
import { TaskExecutionRecord } from "../workflow/types.js";
/**
 * Executes task coordination to module slots — no AI work performed.
 */
export declare class TaskModuleExecutor {
    execute(planTask: PlanTask, registry: AiModuleRegistry, simulateFailure?: boolean): {
        success: boolean;
        record: TaskExecutionRecord;
        diagnostics?: string;
    };
    private buildRecord;
}
//# sourceMappingURL=task-module-executor.d.ts.map