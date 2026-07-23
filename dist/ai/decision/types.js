/**
 * KWIZERA AI STUDIO — AI Decision Engine types (Step 2B)
 */
export var DecisionType;
(function (DecisionType) {
    DecisionType["ProductAnalysis"] = "product-analysis";
    DecisionType["ImageAnalysis"] = "image-analysis";
    DecisionType["VideoGeneration"] = "video-generation";
    DecisionType["Marketing"] = "marketing";
    DecisionType["Translation"] = "translation";
    DecisionType["Memory"] = "memory";
    DecisionType["Learning"] = "learning";
    DecisionType["Export"] = "export";
    DecisionType["Recovery"] = "recovery";
    DecisionType["General"] = "general";
})(DecisionType || (DecisionType = {}));
export var DecisionPriority;
(function (DecisionPriority) {
    DecisionPriority["Critical"] = "critical";
    DecisionPriority["High"] = "high";
    DecisionPriority["Normal"] = "normal";
    DecisionPriority["Low"] = "low";
    DecisionPriority["Background"] = "background";
})(DecisionPriority || (DecisionPriority = {}));
export var DecisionStep;
(function (DecisionStep) {
    DecisionStep[DecisionStep["ReceiveRequest"] = 1] = "ReceiveRequest";
    DecisionStep[DecisionStep["UnderstandGoal"] = 2] = "UnderstandGoal";
    DecisionStep[DecisionStep["AnalyzeData"] = 3] = "AnalyzeData";
    DecisionStep[DecisionStep["SearchMemory"] = 4] = "SearchMemory";
    DecisionStep[DecisionStep["SearchKnowledge"] = 5] = "SearchKnowledge";
    DecisionStep[DecisionStep["DetectMissing"] = 6] = "DetectMissing";
    DecisionStep[DecisionStep["GenerateSolutions"] = 7] = "GenerateSolutions";
    DecisionStep[DecisionStep["CompareSolutions"] = 8] = "CompareSolutions";
    DecisionStep[DecisionStep["ScoreSolutions"] = 9] = "ScoreSolutions";
    DecisionStep[DecisionStep["SelectBest"] = 10] = "SelectBest";
    DecisionStep[DecisionStep["ExplainInternally"] = 11] = "ExplainInternally";
    DecisionStep[DecisionStep["PassToWorkflow"] = 12] = "PassToWorkflow";
})(DecisionStep || (DecisionStep = {}));
export var DecisionStatus;
(function (DecisionStatus) {
    DecisionStatus["Pending"] = "pending";
    DecisionStatus["InProgress"] = "in-progress";
    DecisionStatus["AwaitingInput"] = "awaiting-input";
    DecisionStatus["Validated"] = "validated";
    DecisionStatus["Approved"] = "approved";
    DecisionStatus["Rejected"] = "rejected";
    DecisionStatus["Failed"] = "failed";
})(DecisionStatus || (DecisionStatus = {}));
export class DecisionEngineError extends Error {
    code;
    missingInformation;
    constructor(message, code, missingInformation) {
        super(message);
        this.code = code;
        this.missingInformation = missingInformation;
        this.name = "DecisionEngineError";
    }
}
//# sourceMappingURL=types.js.map