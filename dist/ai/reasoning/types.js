/**
 * KWIZERA AI STUDIO — AI Reasoning Engine types (Step 2C)
 */
export var ReasoningType;
(function (ReasoningType) {
    ReasoningType["ProductAnalysis"] = "product-analysis";
    ReasoningType["ImageAnalysis"] = "image-analysis";
    ReasoningType["VideoPlanning"] = "video-planning";
    ReasoningType["MarketingStrategy"] = "marketing-strategy";
    ReasoningType["Translation"] = "translation";
    ReasoningType["Branding"] = "branding";
    ReasoningType["WorkflowPlanning"] = "workflow-planning";
    ReasoningType["ExportDecisions"] = "export-decisions";
    ReasoningType["ErrorRecovery"] = "error-recovery";
    ReasoningType["Learning"] = "learning";
})(ReasoningType || (ReasoningType = {}));
export var ReasoningStep;
(function (ReasoningStep) {
    ReasoningStep[ReasoningStep["ReceiveTask"] = 1] = "ReceiveTask";
    ReasoningStep[ReasoningStep["UnderstandObjective"] = 2] = "UnderstandObjective";
    ReasoningStep[ReasoningStep["CollectInformation"] = 3] = "CollectInformation";
    ReasoningStep[ReasoningStep["SearchMemory"] = 4] = "SearchMemory";
    ReasoningStep[ReasoningStep["SearchKnowledge"] = 5] = "SearchKnowledge";
    ReasoningStep[ReasoningStep["AnalyzeContext"] = 6] = "AnalyzeContext";
    ReasoningStep[ReasoningStep["GenerateApproaches"] = 7] = "GenerateApproaches";
    ReasoningStep[ReasoningStep["CompareApproaches"] = 8] = "CompareApproaches";
    ReasoningStep[ReasoningStep["CalculateConfidence"] = 9] = "CalculateConfidence";
    ReasoningStep[ReasoningStep["RecommendBest"] = 10] = "RecommendBest";
    ReasoningStep[ReasoningStep["ExplainInternally"] = 11] = "ExplainInternally";
    ReasoningStep[ReasoningStep["SendToDecisionEngine"] = 12] = "SendToDecisionEngine";
})(ReasoningStep || (ReasoningStep = {}));
export var ConfidenceLevel;
(function (ConfidenceLevel) {
    ConfidenceLevel["VeryHigh"] = "very-high";
    ConfidenceLevel["High"] = "high";
    ConfidenceLevel["Medium"] = "medium";
    ConfidenceLevel["Low"] = "low";
    ConfidenceLevel["VeryLow"] = "very-low";
})(ConfidenceLevel || (ConfidenceLevel = {}));
export var ReasoningStatus;
(function (ReasoningStatus) {
    ReasoningStatus["Pending"] = "pending";
    ReasoningStatus["InProgress"] = "in-progress";
    ReasoningStatus["AwaitingInput"] = "awaiting-input";
    ReasoningStatus["Complete"] = "complete";
    ReasoningStatus["Failed"] = "failed";
})(ReasoningStatus || (ReasoningStatus = {}));
export class ReasoningEngineError extends Error {
    code;
    missingInformation;
    constructor(message, code, missingInformation) {
        super(message);
        this.code = code;
        this.missingInformation = missingInformation;
        this.name = "ReasoningEngineError";
    }
}
//# sourceMappingURL=types.js.map