import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
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
import {
  MemoryAccessOperation,
  MemoryAccessRequest,
  MemoryAccessResult,
  MemoryFoundationError,
  MemoryFoundationStatusReport,
  MemoryHealthLevel,
  MemoryHealthReport,
  MemoryIntegrityResult,
  MemoryLifecycleState,
  MemoryModuleRegistration,
  MemoryModuleStatus,
} from "./types.js";

/**
 * Persistent Memory Foundation — central memory system for KWIZERA AI STUDIO.
 * All future memory modules must register and access memory through this foundation.
 */
export class AiMemoryFoundation {
  private core: AiCoreManager | null = null;
  private moduleManager: AiModuleManager | null = null;
  private stateManager: AiStateManager | null = null;
  private communicationBus: AiCommunicationBus | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;
  private lifecycleState = MemoryLifecycleState.Initializing;
  private startupMs = 0;
  private lastIntegrity: MemoryIntegrityResult | null = null;
  private lastHealth: MemoryHealthReport | null = null;

  readonly logger = new MemoryFoundationLogger();
  readonly history = new MemoryHistoryStore();
  private readonly storage = new MemoryStorageManager(this.logger);
  private readonly registry = new MemoryRegistry(this.logger);
  private readonly integrityVerifier = new IntegrityVerifier(this.logger);
  private readonly backupManager = new MemoryBackupManager(this.logger);
  private readonly healthMonitor = new MemoryHealthMonitor(this.logger);
  private accessCoordinator: MemoryAccessCoordinator | null = null;
  readonly storageEngine = new AiMemoryStorageEngine();
  readonly indexEngine = new AiMemoryIndexEngine();
  readonly retrievalEngine = new AiMemoryRetrievalEngine();
  readonly learningMemoryEngine = new AiLearningMemoryEngine();
  readonly projectMemoryEngine = new AiProjectMemoryEngine();
  readonly videoMemoryEngine = new AiVideoMemoryEngine();
  readonly marketingMemoryEngine = new AiMarketingMemoryEngine();
  readonly productMemoryEngine = new AiProductMemoryEngine();
  readonly relationshipMemoryEngine = new AiRelationshipMemoryEngine();
  readonly memoryOptimizationEngine = new AiMemoryOptimizationEngine();
  readonly memoryBackupEngine = new AiMemoryBackupEngine();
  readonly memoryRecoveryEngine = new AiMemoryRecoveryEngine();
  readonly memoryHealthMonitorEngine = new AiMemoryHealthMonitorEngine();

  initialize(
    core: AiCoreManager,
    storageRoot: string,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    communicationBus?: AiCommunicationBus
  ): void {
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

    this.accessCoordinator = new MemoryAccessCoordinator(
      this.logger,
      this.history,
      this.registry,
      this.storage
    );

    this.integrityVerifier.writeManifest(this.storage, storageRoot);
    this.initialized = true;
    this.lifecycleState = MemoryLifecycleState.Loading;

    this.logger.log("info", "startup", "Memory Foundation initialized", { memoryRoot });
  }

  async runStartup(): Promise<void> {
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
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!
    );

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

  async requestAccess(request: MemoryAccessRequest): Promise<MemoryAccessResult> {
    this.ensureReady();
    this.lifecycleState = MemoryLifecycleState.Reading;
    try {
      return await this.accessCoordinator!.requestAccess(request);
    } finally {
      this.lifecycleState = MemoryLifecycleState.Ready;
    }
  }

  registerMemoryModule(registration: Omit<MemoryModuleRegistration, "lastUpdate" | "healthStatus">): void {
    this.ensureReady();
    const full: MemoryModuleRegistration = {
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

  async runHealthCheck(): Promise<MemoryHealthReport> {
    this.ensureReady();
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!
    );
    return this.lastHealth;
  }

  async createBackup(label = "manual"): Promise<string> {
    this.ensureReady();
    this.lifecycleState = MemoryLifecycleState.BackingUp;
    try {
      const { backupPath } = this.backupManager.createBackup(this.storage, label);
      return backupPath;
    } finally {
      this.lifecycleState = MemoryLifecycleState.Ready;
    }
  }

  async recover(): Promise<void> {
    this.ensureReady();
    this.lifecycleState = MemoryLifecycleState.Recovering;
    this.logger.log("info", "recovery", "Memory recovery initiated");

    this.registry.initialize(this.storage, this.storageRoot);
    this.lastIntegrity = this.integrityVerifier.verify(this.storage, this.registry);
    this.lastHealth = await this.healthMonitor.runHealthCheck(
      this.storage,
      this.registry,
      this.accessCoordinator!
    );

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

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    this.lifecycleState = MemoryLifecycleState.Closing;
    this.registry.persist();
    this.backupManager.createBackup(this.storage, "shutdown");
    this.lifecycleState = MemoryLifecycleState.Closed;
    this.logger.log("info", "shutdown", "Memory Foundation shut down");
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLifecycleState(): MemoryLifecycleState {
    return this.lifecycleState;
  }

  getMemoryRoot(): string {
    return this.storage.getMemoryRoot();
  }

  getStorageEngine(): AiMemoryStorageEngine {
    return this.storageEngine;
  }

  getRetrievalEngine(): AiMemoryRetrievalEngine {
    return this.retrievalEngine;
  }

  getIndexEngine(): AiMemoryIndexEngine {
    return this.indexEngine;
  }

  getLearningMemoryEngine(): AiLearningMemoryEngine {
    return this.learningMemoryEngine;
  }

  getProjectMemoryEngine(): AiProjectMemoryEngine {
    return this.projectMemoryEngine;
  }

  getVideoMemoryEngine(): AiVideoMemoryEngine {
    return this.videoMemoryEngine;
  }

  getMarketingMemoryEngine(): AiMarketingMemoryEngine {
    return this.marketingMemoryEngine;
  }

  getProductMemoryEngine(): AiProductMemoryEngine {
    return this.productMemoryEngine;
  }

  getRelationshipMemoryEngine(): AiRelationshipMemoryEngine {
    return this.relationshipMemoryEngine;
  }

  getMemoryOptimizationEngine(): AiMemoryOptimizationEngine {
    return this.memoryOptimizationEngine;
  }

  getMemoryBackupEngine(): AiMemoryBackupEngine {
    return this.memoryBackupEngine;
  }

  getMemoryRecoveryEngine(): AiMemoryRecoveryEngine {
    return this.memoryRecoveryEngine;
  }

  getMemoryHealthMonitorEngine(): AiMemoryHealthMonitorEngine {
    return this.memoryHealthMonitorEngine;
  }

  getRegistry() {
    return this.registry;
  }

  getLastIntegrityResult(): MemoryIntegrityResult | null {
    return this.lastIntegrity;
  }

  getLastHealthReport(): MemoryHealthReport | null {
    return this.lastHealth;
  }

  buildStatusReport(): MemoryFoundationStatusReport {
    const persistence = this.storage.verifyPersistence();
    const knownIssues: string[] = [];

    if (this.lastIntegrity && !this.lastIntegrity.verified) {
      knownIssues.push(...this.lastIntegrity.issues);
    }
    if (this.lastHealth && this.lastHealth.issues.length > 0) {
      knownIssues.push(...this.lastHealth.issues);
    }

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 30;
    if (!persistence.passed) readinessScore -= 20;
    if (this.lastIntegrity && !this.lastIntegrity.verified) readinessScore -= 15;
    if (this.lastHealth && this.lastHealth.score < 80) readinessScore -= 10;
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

  private ensureReady(): void {
    if (!this.initialized || !this.accessCoordinator) {
      throw new MemoryFoundationError(
        "Memory Foundation not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
