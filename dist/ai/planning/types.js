/**
 * KWIZERA AI STUDIO — AI Planning Engine types (Step 2D)
 */
export var PlanningType;
(function (PlanningType) {
    PlanningType["ProductAnalysis"] = "product-analysis";
    PlanningType["ImageAnalysis"] = "image-analysis";
    PlanningType["ImageEnhancement"] = "image-enhancement";
    PlanningType["VideoEnhancement"] = "video-enhancement";
    PlanningType["PromotionalVideoProduction"] = "promotional-video-production";
    PlanningType["PosterGeneration"] = "poster-generation";
    PlanningType["MarketingCampaign"] = "marketing-campaign";
    PlanningType["Translation"] = "translation";
    PlanningType["Learning"] = "learning";
    PlanningType["MemoryUpdates"] = "memory-updates";
    PlanningType["Export"] = "export";
    PlanningType["Backup"] = "backup";
    PlanningType["Recovery"] = "recovery";
})(PlanningType || (PlanningType = {}));
export var PlanningStep;
(function (PlanningStep) {
    PlanningStep[PlanningStep["ReceiveApprovedDecision"] = 1] = "ReceiveApprovedDecision";
    PlanningStep[PlanningStep["UnderstandObjective"] = 2] = "UnderstandObjective";
    PlanningStep[PlanningStep["AnalyzeResources"] = 3] = "AnalyzeResources";
    PlanningStep[PlanningStep["IdentifyModules"] = 4] = "IdentifyModules";
    PlanningStep[PlanningStep["BreakIntoTasks"] = 5] = "BreakIntoTasks";
    PlanningStep[PlanningStep["DefineExecutionOrder"] = 6] = "DefineExecutionOrder";
    PlanningStep[PlanningStep["DefineDependencies"] = 7] = "DefineDependencies";
    PlanningStep[PlanningStep["EstimateExecutionTime"] = 8] = "EstimateExecutionTime";
    PlanningStep[PlanningStep["EstimateStorage"] = 9] = "EstimateStorage";
    PlanningStep[PlanningStep["EstimateMemory"] = 10] = "EstimateMemory";
    PlanningStep[PlanningStep["CreateRecoveryPlan"] = 11] = "CreateRecoveryPlan";
    PlanningStep[PlanningStep["ValidatePlan"] = 12] = "ValidatePlan";
    PlanningStep[PlanningStep["SendToWorkflowEngine"] = 13] = "SendToWorkflowEngine";
})(PlanningStep || (PlanningStep = {}));
export var PlanningStatus;
(function (PlanningStatus) {
    PlanningStatus["Pending"] = "pending";
    PlanningStatus["InProgress"] = "in-progress";
    PlanningStatus["AwaitingInput"] = "awaiting-input";
    PlanningStatus["Complete"] = "complete";
    PlanningStatus["Failed"] = "failed";
})(PlanningStatus || (PlanningStatus = {}));
export var PlanTaskPriority;
(function (PlanTaskPriority) {
    PlanTaskPriority["Critical"] = "critical";
    PlanTaskPriority["High"] = "high";
    PlanTaskPriority["Normal"] = "normal";
    PlanTaskPriority["Low"] = "low";
})(PlanTaskPriority || (PlanTaskPriority = {}));
export class PlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "PlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map