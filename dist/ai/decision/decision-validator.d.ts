import type { AiCoreManager } from "../core/ai-core-manager.js";
import { DecisionRequest, DecisionValidationResult, ScoredSolution } from "./types.js";
export declare class DecisionValidator {
    validate(request: DecisionRequest, selected: ScoredSolution, core: AiCoreManager): DecisionValidationResult;
}
//# sourceMappingURL=decision-validator.d.ts.map