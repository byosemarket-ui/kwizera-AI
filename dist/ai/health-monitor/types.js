/**
 * KWIZERA AI STUDIO — AI Health Monitor types (Step 2K)
 */
export var SystemHealthLevel;
(function (SystemHealthLevel) {
    SystemHealthLevel["Excellent"] = "excellent";
    SystemHealthLevel["Good"] = "good";
    SystemHealthLevel["Warning"] = "warning";
    SystemHealthLevel["Critical"] = "critical";
    SystemHealthLevel["Failed"] = "failed";
})(SystemHealthLevel || (SystemHealthLevel = {}));
export var HealthCheckCategory;
(function (HealthCheckCategory) {
    HealthCheckCategory["Application"] = "application";
    HealthCheckCategory["Module"] = "module";
    HealthCheckCategory["Database"] = "database";
    HealthCheckCategory["Storage"] = "storage";
    HealthCheckCategory["Configuration"] = "configuration";
    HealthCheckCategory["Runtime"] = "runtime";
    HealthCheckCategory["Communication"] = "communication";
    HealthCheckCategory["Memory"] = "memory";
    HealthCheckCategory["Cpu"] = "cpu";
    HealthCheckCategory["Disk"] = "disk";
    HealthCheckCategory["Queue"] = "queue";
    HealthCheckCategory["Task"] = "task";
    HealthCheckCategory["Workflow"] = "workflow";
    HealthCheckCategory["Project"] = "project";
    HealthCheckCategory["Session"] = "session";
})(HealthCheckCategory || (HealthCheckCategory = {}));
export class HealthMonitorError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "HealthMonitorError";
    }
}
//# sourceMappingURL=types.js.map