/**
 * KWIZERA AI STUDIO — AI Workflow Engine types (Step 2E)
 */
export var WorkflowType;
(function (WorkflowType) {
    WorkflowType["ProductAnalysis"] = "product-analysis";
    WorkflowType["ImageAnalysis"] = "image-analysis";
    WorkflowType["ImageEnhancement"] = "image-enhancement";
    WorkflowType["VideoEnhancement"] = "video-enhancement";
    WorkflowType["PromotionalVideoGeneration"] = "promotional-video-generation";
    WorkflowType["MarketingCampaignGeneration"] = "marketing-campaign-generation";
    WorkflowType["PosterGeneration"] = "poster-generation";
    WorkflowType["Translation"] = "translation";
    WorkflowType["MemoryUpdate"] = "memory-update";
    WorkflowType["KnowledgeUpdate"] = "knowledge-update";
    WorkflowType["LearningUpdate"] = "learning-update";
    WorkflowType["Export"] = "export";
    WorkflowType["Backup"] = "backup";
    WorkflowType["Recovery"] = "recovery";
})(WorkflowType || (WorkflowType = {}));
export var WorkflowState;
(function (WorkflowState) {
    WorkflowState["Created"] = "created";
    WorkflowState["Waiting"] = "waiting";
    WorkflowState["Preparing"] = "preparing";
    WorkflowState["Running"] = "running";
    WorkflowState["Paused"] = "paused";
    WorkflowState["Resuming"] = "resuming";
    WorkflowState["Completed"] = "completed";
    WorkflowState["Failed"] = "failed";
    WorkflowState["Cancelled"] = "cancelled";
    WorkflowState["Recovered"] = "recovered";
})(WorkflowState || (WorkflowState = {}));
export var WorkflowStep;
(function (WorkflowStep) {
    WorkflowStep[WorkflowStep["ReceiveExecutionPlan"] = 1] = "ReceiveExecutionPlan";
    WorkflowStep[WorkflowStep["ValidatePlan"] = 2] = "ValidatePlan";
    WorkflowStep[WorkflowStep["CreateWorkflowSession"] = 3] = "CreateWorkflowSession";
    WorkflowStep[WorkflowStep["PrepareRequiredModules"] = 4] = "PrepareRequiredModules";
    WorkflowStep[WorkflowStep["VerifyDependencies"] = 5] = "VerifyDependencies";
    WorkflowStep[WorkflowStep["ExecuteFirstTask"] = 6] = "ExecuteFirstTask";
    WorkflowStep[WorkflowStep["VerifyTaskResult"] = 7] = "VerifyTaskResult";
    WorkflowStep[WorkflowStep["ContinueToNextTask"] = 8] = "ContinueToNextTask";
    WorkflowStep[WorkflowStep["RepeatUntilComplete"] = 9] = "RepeatUntilComplete";
    WorkflowStep[WorkflowStep["ValidateFinalOutput"] = 10] = "ValidateFinalOutput";
    WorkflowStep[WorkflowStep["SaveWorkflowHistory"] = 11] = "SaveWorkflowHistory";
    WorkflowStep[WorkflowStep["NotifyAiCore"] = 12] = "NotifyAiCore";
    WorkflowStep[WorkflowStep["NotifyUser"] = 13] = "NotifyUser";
})(WorkflowStep || (WorkflowStep = {}));
export var TaskExecutionStatus;
(function (TaskExecutionStatus) {
    TaskExecutionStatus["Pending"] = "pending";
    TaskExecutionStatus["Running"] = "running";
    TaskExecutionStatus["Completed"] = "completed";
    TaskExecutionStatus["Failed"] = "failed";
    TaskExecutionStatus["Skipped"] = "skipped";
    TaskExecutionStatus["Recovered"] = "recovered";
})(TaskExecutionStatus || (TaskExecutionStatus = {}));
export class WorkflowEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "WorkflowEngineError";
    }
}
//# sourceMappingURL=types.js.map