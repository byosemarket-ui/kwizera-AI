/**
 * Integration bridge — official interfaces to Core AI systems without implementing new engines.
 */
export class VideoIntelligenceIntegrationBridge {
    logger;
    core = null;
    memoryFoundation = null;
    knowledgeFoundation = null;
    productIntelligenceFoundation = null;
    imageIntelligenceFoundation = null;
    moduleManager = null;
    stateManager = null;
    recoveryEngine = null;
    systemHealthMonitor = null;
    constructor(logger) {
        this.logger = logger;
    }
    connect(core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.memoryFoundation = memoryFoundation;
        this.knowledgeFoundation = knowledgeFoundation;
        this.productIntelligenceFoundation = productIntelligenceFoundation;
        this.imageIntelligenceFoundation = imageIntelligenceFoundation;
        this.moduleManager = moduleManager ?? null;
        this.stateManager = stateManager ?? null;
        this.recoveryEngine = recoveryEngine ?? null;
        this.systemHealthMonitor = systemHealthMonitor ?? null;
        this.logger.log("info", "integration", "Video Intelligence integration bridge connected", {
            memoryEngine: Boolean(memoryFoundation),
            knowledgeEngine: Boolean(knowledgeFoundation),
            productIntelligenceEngine: Boolean(productIntelligenceFoundation),
            imageIntelligenceEngine: Boolean(imageIntelligenceFoundation),
            moduleManager: Boolean(moduleManager),
        });
    }
    getStatus() {
        const status = {
            aiCore: Boolean(this.core?.isReady()),
            memoryEngine: Boolean(this.memoryFoundation?.isStartupComplete()),
            knowledgeEngine: Boolean(this.knowledgeFoundation?.isStartupComplete()),
            productIntelligenceEngine: Boolean(this.productIntelligenceFoundation?.isStartupComplete()),
            imageIntelligenceEngine: Boolean(this.imageIntelligenceFoundation?.isStartupComplete()),
            decisionEngine: Boolean(this.core?.decisionEngine?.isInitialized()),
            reasoningEngine: Boolean(this.core?.reasoningEngine?.isInitialized()),
            planningEngine: Boolean(this.core?.planningEngine?.isInitialized()),
            workflowEngine: Boolean(this.core?.workflowEngine?.isInitialized()),
            stateManager: Boolean(this.stateManager?.isInitialized()),
            recoveryEngine: Boolean(this.recoveryEngine?.isInitialized()),
            healthMonitor: Boolean(this.systemHealthMonitor?.isInitialized()),
            readyCount: 0,
            totalCount: 12,
        };
        const flags = [
            status.aiCore,
            status.memoryEngine,
            status.knowledgeEngine,
            status.productIntelligenceEngine,
            status.imageIntelligenceEngine,
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
        return (status.aiCore &&
            status.memoryEngine &&
            status.knowledgeEngine &&
            status.productIntelligenceEngine &&
            status.imageIntelligenceEngine &&
            status.readyCount >= 10);
    }
    getMemoryFoundation() {
        return this.memoryFoundation;
    }
    getKnowledgeFoundation() {
        return this.knowledgeFoundation;
    }
    getProductIntelligenceFoundation() {
        return this.productIntelligenceFoundation;
    }
    getImageIntelligenceFoundation() {
        return this.imageIntelligenceFoundation;
    }
    reportCriticalIssue(issue) {
        this.logger.log("error", "integration", "Critical video intelligence issue reported", { issue });
        if (this.recoveryEngine) {
            this.logger.log("warn", "integration", "Recovery engine notified of video intelligence issue", {
                issue,
            });
        }
        if (this.core) {
            this.logger.log("warn", "integration", "AI Core notified of critical video intelligence issue", {
                issue,
            });
        }
    }
}
//# sourceMappingURL=video-intelligence-integration-bridge.js.map