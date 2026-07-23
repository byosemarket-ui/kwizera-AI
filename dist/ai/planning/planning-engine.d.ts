import type { AiCoreManager } from "../core/ai-core-manager.js";
import { DependencyAnalyzer } from "./dependency-analyzer.js";
import { PlanRiskAnalyzer } from "./plan-risk-analyzer.js";
import { PlanValidator } from "./plan-validator.js";
import { PlanningHistoryStore } from "./planning-history-store.js";
import { PlanningLogger } from "./planning-logger.js";
import { RecoveryPlanner } from "./recovery-planner.js";
import { ResourceEstimator } from "./resource-estimator.js";
import { TaskBreakdown } from "./task-breakdown.js";
import { ApprovedDecisionInput, PlanningEngineStatusReport, PlanningResult } from "./types.js";
export interface AiPlanningEngineOptions {
    storageRoot: string;
}
/**
 * KWIZERA AI Planning Engine — transforms approved decisions into execution plans.
 * Step 2D: Never executes work. No AI models. No business module implementations.
 */
export declare class AiPlanningEngine {
    readonly logger: PlanningLogger;
    readonly history: PlanningHistoryStore;
    readonly taskBreakdown: TaskBreakdown;
    readonly dependencyAnalyzer: DependencyAnalyzer;
    readonly resourceEstimator: ResourceEstimator;
    readonly riskAnalyzer: PlanRiskAnalyzer;
    readonly recoveryPlanner: RecoveryPlanner;
    readonly planValidator: PlanValidator;
    private readonly storageRoot;
    private readonly planningDurations;
    private initialized;
    private core;
    constructor(options: AiPlanningEngineOptions);
    initialize(core: AiCoreManager): void;
    isInitialized(): boolean;
    /**
     * Execute the 13-step planning process from an approved decision.
     */
    planFromDecision(input: ApprovedDecisionInput): Promise<PlanningResult>;
    buildStatusReport(): PlanningEngineStatusReport;
    private getCriticalFields;
    private buildExpectedOutput;
    private buildIncompleteResult;
    private createRecord;
}
//# sourceMappingURL=planning-engine.d.ts.map