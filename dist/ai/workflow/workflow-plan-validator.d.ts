import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { ExecutionPlan } from "../planning/types.js";
import { WorkflowValidationResult } from "./types.js";
export declare class WorkflowPlanValidator {
    validate(plan: ExecutionPlan, core: AiCoreManager | null): WorkflowValidationResult;
}
//# sourceMappingURL=workflow-plan-validator.d.ts.map