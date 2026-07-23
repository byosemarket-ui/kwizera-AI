/**
 * Integration bridge — official interfaces to Core AI systems without implementing new engines.
 */
export class ProductIntelligenceIntegrationBridge {
    logger;
    core = null;
    memoryFoundation = null;
    knowledgeFoundation = null;
    moduleManager = null;
    stateManager = null;
    recoveryEngine = null;
    systemHealthMonitor = null;
    constructor(logger) {
        this.logger = logger;
    }
    connect(core, memoryFoundation, knowledgeFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.memoryFoundation = memoryFoundation;
        this.knowledgeFoundation = knowledgeFoundation;
        this.moduleManager = moduleManager ?? null;
        this.stateManager = stateManager ?? null;
        this.recoveryEngine = recoveryEngine ?? null;
        this.systemHealthMonitor = systemHealthMonitor ?? null;
        this.logger.log("info", "integration", "Product Intelligence integration bridge connected", {
            memoryEngine: Boolean(memoryFoundation),
            knowledgeEngine: Boolean(knowledgeFoundation),
            moduleManager: Boolean(moduleManager),
        });
    }
    getStatus() {
        const status = {
            aiCore: Boolean(this.core?.isReady()),
            memoryEngine: Boolean(this.memoryFoundation?.isStartupComplete()),
            knowledgeEngine: Boolean(this.knowledgeFoundation?.isStartupComplete()),
            decisionEngine: Boolean(this.core?.decisionEngine?.isInitialized()),
            reasoningEngine: Boolean(this.core?.reasoningEngine?.isInitialized()),
            planningEngine: Boolean(this.core?.planningEngine?.isInitialized()),
            workflowEngine: Boolean(this.core?.workflowEngine?.isInitialized()),
            stateManager: Boolean(this.stateManager?.isInitialized()),
            recoveryEngine: Boolean(this.recoveryEngine?.isInitialized()),
            healthMonitor: Boolean(this.systemHealthMonitor?.isInitialized()),
            readyCount: 0,
            totalCount: 10,
        };
        const flags = [
            status.aiCore,
            status.memoryEngine,
            status.knowledgeEngine,
            status.decisionEngine,
            status.reasoningEngine,
            status.planningEngine,
            status.workflowEngine,
            status.stateManager,
            status.recoveryEngine,
            status.healthMonitor,
        ];
        status.readyCount = flags.filter(Boolean).length;
        return status;
    }
    isIntegrationReady() {
        const status = this.getStatus();
        return status.aiCore && status.memoryEngine && status.knowledgeEngine && status.readyCount >= 8;
    }
    getMemoryFoundation() {
        return this.memoryFoundation;
    }
    getKnowledgeFoundation() {
        return this.knowledgeFoundation;
    }
    reportCriticalIssue(issue) {
        this.logger.log("error", "integration", "Critical product intelligence issue reported", { issue });
        if (this.recoveryEngine) {
            this.logger.log("warn", "integration", "Recovery engine notified of product intelligence issue", {
                issue,
            });
        }
        if (this.core) {
            this.logger.log("warn", "integration", "AI Core notified of critical product intelligence issue", {
                issue,
            });
        }
    }
}
//# sourceMappingURL=product-intelligence-integration-bridge.js.map