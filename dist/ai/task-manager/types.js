/**
 * KWIZERA AI STUDIO — AI Task Manager types (Step 2F)
 */
export var ManagedTaskType;
(function (ManagedTaskType) {
    ManagedTaskType["ProductAnalysis"] = "product-analysis";
    ManagedTaskType["ImageAnalysis"] = "image-analysis";
    ManagedTaskType["ImageEnhancement"] = "image-enhancement";
    ManagedTaskType["VideoPlanning"] = "video-planning";
    ManagedTaskType["VideoGeneration"] = "video-generation";
    ManagedTaskType["PosterGeneration"] = "poster-generation";
    ManagedTaskType["BannerGeneration"] = "banner-generation";
    ManagedTaskType["MarketingContent"] = "marketing-content";
    ManagedTaskType["Translation"] = "translation";
    ManagedTaskType["Learning"] = "learning";
    ManagedTaskType["MemoryUpdate"] = "memory-update";
    ManagedTaskType["KnowledgeUpdate"] = "knowledge-update";
    ManagedTaskType["DatabaseSave"] = "database-save";
    ManagedTaskType["Export"] = "export";
    ManagedTaskType["Backup"] = "backup";
    ManagedTaskType["Recovery"] = "recovery";
    ManagedTaskType["General"] = "general";
})(ManagedTaskType || (ManagedTaskType = {}));
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority["Critical"] = "critical";
    TaskPriority["High"] = "high";
    TaskPriority["Normal"] = "normal";
    TaskPriority["Low"] = "low";
    TaskPriority["Background"] = "background";
})(TaskPriority || (TaskPriority = {}));
export var TaskQueueCategory;
(function (TaskQueueCategory) {
    TaskQueueCategory["Interactive"] = "interactive";
    TaskQueueCategory["Background"] = "background";
    TaskQueueCategory["Learning"] = "learning";
    TaskQueueCategory["Maintenance"] = "maintenance";
    TaskQueueCategory["Recovery"] = "recovery";
})(TaskQueueCategory || (TaskQueueCategory = {}));
export var ManagedTaskState;
(function (ManagedTaskState) {
    ManagedTaskState["Created"] = "created";
    ManagedTaskState["Queued"] = "queued";
    ManagedTaskState["Waiting"] = "waiting";
    ManagedTaskState["Preparing"] = "preparing";
    ManagedTaskState["Running"] = "running";
    ManagedTaskState["Paused"] = "paused";
    ManagedTaskState["Resuming"] = "resuming";
    ManagedTaskState["Retrying"] = "retrying";
    ManagedTaskState["Completed"] = "completed";
    ManagedTaskState["Cancelled"] = "cancelled";
    ManagedTaskState["Failed"] = "failed";
    ManagedTaskState["Recovered"] = "recovered";
    ManagedTaskState["Archived"] = "archived";
})(ManagedTaskState || (ManagedTaskState = {}));
export class TaskManagerError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "TaskManagerError";
    }
}
//# sourceMappingURL=types.js.map