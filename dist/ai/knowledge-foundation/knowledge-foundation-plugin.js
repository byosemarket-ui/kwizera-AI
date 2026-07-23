export function createKnowledgeFoundationPlugin(foundation, core) {
    return {
        id: "knowledge-engine",
        name: "KWIZERA AI Knowledge Foundation",
        version: "0.1.0",
        async initialize() {
            void core;
            if (!foundation.isInitialized()) {
                throw new Error("Knowledge Foundation must be initialized before plugin registration");
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
                    ? `Knowledge Foundation operational (${report.preparedCategories} categories prepared)`
                    : "Knowledge Foundation not ready",
            };
        },
    };
}
//# sourceMappingURL=knowledge-foundation-plugin.js.map