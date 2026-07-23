/**
 * KWIZERA AI STUDIO — Learning Memory Engine types (Step 3E)
 */
export var LearningCategory;
(function (LearningCategory) {
    LearningCategory["Product"] = "product-learning";
    LearningCategory["Video"] = "video-learning";
    LearningCategory["Image"] = "image-learning";
    LearningCategory["Marketing"] = "marketing-learning";
    LearningCategory["Brand"] = "brand-learning";
    LearningCategory["Workflow"] = "workflow-learning";
    LearningCategory["Decision"] = "decision-learning";
    LearningCategory["Reasoning"] = "reasoning-learning";
    LearningCategory["Language"] = "language-learning";
    LearningCategory["Project"] = "project-learning";
})(LearningCategory || (LearningCategory = {}));
export var LearningSource;
(function (LearningSource) {
    LearningSource["Product"] = "product";
    LearningSource["Image"] = "image";
    LearningSource["Video"] = "video";
    LearningSource["MarketingCampaign"] = "marketing-campaign";
    LearningSource["Branding"] = "branding";
    LearningSource["ProjectHistory"] = "project-history";
    LearningSource["WorkflowHistory"] = "workflow-history";
    LearningSource["DecisionHistory"] = "decision-history";
    LearningSource["ReasoningHistory"] = "reasoning-history";
    LearningSource["UserFeedback"] = "user-feedback";
    LearningSource["UserCorrection"] = "user-correction";
    LearningSource["ExportResult"] = "export-result";
    LearningSource["RecoveryHistory"] = "recovery-history";
})(LearningSource || (LearningSource = {}));
export var LearningOutcome;
(function (LearningOutcome) {
    LearningOutcome["Success"] = "success";
    LearningOutcome["Failure"] = "failure";
    LearningOutcome["Partial"] = "partial";
    LearningOutcome["Correction"] = "correction";
})(LearningOutcome || (LearningOutcome = {}));
export class LearningMemoryEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "LearningMemoryEngineError";
    }
}
//# sourceMappingURL=types.js.map