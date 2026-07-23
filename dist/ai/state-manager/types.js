/**
 * KWIZERA AI STUDIO — AI State Manager types (Step 2I)
 */
export var ApplicationState;
(function (ApplicationState) {
    ApplicationState["Starting"] = "starting";
    ApplicationState["Loading"] = "loading";
    ApplicationState["Ready"] = "ready";
    ApplicationState["Running"] = "running";
    ApplicationState["Paused"] = "paused";
    ApplicationState["Updating"] = "updating";
    ApplicationState["Recovering"] = "recovering";
    ApplicationState["Stopping"] = "stopping";
    ApplicationState["Stopped"] = "stopped";
})(ApplicationState || (ApplicationState = {}));
export var WorkflowStateManaged;
(function (WorkflowStateManaged) {
    WorkflowStateManaged["Created"] = "created";
    WorkflowStateManaged["Running"] = "running";
    WorkflowStateManaged["Waiting"] = "waiting";
    WorkflowStateManaged["Paused"] = "paused";
    WorkflowStateManaged["Completed"] = "completed";
    WorkflowStateManaged["Failed"] = "failed";
    WorkflowStateManaged["Recovered"] = "recovered";
})(WorkflowStateManaged || (WorkflowStateManaged = {}));
export var TaskStateManaged;
(function (TaskStateManaged) {
    TaskStateManaged["Queued"] = "queued";
    TaskStateManaged["Running"] = "running";
    TaskStateManaged["Retrying"] = "retrying";
    TaskStateManaged["Completed"] = "completed";
    TaskStateManaged["Cancelled"] = "cancelled";
    TaskStateManaged["Failed"] = "failed";
    TaskStateManaged["Recovered"] = "recovered";
})(TaskStateManaged || (TaskStateManaged = {}));
export var ProjectState;
(function (ProjectState) {
    ProjectState["New"] = "new";
    ProjectState["Open"] = "open";
    ProjectState["Modified"] = "modified";
    ProjectState["Saving"] = "saving";
    ProjectState["Saved"] = "saved";
    ProjectState["Exporting"] = "exporting";
    ProjectState["Completed"] = "completed";
    ProjectState["Archived"] = "archived";
})(ProjectState || (ProjectState = {}));
export var SessionStateManaged;
(function (SessionStateManaged) {
    SessionStateManaged["Created"] = "created";
    SessionStateManaged["Active"] = "active";
    SessionStateManaged["Idle"] = "idle";
    SessionStateManaged["Paused"] = "paused";
    SessionStateManaged["Expired"] = "expired";
    SessionStateManaged["Closed"] = "closed";
})(SessionStateManaged || (SessionStateManaged = {}));
export var SystemState;
(function (SystemState) {
    SystemState["Operational"] = "operational";
    SystemState["Degraded"] = "degraded";
    SystemState["Maintenance"] = "maintenance";
    SystemState["Recovery"] = "recovery";
    SystemState["Offline"] = "offline";
})(SystemState || (SystemState = {}));
export class StateManagerError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "StateManagerError";
    }
}
//# sourceMappingURL=types.js.map