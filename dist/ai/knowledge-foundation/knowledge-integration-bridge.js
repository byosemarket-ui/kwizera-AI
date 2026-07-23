/**
 * Integration bridge — prepares interfaces to Core AI systems without implementing new integrations.
 */
export class KnowledgeIntegrationBridge {
    logger;
    core = null;
    memoryFoundation = null;
    moduleManager = null;
    stateManager = null;
    communicationBus = null;
    recoveryEngine = null;
    systemHealthMonitor = null;
    constructor(logger) {
        this.logger = logger;
    }
    connect(core, memoryFoundation, moduleManager, stateManager, communicationBus, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.memoryFoundation = memoryFoundation;
        this.moduleManager = moduleManager ?? null;
        this.stateManager = stateManager ?? null;
        this.communicationBus = communicationBus ?? null;
        this.recoveryEngine = recoveryEngine ?? null;
        this.systemHealthMonitor = systemHealthMonitor ?? null;
        this.logger.log("info", "integration", "Knowledge integration bridge connected", {
            memoryEngine: Boolean(memoryFoundation),
            moduleManager: Boolean(moduleManager),
            communicationBus: Boolean(communicationBus),
        });
    }
    getStatus() {
        const status = {
            aiCore: Boolean(this.core?.isReady()),
            memoryEngine: Boolean(this.memoryFoundation?.isStartupComplete()),
            decisionEngine: Boolean(this.core?.decisionEngine?.isInitialized()),
            reasoningEngine: Boolean(this.core?.reasoningEngine?.isInitialized()),
            planningEngine: Boolean(this.core?.planningEngine?.isInitialized()),
            workflowEngine: Boolean(this.core?.workflowEngine?.isInitialized()),
            communicationBus: Boolean(this.communicationBus?.isInitialized()),
            stateManager: Boolean(this.stateManager?.isInitialized()),
            recoveryEngine: Boolean(this.recoveryEngine?.isInitialized()),
            healthMonitor: Boolean(this.systemHealthMonitor?.isInitialized()),
            readyCount: 0,
            totalCount: 10,
        };
        const flags = [
            status.aiCore,
            status.memoryEngine,
            status.decisionEngine,
            status.reasoningEngine,
            status.planningEngine,
            status.workflowEngine,
            status.communicationBus,
            status.stateManager,
            status.recoveryEngine,
            status.healthMonitor,
        ];
        status.readyCount = flags.filter(Boolean).length;
        return status;
    }
    isIntegrationReady() {
        const status = this.getStatus();
        return status.aiCore && status.memoryEngine && status.readyCount >= 8;
    }
    getMemoryFoundation() {
        return this.memoryFoundation;
    }
    reportCriticalKnowledgeIssue(issue) {
        this.logger.log("error", "integration", "Critical knowledge issue reported to AI Core", {
            issue,
        });
        if (this.recoveryEngine) {
            this.logger.log("warn", "integration", "Recovery engine notified of knowledge issue", {
                issue,
            });
        }
        if (this.core) {
            this.logger.log("warn", "integration", "AI Core notified of critical knowledge health issue", {
                issue,
            });
        }
    }
}
//# sourceMappingURL=knowledge-integration-bridge.js.map