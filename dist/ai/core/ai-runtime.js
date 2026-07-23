/**
 * Lightweight runtime shell — no business logic, no future module dependencies.
 */
export class AiRuntime {
    state = {
        initialized: false,
        workflowReady: false,
    };
    prepare(config, contextManager, logger) {
        contextManager.setMetadata("applicationVersion", config.application.applicationVersion);
        contextManager.setMetadata("assistantName", config.application.assistantName);
        contextManager.setMetadata("storageRoot", config.storage.storageRoot);
        this.state = {
            initialized: true,
            preparedAt: new Date().toISOString(),
            workflowReady: true,
        };
        logger.info("initialization", "AI Runtime prepared for future workflow execution");
    }
    getState() {
        return this.state;
    }
    isInitialized() {
        return this.state.initialized;
    }
    isWorkflowReady() {
        return this.state.workflowReady;
    }
    reset() {
        this.state = { initialized: false, workflowReady: false };
    }
}
//# sourceMappingURL=ai-runtime.js.map