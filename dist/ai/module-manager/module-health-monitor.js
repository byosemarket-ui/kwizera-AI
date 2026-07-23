import { ManagedModuleState, ModuleHealthStatus, } from "./types.js";
export class ModuleHealthMonitor {
    logger;
    errorCounts = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    recordError(moduleId) {
        this.errorCounts.set(moduleId, (this.errorCounts.get(moduleId) ?? 0) + 1);
    }
    async checkModule(record, plugin) {
        const start = Date.now();
        let available = record.enabled;
        let healthStatus = ModuleHealthStatus.Unknown;
        let runtimeErrors = this.errorCounts.get(record.moduleId) ?? 0;
        if (record.status === ManagedModuleState.Failed) {
            healthStatus = ModuleHealthStatus.Unhealthy;
            available = false;
        }
        else if (plugin) {
            try {
                const health = await plugin.healthCheck();
                available = health.healthy;
                healthStatus = health.healthy
                    ? ModuleHealthStatus.Healthy
                    : ModuleHealthStatus.Degraded;
                if (!health.healthy) {
                    runtimeErrors += 1;
                    this.errorCounts.set(record.moduleId, runtimeErrors);
                }
            }
            catch {
                healthStatus = ModuleHealthStatus.Unhealthy;
                available = false;
                runtimeErrors += 1;
                this.errorCounts.set(record.moduleId, runtimeErrors);
            }
        }
        else if (record.status === ManagedModuleState.Registered ||
            record.status === ManagedModuleState.Disabled) {
            healthStatus = ModuleHealthStatus.Unknown;
            available = false;
        }
        const mem = process.memoryUsage();
        const snapshot = {
            moduleId: record.moduleId,
            status: record.status,
            healthStatus,
            cpuUsagePercent: 0,
            memoryUsageMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
            responseTimeMs: Date.now() - start,
            runtimeErrors,
            available,
        };
        record.healthStatus = healthStatus;
        record.lastActivity = new Date().toISOString();
        this.logger.log("info", "health", `Health check: ${record.moduleId}`, {
            healthStatus,
            available,
            responseTimeMs: snapshot.responseTimeMs,
        });
        return snapshot;
    }
    shouldIsolate(snapshot) {
        return (snapshot.healthStatus === ModuleHealthStatus.Unhealthy ||
            snapshot.runtimeErrors >= 3);
    }
}
//# sourceMappingURL=module-health-monitor.js.map