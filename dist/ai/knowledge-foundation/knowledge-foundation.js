import path from "node:path";
import { KnowledgeAccessCoordinator } from "./knowledge-access-coordinator.js";
import { KnowledgeHealthMonitor } from "./knowledge-health-monitor.js";
import { KnowledgeHistoryStore } from "./knowledge-history-store.js";
import { KnowledgeIntegrityVerifier } from "./knowledge-integrity-verifier.js";
import { KnowledgeIntegrationBridge } from "./knowledge-integration-bridge.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeQualityValidator } from "./knowledge-quality-validator.js";
import { KnowledgeRegistry } from "./knowledge-registry.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";
import { AiKnowledgeStorageEngine } from "../knowledge-storage-engine/knowledge-storage-engine.js";
import { AiKnowledgeRetrievalEngine } from "../knowledge-retrieval-engine/knowledge-retrieval-engine.js";
import { AiKnowledgeGraphEngine } from "../knowledge-graph-engine/knowledge-graph-engine.js";
import { AiImageKnowledgeEngine } from "../image-knowledge-engine/image-knowledge-engine.js";
import { AiVideoKnowledgeEngine } from "../video-knowledge-engine/video-knowledge-engine.js";
import { AiMarketingKnowledgeEngine } from "../marketing-knowledge-engine/marketing-knowledge-engine.js";
import { AiProductKnowledgeEngine } from "../product-knowledge-engine/product-knowledge-engine.js";
import { AiBrandKnowledgeEngine } from "../brand-knowledge-engine/brand-knowledge-engine.js";
import { AiLanguageKnowledgeEngine } from "../language-knowledge-engine/language-knowledge-engine.js";
import { AiCreativeKnowledgeEngine } from "../creative-knowledge-engine/creative-knowledge-engine.js";
import { AiKnowledgeOptimizationEngine } from "../knowledge-optimization-engine/knowledge-optimization-engine.js";
import { AiKnowledgeValidationEngine } from "../knowledge-validation-engine/knowledge-validation-engine.js";
import { AiKnowledgeHealthMonitorEngine } from "../knowledge-health-monitor-engine/knowledge-health-monitor-engine.js";
import { PREPARED_KNOWLEDGE_CATEGORIES } from "./knowledge-categories.js";
import { KnowledgeFoundationError, KnowledgeHealthLevel, KnowledgeLifecycleState, KnowledgeModuleStatus, } from "./types.js";
/**
 * Knowledge Foundation — central intelligence layer for KWIZERA AI STUDIO.
 * Memory stores experience. Knowledge understands experience.
 */
export class AiKnowledgeFoundation {
    core = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    lifecycleState = KnowledgeLifecycleState.Initializing;
    startupMs = 0;
    lastIntegrity = null;
    lastHealth = null;
    logger = new KnowledgeFoundationLogger();
    history = new KnowledgeHistoryStore();
    integration = new KnowledgeIntegrationBridge(this.logger);
    storage = new KnowledgeStorageManager(this.logger);
    registry = new KnowledgeRegistry(this.logger);
    integrityVerifier = new KnowledgeIntegrityVerifier(this.logger);
    healthMonitor = new KnowledgeHealthMonitor(this.logger);
    accessCoordinator = null;
    qualityValidator = null;
    storageEngine = new AiKnowledgeStorageEngine();
    retrievalEngine = new AiKnowledgeRetrievalEngine();
    graphEngine = new AiKnowledgeGraphEngine();
    imageKnowledgeEngine = new AiImageKnowledgeEngine();
    videoKnowledgeEngine = new AiVideoKnowledgeEngine();
    marketingKnowledgeEngine = new AiMarketingKnowledgeEngine();
    productKnowledgeEngine = new AiProductKnowledgeEngine();
    brandKnowledgeEngine = new AiBrandKnowledgeEngine();
    languageKnowledgeEngine = new AiLanguageKnowledgeEngine();
    creativeKnowledgeEngine = new AiCreativeKnowledgeEngine();
    knowledgeOptimizationEngine = new AiKnowledgeOptimizationEngine();
    knowledgeValidationEngine = new AiKnowledgeValidationEngine();
    knowledgeHealthMonitorEngine = new AiKnowledgeHealthMonitorEngine();
    initialize(core, storageRoot, memoryFoundation, moduleManager, stateManager, communicationBus, recoveryEngine, systemHealthMonitor) {
        this.core = core;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.lifecycleState = KnowledgeLifecycleState.Initializing;
        this.logger.log("info", "startup", "Knowledge Foundation initializing", { storageRoot });
        const knowledgeRoot = this.storage.initialize(storageRoot);
        this.history.initialize(knowledgeRoot);
        this.registry.initialize(this.storage, storageRoot);
        this.accessCoordinator = new KnowledgeAccessCoordinator(this.logger, this.history, this.registry, this.storage);
        this.qualityValidator = new KnowledgeQualityValidator(this.logger, this.registry);
        this.integration.connect(core, memoryFoundation, moduleManager, stateManager, communicationBus, recoveryEngine, systemHealthMonitor);
        this.integrityVerifier.writeManifest(this.storage, storageRoot);
        this.initialized = true;
        this.lifecycleState = KnowledgeLifecycleState.Loading;
        this.logger.log("info", "startup", "Knowledge Foundation initialized", { knowledgeRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.lifecycleState = KnowledgeLifecycleState.Loading;
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        if (!this.lastIntegrity.verified && this.lastIntegrity.issues.length > 0) {
            this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
            this.registry.persist();
            this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        }
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.integration.isIntegrationReady());
        this.registry.persist();
        this.storageEngine.initialize(this, this.storageRoot, this.storage.getKnowledgeRoot());
        await this.storageEngine.runStartup();
        this.retrievalEngine.initialize(this, this.storageRoot);
        await this.retrievalEngine.runStartup();
        this.graphEngine.initialize(this, this.storageRoot);
        await this.graphEngine.runStartup();
        this.imageKnowledgeEngine.initialize(this, this.storageRoot);
        await this.imageKnowledgeEngine.runStartup();
        this.videoKnowledgeEngine.initialize(this, this.storageRoot);
        await this.videoKnowledgeEngine.runStartup();
        this.marketingKnowledgeEngine.initialize(this, this.storageRoot);
        await this.marketingKnowledgeEngine.runStartup();
        this.productKnowledgeEngine.initialize(this, this.storageRoot);
        await this.productKnowledgeEngine.runStartup();
        this.brandKnowledgeEngine.initialize(this, this.storageRoot);
        await this.brandKnowledgeEngine.runStartup();
        this.languageKnowledgeEngine.initialize(this, this.storageRoot);
        await this.languageKnowledgeEngine.runStartup();
        this.creativeKnowledgeEngine.initialize(this, this.storageRoot);
        await this.creativeKnowledgeEngine.runStartup();
        this.knowledgeOptimizationEngine.initialize(this, this.storageRoot);
        await this.knowledgeOptimizationEngine.runStartup();
        this.knowledgeValidationEngine.initialize(this, this.storageRoot);
        await this.knowledgeValidationEngine.runStartup();
        this.knowledgeHealthMonitorEngine.initialize(this, this.storageRoot);
        await this.knowledgeHealthMonitorEngine.runStartup();
        this.storageEngine.setRecordChangeHandler((knowledgeId, operation) => {
            void this.graphEngine.evolveGraph(knowledgeId);
            void this.knowledgeValidationEngine.handleKnowledgeChange(knowledgeId, operation);
        });
        this.startupMs = Date.now() - start;
        this.startupComplete = true;
        this.lifecycleState = KnowledgeLifecycleState.Ready;
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "startup",
            success: true,
            detail: `Knowledge Foundation ready in ${this.startupMs}ms`,
        });
        this.logger.log("info", "startup", "Knowledge Foundation startup complete", {
            startupMs: this.startupMs,
            categories: this.registry.getPreparedCount(),
            healthScore: this.lastHealth.score,
            integrationReady: this.integration.isIntegrationReady(),
            storageRecords: this.storageEngine.getRecordCount(),
            retrievalEngine: "operational",
            graphEngine: "operational",
            imageKnowledgeEngine: "operational",
            videoKnowledgeEngine: "operational",
            marketingKnowledgeEngine: "operational",
            productKnowledgeEngine: "operational",
            brandKnowledgeEngine: "operational",
            languageKnowledgeEngine: "operational",
            creativeKnowledgeEngine: "operational",
            knowledgeOptimizationEngine: "operational",
            knowledgeValidationEngine: "operational",
            knowledgeHealthMonitorEngine: "operational",
        });
    }
    async requestAccess(request) {
        this.ensureReady();
        this.lifecycleState = KnowledgeLifecycleState.Reading;
        try {
            return await this.accessCoordinator.requestAccess(request);
        }
        finally {
            this.lifecycleState = KnowledgeLifecycleState.Ready;
        }
    }
    registerKnowledgeModule(registration) {
        this.ensureReady();
        const full = {
            ...registration,
            healthStatus: this.lastHealth?.level ?? KnowledgeHealthLevel.Good,
            lastUpdate: new Date().toISOString(),
            status: KnowledgeModuleStatus.Registered,
        };
        this.registry.registerModule(full);
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "registration",
            category: registration.category,
            success: true,
            detail: `Registered ${registration.knowledgeId}`,
        });
    }
    validateKnowledge(metadata) {
        this.ensureReady();
        this.lifecycleState = KnowledgeLifecycleState.Validating;
        try {
            const result = this.qualityValidator.validateMetadata(metadata);
            this.history.append({
                timestamp: new Date().toISOString(),
                event: "validation",
                success: result.valid,
                durationMs: result.durationMs,
                detail: `Quality ${result.qualityScore}, confidence ${result.confidenceScore}`,
            });
            return result;
        }
        finally {
            this.lifecycleState = KnowledgeLifecycleState.Ready;
        }
    }
    validateModule(knowledgeId) {
        this.ensureReady();
        return this.qualityValidator.validateModule(knowledgeId);
    }
    refreshIntegration(memoryFoundation, moduleManager, stateManager, communicationBus, recoveryEngine, systemHealthMonitor) {
        if (!this.core)
            return;
        this.integration.connect(this.core, memoryFoundation, moduleManager, stateManager, communicationBus, recoveryEngine, systemHealthMonitor);
    }
    async runHealthCheck() {
        this.ensureReady();
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.integration.isIntegrationReady());
        return this.lastHealth;
    }
    async recover() {
        this.ensureReady();
        this.lifecycleState = KnowledgeLifecycleState.Recovering;
        this.logger.log("info", "recovery", "Knowledge recovery initiated");
        this.registry.initialize(this.storage, this.storageRoot);
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator, this.integration.isIntegrationReady());
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "recovery",
            success: this.lastIntegrity.verified,
            detail: "Knowledge recovery complete",
        });
        this.lifecycleState = KnowledgeLifecycleState.Ready;
        this.logger.log("info", "recovery", "Knowledge recovery complete", {
            verified: this.lastIntegrity.verified,
        });
    }
    async shutdown() {
        if (!this.initialized)
            return;
        this.lifecycleState = KnowledgeLifecycleState.Closing;
        this.registry.persist();
        this.lifecycleState = KnowledgeLifecycleState.Closed;
        this.logger.log("info", "shutdown", "Knowledge Foundation shut down");
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "shutdown",
            success: true,
            detail: "Knowledge Foundation shut down",
        });
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    getLifecycleState() {
        return this.lifecycleState;
    }
    getKnowledgeRoot() {
        return this.storage.getKnowledgeRoot();
    }
    getStorageEngine() {
        return this.storageEngine;
    }
    getRetrievalEngine() {
        return this.retrievalEngine;
    }
    getGraphEngine() {
        return this.graphEngine;
    }
    getImageKnowledgeEngine() {
        return this.imageKnowledgeEngine;
    }
    getVideoKnowledgeEngine() {
        return this.videoKnowledgeEngine;
    }
    getMarketingKnowledgeEngine() {
        return this.marketingKnowledgeEngine;
    }
    getProductKnowledgeEngine() {
        return this.productKnowledgeEngine;
    }
    getBrandKnowledgeEngine() {
        return this.brandKnowledgeEngine;
    }
    getLanguageKnowledgeEngine() {
        return this.languageKnowledgeEngine;
    }
    getCreativeKnowledgeEngine() {
        return this.creativeKnowledgeEngine;
    }
    getKnowledgeOptimizationEngine() {
        return this.knowledgeOptimizationEngine;
    }
    getKnowledgeValidationEngine() {
        return this.knowledgeValidationEngine;
    }
    getKnowledgeHealthMonitorEngine() {
        return this.knowledgeHealthMonitorEngine;
    }
    getRegistry() {
        return this.registry;
    }
    getLastIntegrityResult() {
        return this.lastIntegrity;
    }
    getLastHealthReport() {
        return this.lastHealth;
    }
    getPreparedCategoryCount() {
        return PREPARED_KNOWLEDGE_CATEGORIES.length;
    }
    buildStatusReport() {
        const persistence = this.storage.verifyPersistence();
        const knownIssues = [];
        if (this.lastIntegrity && !this.lastIntegrity.verified) {
            knownIssues.push(...this.lastIntegrity.issues);
        }
        if (this.lastHealth && this.lastHealth.issues.length > 0) {
            knownIssues.push(...this.lastHealth.issues);
        }
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 30;
        if (!persistence.passed)
            readinessScore -= 20;
        if (this.lastIntegrity && !this.lastIntegrity.verified)
            readinessScore -= 15;
        if (this.lastHealth && this.lastHealth.score < 80)
            readinessScore -= 10;
        if (!this.integration.isIntegrationReady())
            readinessScore -= 5;
        readinessScore = Math.max(0, readinessScore);
        return {
            foundationStatus: this.startupComplete ? "operational" : "initializing",
            lifecycleState: this.lifecycleState,
            registryStatus: `${this.registry.getPreparedCount()} categories prepared, ${this.registry.getRegisteredCount()} registered`,
            storageStatus: persistence.passed ? "persistent storage verified" : persistence.detail,
            persistenceStatus: persistence.passed ? "survives restart" : "persistence unverified",
            integrityStatus: this.lastIntegrity?.verified ? "verified" : "issues detected",
            healthLevel: this.lastHealth?.level ?? KnowledgeHealthLevel.Good,
            integrationStatus: this.integration.getStatus(),
            registeredModules: this.registry.getRegisteredCount(),
            preparedCategories: this.registry.getPreparedCount(),
            performance: {
                startupMs: this.startupMs,
                averageReadMs: this.accessCoordinator?.getAverageReadMs() ?? 0,
                averageWriteMs: this.accessCoordinator?.getAverageWriteMs() ?? 0,
                averageValidationMs: this.qualityValidator?.getAverageValidationMs() ?? 0,
                totalAccessRequests: this.accessCoordinator?.getTotalRequests() ?? 0,
            },
            knownIssues,
            readinessScore,
            timestamp: new Date().toISOString(),
        };
    }
    ensureReady() {
        if (!this.initialized || !this.accessCoordinator || !this.qualityValidator) {
            throw new KnowledgeFoundationError("Knowledge Foundation not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=knowledge-foundation.js.map