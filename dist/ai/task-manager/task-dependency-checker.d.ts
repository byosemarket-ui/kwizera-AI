import type { AiCoreManager } from "../core/ai-core-manager.js";
import { TaskDependencyResult } from "./types.js";
export declare class TaskDependencyChecker {
    verify(moduleId: string, dependsOn: string[], completedTaskIds: string[], core: AiCoreManager | null): TaskDependencyResult;
}
//# sourceMappingURL=task-dependency-checker.d.ts.map