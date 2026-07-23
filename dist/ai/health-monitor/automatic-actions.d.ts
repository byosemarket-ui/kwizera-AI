import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import { HealthMonitorLogger } from "./health-logger.js";
import { HealthRecommendation, ModuleHealthScore } from "./types.js";
export interface AutomaticActionResult {
    action: string;
    success: boolean;
    recoveryResult?: string;
    diagnostics?: string;
}
export declare class AutomaticActions {
    private readonly logger;
    constructor(logger: HealthMonitorLogger);
    handleWarning(moduleScores: ModuleHealthScore[]): Promise<{
        diagnostics: string[];
        recommendations: HealthRecommendation[];
    }>;
    handleCritical(moduleScores: ModuleHealthScore[], recoveryEngine: AiRecoveryEngine | null): Promise<AutomaticActionResult[]>;
}
//# sourceMappingURL=automatic-actions.d.ts.map