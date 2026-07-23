import type { AiCoreManager } from "../core/ai-core-manager.js";
import { ApprovedDecisionInput, ExecutionPlan, PlanValidationResult } from "./types.js";
export declare class PlanValidator {
    validate(input: ApprovedDecisionInput, plan: ExecutionPlan, core: AiCoreManager | null): PlanValidationResult;
    private hasStorageCapacity;
}
//# sourceMappingURL=plan-validator.d.ts.map