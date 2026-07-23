export function createRecoveryEnginePlugin(engine, core) {
    return {
        id: "recovery-engine",
        name: "KWIZERA AI Recovery Engine",
        version: "0.1.0",
        async initialize() {
            // wired during AiCoreManager.start before plugin registration
            void core;
            if (!engine.isInitialized()) {
                throw new Error("Recovery Engine must be initialized before plugin registration");
            }
        },
        async shutdown() {
            // lightweight — state persisted by State Manager
        },
        async healthCheck() {
            const report = engine.buildStatusReport();
            return {
                healthy: engine.isInitialized() && report.readinessScore >= 80,
                message: engine.isInitialized()
                    ? `Recovery Engine operational (${report.recoverySuccessRate}% success rate)`
                    : "Recovery Engine not initialized",
            };
        },
    };
}
//# sourceMappingURL=recovery-engine-plugin.js.map