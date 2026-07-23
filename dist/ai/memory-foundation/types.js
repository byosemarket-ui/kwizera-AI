/**
 * KWIZERA AI STUDIO — Persistent Memory Foundation types (Step 3A)
 */
export var MemoryLifecycleState;
(function (MemoryLifecycleState) {
    MemoryLifecycleState["Initializing"] = "initializing";
    MemoryLifecycleState["Loading"] = "loading";
    MemoryLifecycleState["Ready"] = "ready";
    MemoryLifecycleState["Reading"] = "reading";
    MemoryLifecycleState["Writing"] = "writing";
    MemoryLifecycleState["Updating"] = "updating";
    MemoryLifecycleState["BackingUp"] = "backing-up";
    MemoryLifecycleState["Recovering"] = "recovering";
    MemoryLifecycleState["Optimizing"] = "optimizing";
    MemoryLifecycleState["Closing"] = "closing";
    MemoryLifecycleState["Closed"] = "closed";
})(MemoryLifecycleState || (MemoryLifecycleState = {}));
export var MemoryCategory;
(function (MemoryCategory) {
    MemoryCategory["Persistent"] = "persistent-memory";
    MemoryCategory["Project"] = "project-memory";
    MemoryCategory["Product"] = "product-memory";
    MemoryCategory["Video"] = "video-memory";
    MemoryCategory["Marketing"] = "marketing-memory";
    MemoryCategory["Knowledge"] = "knowledge-memory";
    MemoryCategory["Language"] = "language-memory";
    MemoryCategory["Learning"] = "learning-memory";
    MemoryCategory["UserPreference"] = "user-preference-memory";
    MemoryCategory["Workflow"] = "workflow-memory";
    MemoryCategory["Decision"] = "decision-memory";
    MemoryCategory["Reasoning"] = "reasoning-memory";
})(MemoryCategory || (MemoryCategory = {}));
export var MemoryModuleStatus;
(function (MemoryModuleStatus) {
    MemoryModuleStatus["Prepared"] = "prepared";
    MemoryModuleStatus["Registered"] = "registered";
    MemoryModuleStatus["Active"] = "active";
    MemoryModuleStatus["Disabled"] = "disabled";
    MemoryModuleStatus["Recovering"] = "recovering";
    MemoryModuleStatus["Failed"] = "failed";
})(MemoryModuleStatus || (MemoryModuleStatus = {}));
export var MemoryHealthLevel;
(function (MemoryHealthLevel) {
    MemoryHealthLevel["Excellent"] = "excellent";
    MemoryHealthLevel["Good"] = "good";
    MemoryHealthLevel["Warning"] = "warning";
    MemoryHealthLevel["Critical"] = "critical";
    MemoryHealthLevel["Failed"] = "failed";
})(MemoryHealthLevel || (MemoryHealthLevel = {}));
export var MemoryAccessPermission;
(function (MemoryAccessPermission) {
    MemoryAccessPermission["Read"] = "read";
    MemoryAccessPermission["Write"] = "write";
    MemoryAccessPermission["Update"] = "update";
    MemoryAccessPermission["Delete"] = "delete";
    MemoryAccessPermission["Admin"] = "admin";
})(MemoryAccessPermission || (MemoryAccessPermission = {}));
export var MemoryAccessOperation;
(function (MemoryAccessOperation) {
    MemoryAccessOperation["Read"] = "read";
    MemoryAccessOperation["Write"] = "write";
    MemoryAccessOperation["Update"] = "update";
    MemoryAccessOperation["Delete"] = "delete";
    MemoryAccessOperation["Backup"] = "backup";
    MemoryAccessOperation["Recover"] = "recover";
})(MemoryAccessOperation || (MemoryAccessOperation = {}));
export class MemoryFoundationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryFoundationError";
    }
}
//# sourceMappingURL=types.js.map