import type { ExecutionPlan } from "../planning/types.js";
import { TaskExecutionRecord, WorkflowValidationResult } from "./types.js";
export declare class OutputValidator {
    validate(plan: ExecutionPlan, taskHistory: TaskExecutionRecord[], planValidation: WorkflowValidationResult): WorkflowValidationResult;
}
//# sourceMappingURL=output-validator.d.ts.map