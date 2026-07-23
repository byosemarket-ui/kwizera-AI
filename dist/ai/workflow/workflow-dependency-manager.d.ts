import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { ExecutionPlan } from "../planning/types.js";
import { DependencyDiagnostics } from "./types.js";
export declare class WorkflowDependencyManager {
    verify(plan: ExecutionPlan, core: AiCoreManager | null): DependencyDiagnostics;
}
//# sourceMappingURL=workflow-dependency-manager.d.ts.map