import path from "node:path";
import { IntegrityVerifier } from "./integrity-verifier.js";
import { MemoryAccessCoordinator } from "./memory-access-coordinator.js";
import { MemoryBackupManager } from "./memory-backup-manager.js";
import { MemoryHealthMonitor } from "./memory-health-monitor.js";
import { MemoryHistoryStore } from "./memory-history-store.js";
import { MemoryFoundationLogger } from "./memory-logger.js";
import { MemoryRegistry } from "./memory-registry.js";
import { MemoryStorageManager } from "./memory-storage.js";
import { AiMemoryStorageEngine } from "../memory-storage-engine/memory-storage-engine.js";
import { AiMemoryRetrievalEngine } from "../memory-retrieval-engine/memory-retrieval-engine.js";
import { AiMemoryIndexEngine } from "../memory-index-engine/memory-index-engine.js";
import { AiLearningMemoryEngine } from "../learning-memory-engine/learning-memory-engine.js";
import { AiProjectMemoryEngine } from "../project-memory-engine/project-memory-engine.js";
import { AiVideoMemoryEngine } from "../video-memory-engine/video-memory-engine.js";
import { AiMarketingMemoryEngine } from "../marketing-memory-engine/marketing-memory-engine.js";
import { AiProductMemoryEngine } from "../product-memory-engine/product-memory-engine.js";
import { AiRelationshipMemoryEngine } from "../relationship-memory-engine/relationship-memory-engine.js";
import { AiMemoryOptimizationEngine } from "../memory-optimization-engine/memory-optimization-engine.js";
import { AiMemoryBackupEngine } from "../memory-backup-engine/memory-backup-engine.js";
import { AiMemoryRecoveryEngine } from "../memory-recovery-engine/memory-recovery-engine.js";
import { AiMemoryHealthMonitorEngine } from "../memory-health-monitor-engine/memory-health-monitor-engine.js";
import { PROTECTED_DATA_CATEGORIES } from "./memory-categories.js";
import { MemoryFoundationError, MemoryHealthLevel, MemoryLifecycleState, MemoryModuleStatus, } from "./types.js";
/**
 * Persistent Memory Foundation — central memory system for KWIZERA AI STUDIO.
 * All future memory modules must register and access memory through this foundation.
 */
export class AiMemoryFoundation {
    core = null;
    moduleManager = null;
    stateManager = null;
    communicationBus = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    lifecycleState = MemoryLifecycleState.Initializing;
    startupMs = 0;
    lastIntegrity = null;
    lastHealth = null;
    logger = new MemoryFoundationLogger();
    history = new MemoryHistoryStore();
    storage = new MemoryStorageManager(this.logger);
    registry = new MemoryRegistry(this.logger);
    integrityVerifier = new IntegrityVerifier(this.logger);
    backupManager = new MemoryBackupManager(this.logger);
    healthMonitor = new MemoryHealthMonitor(this.logger);
    accessCoordinator = null;
    storageEngine = new AiMemoryStorageEngine();
    indexEngine = new AiMemoryIndexEngine();
    retrievalEngine = new AiMemoryRetrievalEngine();
    learningMemoryEngine = new AiLearningMemoryEngine();
    projectMemoryEngine = new AiProjectMemoryEngine();
    videoMemoryEngine = new AiVideoMemoryEngine();
    marketingMemoryEngine = new AiMarketingMemoryEngine();
    productMemoryEngine = new AiProductMemoryEngine();
    relationshipMemoryEngine = new AiRelationshipMemoryEngine();
    memoryOptimizationEngine = new AiMemoryOptimizationEngine();
    memoryBackupEngine = new AiMemoryBackupEngine();
    memoryRecoveryEngine = new AiMemoryRecoveryEngine();
    memoryHealthMonitorEngine = new AiMemoryHealthMonitorEngine();
    initialize(core, storageRoot, moduleManager, stateManager, communicationBus) {
        this.core = core;
        this.storageRoot = storageRoot;
        this.moduleManager = moduleManager ?? null;
        this.stateManager = stateManager ?? null;
        this.communicationBus = communicationBus ?? null;
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.lifecycleState = MemoryLifecycleState.Initializing;
        this.logger.log("info", "startup", "Memory Foundation initializing", { storageRoot });
        const memoryRoot = this.storage.initialize(storageRoot);
        this.history.initialize(memoryRoot);
        this.registry.initialize(this.storage, storageRoot);
        this.accessCoordinator = new MemoryAccessCoordinator(this.logger, this.history, this.registry, this.storage);
        this.integrityVerifier.writeManifest(this.storage, storageRoot);
        this.initialized = true;
        this.lifecycleState = MemoryLifecycleState.Loading;
        this.logger.log("info", "startup", "Memory Foundation initialized", { memoryRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.lifecycleState = MemoryLifecycleState.Loading;
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        if (!this.lastIntegrity.verified && this.lastIntegrity.issues.length > 0) {
            this.integrityVerifier.writeManifest(this.storage, this.storageRoot);
            this.registry.persist();
            this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        }
        this.backupManager.createBackup(this.storage, "startup");
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator);
        this.registry.persist();
        this.storageEngine.initialize(this, this.storageRoot, this.storage.getMemoryRoot());
        await this.storageEngine.runStartup();
        this.indexEngine.initialize(this, this.storageRoot);
        await this.indexEngine.runStartup();
        this.storageEngine.setIndexHook(this.indexEngine);
        this.retrievalEngine.initialize(this, this.storageRoot);
        await this.retrievalEngine.runStartup();
        this.learningMemoryEngine.initialize(this, this.storageRoot);
        await this.learningMemoryEngine.runStartup();
        this.projectMemoryEngine.initialize(this, this.storageRoot);
        await this.projectMemoryEngine.runStartup();
        this.videoMemoryEngine.initialize(this, this.storageRoot);
        await this.videoMemoryEngine.runStartup();
        this.marketingMemoryEngine.initialize(this, this.storageRoot);
        await this.marketingMemoryEngine.runStartup();
        this.productMemoryEngine.initialize(this, this.storageRoot);
        await this.productMemoryEngine.runStartup();
        this.relationshipMemoryEngine.initialize(this, this.storageRoot);
        await this.relationshipMemoryEngine.runStartup();
        this.memoryOptimizationEngine.initialize(this, this.storageRoot);
        await this.memoryOptimizationEngine.runStartup();
        this.memoryBackupEngine.initialize(this, this.storageRoot);
        await this.memoryBackupEngine.runStartup();
        this.memoryRecoveryEngine.initialize(this, this.storageRoot);
        await this.memoryRecoveryEngine.runStartup();
        this.memoryHealthMonitorEngine.initialize(this, this.storageRoot);
        await this.memoryHealthMonitorEngine.runStartup();
        this.startupMs = Date.now() - start;
        this.startupComplete = true;
        this.lifecycleState = MemoryLifecycleState.Ready;
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "startup",
            success: true,
            detail: `Memory Foundation ready in ${this.startupMs}ms`,
        });
        this.logger.log("info", "startup", "Memory Foundation startup complete", {
            startupMs: this.startupMs,
            categories: this.registry.getPreparedCount(),
            healthScore: this.lastHealth.score,
            storageRecords: this.storageEngine.getRecordCount(),
            indexEngine: "operational",
            retrievalEngine: "operational",
            learningMemoryEngine: "operational",
            projectMemoryEngine: "operational",
            videoMemoryEngine: "operational",
            marketingMemoryEngine: "operational",
            productMemoryEngine: "operational",
            relationshipMemoryEngine: "operational",
            memoryOptimizationEngine: "operational",
            memoryBackupEngine: "operational",
            memoryRecoveryEngine: "operational",
            memoryHealthMonitorEngine: "operational",
        });
    }
    async requestAccess(request) {
        this.ensureReady();
        this.lifecycleState = MemoryLifecycleState.Reading;
        try {
            return await this.accessCoordinator.requestAccess(request);
        }
        finally {
            this.lifecycleState = MemoryLifecycleState.Ready;
        }
    }
    registerMemoryModule(registration) {
        this.ensureReady();
        const full = {
            ...registration,
            healthStatus: this.lastHealth?.level ?? MemoryHealthLevel.Good,
            lastUpdate: new Date().toISOString(),
            status: MemoryModuleStatus.Registered,
        };
        this.registry.registerModule(full);
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "registration",
            category: registration.category,
            success: true,
            detail: `Registered ${registration.memoryId}`,
        });
    }
    async runHealthCheck() {
        this.ensureReady();
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator);
        return this.lastHealth;
    }
    async createBackup(label = "manual") {
        this.ensureReady();
        this.lifecycleState = MemoryLifecycleState.BackingUp;
        try {
            const { backupPath } = this.backupManager.createBackup(this.storage, label);
            return backupPath;
        }
        finally {
            this.lifecycleState = MemoryLifecycleState.Ready;
        }
    }
    async recover() {
        this.ensureReady();
        this.lifecycleState = MemoryLifecycleState.Recovering;
        this.logger.log("info", "recovery", "Memory recovery initiated");
        this.registry.initialize(this.storage, this.storageRoot);
        this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
        this.lastHealth = await this.healthMonitor.runHealthCheck(this.storage, this.registry, this.accessCoordinator);
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "recovery",
            success: this.lastIntegrity.verified,
            detail: "Memory recovery complete",
        });
        this.lifecycleState = MemoryLifecycleState.Ready;
        this.logger.log("info", "recovery", "Memory recovery complete", {
            verified: this.lastIntegrity.verified,
        });
    }
    async shutdown() {
        if (!this.initialized)
            return;
        this.lifecycleState = MemoryLifecycleState.Closing;
        this.registry.persist();
        this.backupManager.createBackup(this.storage, "shutdown");
        this.lifecycleState = MemoryLifecycleState.Closed;
        this.logger.log("info", "shutdown", "Memory Foundation shut down");
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
    getMemoryRoot() {
        return this.storage.getMemoryRoot();
    }
    getStorageEngine() {
        return this.storageEngine;
    }
    getRetrievalEngine() {
        return this.retrievalEngine;
    }
    getIndexEngine() {
        return this.indexEngine;
    }
    getLearningMemoryEngine() {
        return this.learningMemoryEngine;
    }
    getProjectMemoryEngine() {
        return this.projectMemoryEngine;
    }
    getVideoMemoryEngine() {
        return this.videoMemoryEngine;
    }
    getMarketingMemoryEngine() {
        return this.marketingMemoryEngine;
    }
    getProductMemoryEngine() {
        return this.productMemoryEngine;
    }
    getRelationshipMemoryEngine() {
        return this.relationshipMemoryEngine;
    }
    getMemoryOptimizationEngine() {
        return this.memoryOptimizationEngine;
    }
    getMemoryBackupEngine() {
        return this.memoryBackupEngine;
    }
    getMemoryRecoveryEngine() {
        return this.memoryRecoveryEngine;
    }
    getMemoryHealthMonitorEngine() {
        return this.memoryHealthMonitorEngine;
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
        readinessScore = Math.max(0, readinessScore);
        return {
            foundationStatus: this.startupComplete ? "operational" : "initializing",
            lifecycleState: this.lifecycleState,
            registryStatus: `${this.registry.getPreparedCount()} categories prepared, ${this.registry.getRegisteredCount()} registered`,
            storageStatus: persistence.passed ? "persistent storage verified" : persistence.detail,
            persistenceStatus: persistence.passed ? "survives restart" : "persistence unverified",
            integrityStatus: this.lastIntegrity?.verified ? "verified" : "issues detected",
            healthLevel: this.lastHealth?.level ?? MemoryHealthLevel.Good,
            registeredModules: this.registry.getRegisteredCount(),
            preparedCategories: this.registry.getPreparedCount(),
            performance: {
                startupMs: this.startupMs,
                averageReadMs: this.accessCoordinator?.getAverageReadMs() ?? 0,
                averageWriteMs: this.accessCoordinator?.getAverageWriteMs() ?? 0,
                lastHealthCheckMs: this.lastHealth ? 0 : 0,
                totalAccessRequests: this.accessCoordinator?.getTotalRequests() ?? 0,
            },
            protectedCategories: [...PROTECTED_DATA_CATEGORIES],
            knownIssues,
            readinessScore,
            timestamp: new Date().toISOString(),
        };
    }
    ensureReady() {
        if (!this.initialized || !this.accessCoordinator) {
            throw new MemoryFoundationError("Memory Foundation not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=memory-foundation.js.map