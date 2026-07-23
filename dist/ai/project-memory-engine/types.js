/**
 * KWIZERA AI STUDIO — Project Memory Engine types (Step 3F)
 */
export var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["Created"] = "created";
    ProjectStatus["Editing"] = "editing";
    ProjectStatus["Processing"] = "processing";
    ProjectStatus["Paused"] = "paused";
    ProjectStatus["Waiting"] = "waiting";
    ProjectStatus["Completed"] = "completed";
    ProjectStatus["Exported"] = "exported";
    ProjectStatus["Archived"] = "archived";
    ProjectStatus["Recovered"] = "recovered";
})(ProjectStatus || (ProjectStatus = {}));
export var ProjectType;
(function (ProjectType) {
    ProjectType["Promotional"] = "promotional";
    ProjectType["Brand"] = "brand";
    ProjectType["Marketing"] = "marketing";
    ProjectType["Product"] = "product";
    ProjectType["Social"] = "social";
    ProjectType["Campaign"] = "campaign";
    ProjectType["General"] = "general";
})(ProjectType || (ProjectType = {}));
export class ProjectMemoryEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProjectMemoryEngineError";
    }
}
//# sourceMappingURL=types.js.map