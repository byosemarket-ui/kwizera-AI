/**
 * KWIZERA AI STUDIO — AI Module Manager types (Step 2G)
 */
export var ManagedModuleState;
(function (ManagedModuleState) {
    ManagedModuleState["Registered"] = "registered";
    ManagedModuleState["Initializing"] = "initializing";
    ManagedModuleState["Loading"] = "loading";
    ManagedModuleState["Ready"] = "ready";
    ManagedModuleState["Running"] = "running";
    ManagedModuleState["Paused"] = "paused";
    ManagedModuleState["Recovering"] = "recovering";
    ManagedModuleState["Restarting"] = "restarting";
    ManagedModuleState["Stopping"] = "stopping";
    ManagedModuleState["Stopped"] = "stopped";
    ManagedModuleState["Disabled"] = "disabled";
    ManagedModuleState["Failed"] = "failed";
    ManagedModuleState["Removed"] = "removed";
})(ManagedModuleState || (ManagedModuleState = {}));
export var ModuleHealthStatus;
(function (ModuleHealthStatus) {
    ModuleHealthStatus["Healthy"] = "healthy";
    ModuleHealthStatus["Degraded"] = "degraded";
    ModuleHealthStatus["Unhealthy"] = "unhealthy";
    ModuleHealthStatus["Isolated"] = "isolated";
    ModuleHealthStatus["Unknown"] = "unknown";
})(ModuleHealthStatus || (ModuleHealthStatus = {}));
export class ModuleManagerError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ModuleManagerError";
    }
}
//# sourceMappingURL=types.js.map