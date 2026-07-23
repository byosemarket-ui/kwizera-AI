export class ImageGenerationIntegrationBridge {
    logger;
    core = null;
    memoryFoundation = null;
    knowledgeFoundation = null;
    productIntelligenceFoundation = null;
    imageIntelligenceFoundation = null;
    videoIntelligenceFoundation = null;
    imageGenerationFoundation = null;
    moduleManager = null;
    stateManager = null;
    recoveryEngine = null;
    systemHealthMonitor = null;
    constructor(logger) {
        this.logger = logger;
    }
    connect(core, memoryFoundation, knowledgeFoundation, productIntelligenceFoundation, imageIntelligenceFoundation, videoIntelligenceFoundation, imageGenerationFoundation, moduleManager, stateManager, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.memoryFoundation = memoryFoundation;
        this.knowledgeFoundation = knowledgeFoundation;
        this.productIntelligenceFoundation = productIntelligenceFoundation;
        this.imageIntelligenceFoundation = imageIntelligenceFoundation;
        this.videoIntelligenceFoundation = videoIntelligenceFoundation;
        this.imageGenerationFoundation = imageGenerationFoundation;
        this.moduleManager = moduleManager ?? null;
        this.stateManager = stateManager ?? null;
        this.recoveryEngine = recoveryEngine ?? null;
        this.systemHealthMonitor = systemHealthMonitor ?? null;
        this.logger.log("info", "integration", "Image Generation integration bridge connected", {
            memoryEngine: Boolean(memoryFoundation),
            knowledgeEngine: Boolean(knowledgeFoundation),
            productIntelligenceEngine: Boolean(productIntelligenceFoundation),
            imageIntelligenceEngine: Boolean(imageIntelligenceFoundation),
            videoIntelligenceEngine: Boolean(videoIntelligenceFoundation),
            imageGenerationEngine: Boolean(imageGenerationFoundation),
        });
    }
    getStatus() {
        const status = {
            aiCore: Boolean(this.core?.isReady()),
            memoryEngine: Boolean(this.memoryFoundation?.isStartupComplete()),
            knowledgeEngine: Boolean(this.knowledgeFoundation?.isStartupComplete()),
            productIntelligenceEngine: Boolean(this.productIntelligenceFoundation?.isStartupComplete()),
            imageIntelligenceEngine: Boolean(this.imageIntelligenceFoundation?.isStartupComplete()),
            videoIntelligenceEngine: Boolean(this.videoIntelligenceFoundation?.isStartupComplete()),
            imageGenerationEngine: Boolean(this.imageGenerationFoundation?.isStartupComplete()),
            decisionEngine: Boolean(this.core?.decisionEngine?.isInitialized()),
            reasoningEngine: Boolean(this.core?.reasoningEngine?.isInitialized()),
            planningEngine: Boolean(this.core?.planningEngine?.isInitialized()),
            workflowEngine: Boolean(this.core?.workflowEngine?.isInitialized()),
            stateManager: Boolean(this.stateManager?.isInitialized()),
            recoveryEngine: Boolean(this.recoveryEngine?.isInitialized()),
            healthMonitor: Boolean(this.systemHealthMonitor?.isInitialized()),
            readyCount: 0,
            totalCount: 14,
        };
        const flags = [
            status.aiCore,
            status.memoryEngine,
            status.knowledgeEngine,
            status.productIntelligenceEngine,
            status.imageIntelligenceEngine,
            status.videoIntelligenceEngine,
            status.imageGenerationEngine,
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
            status.videoIntelligenceEngine &&
            status.imageGenerationEngine &&
            status.readyCount >= 12);
    }
    getImageIntelligenceFoundation() {
        return this.imageIntelligenceFoundation;
    }
    getProductIntelligenceFoundation() {
        return this.productIntelligenceFoundation;
    }
    getimageGenerationFoundation() {
        return this.imageGenerationFoundation;
    }
    reportCriticalIssue(issue) {
        this.logger.log("error", "integration", "Critical image generation issue reported", { issue });
        if (this.recoveryEngine) {
            this.logger.log("warn", "integration", "Recovery engine notified of image generation issue", { issue });
        }
        if (this.core) {
            this.logger.log("warn", "integration", "AI Core notified of critical image generation issue", { issue });
        }
    }
}
//# sourceMappingURL=image-generation-integration-bridge.js.map