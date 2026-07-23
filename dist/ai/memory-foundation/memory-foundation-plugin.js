export function createMemoryFoundationPlugin(foundation, core) {
    return {
        id: "memory-engine",
        name: "KWIZERA AI Persistent Memory Foundation",
        version: "0.1.0",
        async initialize() {
            void core;
            if (!foundation.isInitialized()) {
                throw new Error("Memory Foundation must be initialized before plugin registration");
            }
        },
        async shutdown() {
            await foundation.shutdown();
        },
        async healthCheck() {
            const report = foundation.buildStatusReport();
            return {
                healthy: foundation.isStartupComplete() && report.readinessScore >= 80,
                message: foundation.isStartupComplete()
                    ? `Memory Foundation operational (${report.preparedCategories} categories prepared)`
                    : "Memory Foundation not ready",
            };
        },
    };
}
//# sourceMappingURL=memory-foundation-plugin.js.map