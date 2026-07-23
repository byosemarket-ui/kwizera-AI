export function createHealthMonitorPlugin(monitor, core) {
    return {
        id: "health-monitor",
        name: "KWIZERA AI Health Monitor",
        version: "0.1.0",
        async initialize() {
            void core;
            if (!monitor.isInitialized()) {
                throw new Error("Health Monitor must be initialized before plugin registration");
            }
        },
        async shutdown() {
            // lightweight — monitoring stops with application
        },
        async healthCheck() {
            const report = monitor.buildStatusReport();
            return {
                healthy: monitor.isInitialized() && report.readinessScore >= 80,
                message: monitor.isInitialized()
                    ? `Health Monitor operational — ${report.applicationHealth}`
                    : "Health Monitor not initialized",
            };
        },
    };
}
//# sourceMappingURL=health-monitor-plugin.js.map