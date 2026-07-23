export function createPlanningEnginePlugin(engine, core) {
    return {
        id: "planning-engine",
        name: "KWIZERA AI Planning Engine",
        version: "0.1.0",
        async initialize() {
            engine.initialize(core);
        },
        async shutdown() {
            // lightweight — no resources to release in Step 2D
        },
        async healthCheck() {
            return {
                healthy: engine.isInitialized(),
                message: engine.isInitialized()
                    ? "Planning Engine operational"
                    : "Planning Engine not initialized",
            };
        },
    };
}
//# sourceMappingURL=planning-engine-plugin.js.map