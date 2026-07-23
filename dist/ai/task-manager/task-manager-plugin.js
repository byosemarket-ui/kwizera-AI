export function createTaskManagerPlugin(manager, core) {
    return {
        id: "task-manager",
        name: "KWIZERA AI Task Manager",
        version: "0.1.0",
        async initialize() {
            manager.initialize(core);
        },
        async shutdown() {
            // lightweight — no resources to release in Step 2F
        },
        async healthCheck() {
            return {
                healthy: manager.isInitialized(),
                message: manager.isInitialized()
                    ? "Task Manager operational"
                    : "Task Manager not initialized",
            };
        },
    };
}
//# sourceMappingURL=task-manager-plugin.js.map