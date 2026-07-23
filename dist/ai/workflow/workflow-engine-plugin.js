export function createWorkflowEnginePlugin(engine, core) {
    return {
        id: "workflow-engine",
        name: "KWIZERA AI Workflow Engine",
        version: "0.1.0",
        async initialize() {
            engine.initialize(core);
        },
        async shutdown() {
            // lightweight — no resources to release in Step 2E
        },
        async healthCheck() {
            return {
                healthy: engine.isInitialized(),
                message: engine.isInitialized()
                    ? "Workflow Engine operational"
                    : "Workflow Engine not initialized",
            };
        },
    };
}
//# sourceMappingURL=workflow-engine-plugin.js.map