import path from "node:path";
import { ModuleCompatibilityChecker } from "./compatibility-checker.js";
import { ModuleCommunicationRouter } from "./communication-router.js";
import { ModuleDependencyValidator } from "./dependency-validator.js";
import { createFrameworkRecord, FRAMEWORK_MODULE_CATALOG, getCatalogEntry, } from "./module-catalog.js";
import { ModuleHistoryStore } from "./module-history-store.js";
import { ModuleHealthMonitor } from "./module-health-monitor.js";
import { ModuleManagerLogger } from "./module-logger.js";
import { ModuleRecoveryManager } from "./module-recovery-manager.js";
import { ManagedModuleState, ModuleHealthStatus, ModuleManagerError, } from "./types.js";
/**
 * AI Module Manager — central controller for every AI module in KWIZERA AI STUDIO.
 */
export class AiModuleManager {
    core = null;
    storageRoot = "";
    initialized = false;
    permanentRegistry = new Map();
    plugins = new Map();
    startupTimes = new Map();
    logger = new ModuleManagerLogger();
    history = new ModuleHistoryStore();
    dependencyValidator = new ModuleDependencyValidator();
    compatibilityChecker = new ModuleCompatibilityChecker();
    healthMonitor;
    router;
    recovery;
    _communicationBus = null;
    _stateManager = null;
    constructor() {
        this.healthMonitor = new ModuleHealthMonitor(this.logger);
        this.router = new ModuleCommunicationRouter((id) => this.resolveRecord(id), this.logger);
        this.recovery = new ModuleRecoveryManager(this.history, this.logger, this.router);
    }
    initialize(core, storageRoot) {
        this.core = core;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const modulesDir = path.join(storageRoot, "modules");
        this.logger.initialize(logDir);
        this.history.initialize(modulesDir);
        this.prepareFramework();
        this.initialized = true;
        this.logger.log("info", "initialization", "AI Module Manager initialized", {
            catalogSize: FRAMEWORK_MODULE_CATALOG.length,
            storageRoot,
        });
    }
    isInitialized() {
        return this.initialized;
    }
    setCommunicationBus(bus) {
        this._communicationBus = bus;
    }
    setStateManager(stateManager) {
        this._stateManager = stateManager;
    }
    isModuleIsolated(moduleId) {
        return this.router.isIsolated(moduleId);
    }
    prepareFramework() {
        for (const def of FRAMEWORK_MODULE_CATALOG) {
            const record = createFrameworkRecord(def);
            this.permanentRegistry.set(def.moduleId, record);
            this.history.appendEvent({
                moduleId: def.moduleId,
                eventType: "framework-registration",
                detail: `Framework slot prepared: ${def.moduleName}`,
                timestamp: new Date().toISOString(),
            });
        }
        const aiCore = this.permanentRegistry.get("ai-core");
        if (aiCore) {
            aiCore.version = "0.1.0";
            aiCore.status = ManagedModuleState.Running;
            aiCore.enabled = true;
            aiCore.healthStatus = ModuleHealthStatus.Healthy;
            this.transitionState(aiCore, ManagedModuleState.Ready, "AI Core ready");
            this.transitionState(aiCore, ManagedModuleState.Running, "AI Core operational");
        }
    }
    async registerModule(options) {
        this.ensureReady();
        const { plugin } = options;
        const catalog = getCatalogEntry(plugin.id);
        const moduleId = catalog?.moduleId ?? plugin.id;
        const slotId = options.slotId ?? catalog?.slotId ?? plugin.id;
        const dependencies = options.dependencies ?? catalog?.dependencies ?? [];
        const compat = this.compatibilityChecker.verify(plugin);
        if (!compat.compatible) {
            throw new ModuleManagerError(compat.message, "INCOMPATIBLE_MODULE");
        }
        const depResult = this.dependencyValidator.validate(plugin, this.core, dependencies, this.storageRoot);
        if (!depResult.compatible) {
            throw new ModuleManagerError(depResult.rejectionReason ?? "Dependency validation failed", "DEPENDENCY_REJECTED");
        }
        this.core.registry.registerPlugin(plugin, this.core.logger);
        const record = this.permanentRegistry.get(moduleId);
        if (record) {
            record.version = plugin.version;
            record.moduleName = plugin.name;
            record.dependencies = dependencies;
            record.capabilities = options.capabilities ?? catalog?.capabilities ?? record.capabilities;
            record.owner = options.owner ?? catalog?.owner ?? record.owner;
            record.enabled = true;
            record.slotId = slotId;
            record.registrationDate = new Date().toISOString();
            record.compatibility = compat.message;
            this.transitionState(record, ManagedModuleState.Registered, `Registered ${plugin.name}`);
        }
        else {
            const newRecord = {
                moduleId,
                moduleName: plugin.name,
                version: plugin.version,
                status: ManagedModuleState.Registered,
                dependencies,
                capabilities: options.capabilities ?? { features: [], interfaces: [] },
                owner: options.owner ?? "KWIZERA AI",
                registrationDate: new Date().toISOString(),
                healthStatus: ModuleHealthStatus.Unknown,
                lastActivity: new Date().toISOString(),
                compatibility: compat.message,
                enabled: true,
                slotId,
            };
            this.permanentRegistry.set(moduleId, newRecord);
        }
        this.plugins.set(moduleId, plugin);
        this.plugins.set(slotId, plugin);
        this.plugins.set(plugin.id, plugin);
        this._communicationBus?.registerChannel(moduleId, true);
        this.history.appendEvent({
            moduleId,
            eventType: "registration",
            detail: `Module registered v${plugin.version}`,
            timestamp: new Date().toISOString(),
        });
        this.logger.log("info", "registration", `Module registered: ${moduleId}`, {
            version: plugin.version,
            slotId,
        });
    }
    async initializeModule(moduleIdOrSlot) {
        this.ensureReady();
        const record = this.resolveRecord(moduleIdOrSlot);
        const plugin = this.resolvePlugin(moduleIdOrSlot);
        if (!record || !plugin) {
            throw new ModuleManagerError(`Module not registered: ${moduleIdOrSlot}`, "NOT_REGISTERED");
        }
        const slotId = record.slotId ?? plugin.id;
        const start = Date.now();
        this.transitionState(record, ManagedModuleState.Initializing, "Initializing module");
        try {
            await this.core.registry.initializeModule(slotId, this.core.logger);
            this.transitionState(record, ManagedModuleState.Loading, "Loading module");
            this.transitionState(record, ManagedModuleState.Ready, "Module ready");
            this.transitionState(record, ManagedModuleState.Running, "Module running");
            record.healthStatus = ModuleHealthStatus.Healthy;
            const startupMs = Date.now() - start;
            this.startupTimes.set(record.moduleId, startupMs);
            const stats = {
                moduleId: record.moduleId,
                startupMs,
                responseTimeMs: startupMs,
                restartCount: this.recovery.getRestartCount(record.moduleId),
                failureCount: 0,
            };
            this.history.appendPerformance(stats);
            this.logger.log("info", "performance", `Module startup ${record.moduleId}`, { startupMs });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            record.lastError = message;
            record.healthStatus = ModuleHealthStatus.Unhealthy;
            this.transitionState(record, ManagedModuleState.Failed, message);
            this.healthMonitor.recordError(record.moduleId);
            this.logger.log("error", "error", `Initialization failed: ${record.moduleId}`, { error: message });
            throw error;
        }
    }
    async loadModule(moduleIdOrSlot) {
        const record = this.resolveRecord(moduleIdOrSlot);
        if (!record) {
            throw new ModuleManagerError(`Module not found: ${moduleIdOrSlot}`, "NOT_FOUND");
        }
        if (record.status === ManagedModuleState.Running) {
            return;
        }
        this.transitionState(record, ManagedModuleState.Loading, "Loading");
        this.transitionState(record, ManagedModuleState.Running, "Loaded and running");
        this.logger.log("info", "loading", `Module loaded: ${record.moduleId}`);
    }
    async unloadModule(moduleIdOrSlot) {
        const record = this.resolveRecord(moduleIdOrSlot);
        const plugin = this.resolvePlugin(moduleIdOrSlot);
        if (!record) {
            return;
        }
        this.transitionState(record, ManagedModuleState.Stopping, "Stopping module");
        const slotId = record.slotId ?? moduleIdOrSlot;
        if (plugin) {
            await this.core.registry.shutdownModule(slotId, this.core.logger);
        }
        this.transitionState(record, ManagedModuleState.Stopped, "Module stopped");
        record.enabled = false;
        this.logger.log("info", "state-change", `Module unloaded: ${record.moduleId}`);
    }
    enableModule(moduleIdOrSlot) {
        const record = this.resolveRecord(moduleIdOrSlot);
        if (!record) {
            throw new ModuleManagerError(`Module not found: ${moduleIdOrSlot}`, "NOT_FOUND");
        }
        record.enabled = true;
        if (record.status === ManagedModuleState.Disabled) {
            this.transitionState(record, ManagedModuleState.Stopped, "Module enabled");
        }
        this.logger.log("info", "state-change", `Module enabled: ${record.moduleId}`);
    }
    disableModule(moduleIdOrSlot) {
        const record = this.resolveRecord(moduleIdOrSlot);
        if (!record) {
            throw new ModuleManagerError(`Module not found: ${moduleIdOrSlot}`, "NOT_FOUND");
        }
        record.enabled = false;
        this.transitionState(record, ManagedModuleState.Disabled, "Module disabled");
        this.router.isolate(record.moduleId);
        this.logger.log("info", "state-change", `Module disabled: ${record.moduleId}`);
    }
    async restartModule(moduleIdOrSlot) {
        const record = this.resolveRecord(moduleIdOrSlot);
        const plugin = this.resolvePlugin(moduleIdOrSlot);
        if (!record || !plugin) {
            throw new ModuleManagerError(`Module not found: ${moduleIdOrSlot}`, "NOT_FOUND");
        }
        return this.recovery.recover(record, plugin, async () => {
            await this.initializeModule(moduleIdOrSlot);
        });
    }
    async registerAndInitialize(plugin, options) {
        await this.registerModule({ plugin, ...options });
        await this.initializeModule(plugin.id);
        await this.loadModule(plugin.id);
    }
    async routeCommunication(request, handler) {
        this.ensureReady();
        if (this._communicationBus) {
            const result = await this._communicationBus.routeLegacyRequest(request.senderId, request.receiverId, request.action, request.payload, handler);
            const msg = result.message;
            const record = {
                id: msg.messageId,
                sender: msg.sender,
                receiver: msg.receiver,
                request: request.action,
                response: result.success ? JSON.stringify(result.result ?? {}) : undefined,
                executionTimeMs: msg.executionTimeMs,
                errors: msg.errors ?? [],
                warnings: [],
                recoveryAttempts: msg.retryCount,
                timestamp: msg.timestamp,
                success: result.success,
            };
            return {
                success: result.success,
                result: result.result,
                message: result.success ? "Communication completed via bus" : "Communication failed",
                record,
            };
        }
        return this.router.route(this.core, request, handler);
    }
    async monitorHealth(moduleIdOrSlot) {
        const targets = moduleIdOrSlot
            ? [this.resolveRecord(moduleIdOrSlot)].filter(Boolean)
            : Array.from(this.permanentRegistry.values()).filter((r) => r.enabled && this.resolvePlugin(r.moduleId));
        for (const record of targets) {
            if (!record)
                continue;
            const plugin = this.resolvePlugin(record.moduleId);
            const snapshot = await this.healthMonitor.checkModule(record, plugin);
            if (this.healthMonitor.shouldIsolate(snapshot)) {
                this.router.isolate(record.moduleId);
                record.healthStatus = ModuleHealthStatus.Isolated;
                this.logger.log("warn", "health", `Module isolated: ${record.moduleId}`, {
                    runtimeErrors: snapshot.runtimeErrors,
                });
                if (plugin && record.status === ManagedModuleState.Failed) {
                    await this.restartModule(record.moduleId);
                }
            }
        }
    }
    verifyCompatibility(plugin) {
        return this.compatibilityChecker.verify(plugin).compatible;
    }
    getRegistryRecord(moduleId) {
        return this.permanentRegistry.get(moduleId);
    }
    getAllRegistryRecords() {
        return Array.from(this.permanentRegistry.values());
    }
    getRegisteredPluginCount() {
        return Array.from(this.permanentRegistry.values()).filter((r) => r.status === ManagedModuleState.Running && r.moduleId !== "ai-core").length;
    }
    getFrameworkCatalogSize() {
        return FRAMEWORK_MODULE_CATALOG.length;
    }
    getCommunicationRecords() {
        if (this._communicationBus) {
            return this._communicationBus.history.getRecords().map((h) => ({
                id: h.messageId,
                sender: h.sender,
                receiver: h.receiver,
                request: h.type,
                response: h.result === "success" ? "{}" : undefined,
                executionTimeMs: h.performanceMs,
                errors: h.errors,
                warnings: [],
                recoveryAttempts: h.retries,
                timestamp: h.time,
                success: h.result === "success",
            }));
        }
        return this.router.getRecords();
    }
    getRecoveryDiagnostics() {
        return this.recovery.getDiagnostics();
    }
    buildStatusReport() {
        const records = this.getAllRegistryRecords();
        const running = records.filter((r) => r.status === ManagedModuleState.Running);
        const healthy = records.filter((r) => r.healthStatus === ModuleHealthStatus.Healthy);
        const isolated = records.filter((r) => r.healthStatus === ModuleHealthStatus.Isolated);
        const failed = records.filter((r) => r.status === ManagedModuleState.Failed);
        const startupValues = Array.from(this.startupTimes.values());
        const avgStartup = startupValues.length > 0
            ? Math.round(startupValues.reduce((a, b) => a + b, 0) / startupValues.length)
            : 0;
        const commRecords = this.router.getRecords();
        const avgComm = commRecords.length > 0
            ? Math.round(commRecords.reduce((a, r) => a + r.executionTimeMs, 0) / commRecords.length)
            : 0;
        const knownIssues = [];
        if (failed.length) {
            knownIssues.push(`${failed.length} module(s) in failed state`);
        }
        if (isolated.length) {
            knownIssues.push(`${isolated.length} module(s) isolated`);
        }
        const pending = records.filter((r) => !this.resolvePlugin(r.moduleId) &&
            r.moduleId !== "ai-core" &&
            r.moduleId !== "health-monitor");
        if (pending.length > 13) {
            knownIssues.push(`${pending.length - 5} framework modules awaiting implementation`);
        }
        let readinessScore = 100;
        if (failed.length)
            readinessScore -= failed.length * 15;
        if (isolated.length)
            readinessScore -= isolated.length * 10;
        readinessScore = Math.max(0, Math.min(100, readinessScore));
        return {
            moduleManagerStatus: this.initialized ? "operational" : "not-initialized",
            registeredModules: running.length,
            healthStatus: `${healthy.length}/${records.length} healthy`,
            dependencyStatus: "validated on registration",
            recoveryStatus: this.recovery.getDiagnostics().length > 0
                ? `${this.recovery.getDiagnostics().length} recovery event(s)`
                : "no recoveries required",
            performance: {
                averageStartupMs: avgStartup,
                averageCommunicationMs: avgComm,
                totalModules: records.length,
            },
            knownIssues,
            readinessScore,
            timestamp: new Date().toISOString(),
        };
    }
    transitionState(record, state, detail) {
        record.status = state;
        record.lastActivity = new Date().toISOString();
        this._stateManager?.reportModuleState(record.moduleId, state, {
            reason: detail,
            systemAction: "module-lifecycle",
        });
        this.history.appendEvent({
            moduleId: record.moduleId,
            eventType: "lifecycle",
            detail: `${state}: ${detail}`,
            timestamp: record.lastActivity,
        });
        this.logger.log("info", "state-change", `${record.moduleId} → ${state}`, { detail });
    }
    resolveRecord(id) {
        if (this.permanentRegistry.has(id)) {
            return this.permanentRegistry.get(id);
        }
        for (const record of this.permanentRegistry.values()) {
            if (record.slotId === id) {
                return record;
            }
        }
        return undefined;
    }
    resolvePlugin(id) {
        return this.plugins.get(id);
    }
    ensureReady() {
        if (!this.core || !this.initialized) {
            throw new ModuleManagerError("Module Manager not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=module-manager.js.map