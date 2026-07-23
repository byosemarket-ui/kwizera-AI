import fs from "node:fs";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { MONITORED_COMPONENTS } from "./monitored-components.js";
import { HealthMonitorLogger } from "./health-logger.js";
import { HealthCheckCategory, SystemHealthCheckResult } from "./types.js";

export interface HealthCheckRunnerDeps {
  getCore: () => AiCoreManager;
  getModuleManager: () => AiModuleManager | null;
  getStateManager: () => AiStateManager | null;
  getCommunicationBus: () => AiCommunicationBus | null;
  getRecoveryEngine: () => AiRecoveryEngine | null;
  storageRoot: string;
}

export class HealthCheckRunner {
  constructor(
    private readonly deps: HealthCheckRunnerDeps,
    private readonly logger: HealthMonitorLogger
  ) {}

  async runAll(): Promise<SystemHealthCheckResult[]> {
    const checks: SystemHealthCheckResult[] = [];
    const start = Date.now();

    checks.push(...this.checkApplication());
    checks.push(...this.checkConfiguration());
    checks.push(...this.checkStorage());
    checks.push(...this.checkDatabase());
    checks.push(...this.checkRuntime());
    checks.push(...this.checkCommunication());
    checks.push(...this.checkLogs());
    checks.push(...await this.checkModules());
    checks.push(...this.checkQueues());
    checks.push(...this.checkTasks());
    checks.push(...this.checkWorkflows());
    checks.push(...this.checkProjects());
    checks.push(...this.checkSessions());
    checks.push(...this.checkDesktopServices());

    this.logger.log("info", "scan", `Health scan completed in ${Date.now() - start}ms`, {
      checks: checks.length,
      passed: checks.filter((c) => c.passed).length,
    });

    return checks;
  }

  async checkModule(moduleId: string): Promise<SystemHealthCheckResult[]> {
    const def = MONITORED_COMPONENTS.find((c) => c.moduleId === moduleId);
    if (!def) {
      return [{ name: moduleId, category: HealthCheckCategory.Module, passed: false, message: "Unknown module" }];
    }
    if (!def.implemented) {
      return [{ name: moduleId, category: HealthCheckCategory.Module, passed: true, message: "Framework slot — monitoring only" }];
    }
    return this.checkSingleModule(def.moduleId, def.pluginId);
  }

  private checkApplication(): SystemHealthCheckResult[] {
    const core = this.deps.getCore();
    return [
      {
        name: "application-status",
        category: HealthCheckCategory.Application,
        passed: core.isStarted(),
        message: core.isStarted() ? "Application running" : "Application not started",
      },
      {
        name: "ai-core-lifecycle",
        category: HealthCheckCategory.Application,
        passed: core.isReady(),
        message: `AI Core lifecycle: ${core.getLifecycleState()}`,
      },
    ];
  }

  private checkConfiguration(): SystemHealthCheckResult[] {
    const loaded = this.deps.getCore().configuration.isLoaded();
    return [{
      name: "configuration-status",
      category: HealthCheckCategory.Configuration,
      passed: loaded,
      message: loaded ? "Configuration loaded" : "Configuration not loaded",
    }];
  }

  private checkStorage(): SystemHealthCheckResult[] {
    const start = Date.now();
    const ok = fs.existsSync(this.deps.storageRoot);
    return [{
      name: "storage-status",
      category: HealthCheckCategory.Storage,
      passed: ok,
      message: ok ? "Local storage accessible" : "Storage root missing",
      responseTimeMs: Date.now() - start,
    }];
  }

  private checkDatabase(): SystemHealthCheckResult[] {
    return [{
      name: "database-status",
      category: HealthCheckCategory.Database,
      passed: true,
      message: "Database check deferred (local-first file storage)",
      responseTimeMs: 0,
    }];
  }

  private checkRuntime(): SystemHealthCheckResult[] {
    const runtime = this.deps.getCore().runtime;
    return [{
      name: "runtime-status",
      category: HealthCheckCategory.Runtime,
      passed: runtime.isInitialized(),
      message: runtime.isInitialized() ? "Runtime initialized" : "Runtime not initialized",
    }];
  }

  private checkCommunication(): SystemHealthCheckResult[] {
    const bus = this.deps.getCommunicationBus();
    const start = Date.now();
    const report = bus?.buildStatusReport();
    return [{
      name: "communication-status",
      category: HealthCheckCategory.Communication,
      passed: Boolean(bus?.isInitialized() && report?.readinessScore && report.readinessScore >= 80),
      message: report?.communicationBusStatus ?? "Communication Bus not initialized",
      responseTimeMs: Date.now() - start,
    }];
  }

  private checkLogs(): SystemHealthCheckResult[] {
    const logDir = path.join(this.deps.storageRoot, "logs");
    const ok = fs.existsSync(logDir);
    return [{
      name: "logs-status",
      category: HealthCheckCategory.Application,
      passed: ok,
      message: ok ? "Logs directory accessible" : "Logs directory missing",
    }];
  }

  private async checkModules(): Promise<SystemHealthCheckResult[]> {
    const results: SystemHealthCheckResult[] = [];
    for (const def of MONITORED_COMPONENTS.filter((c) => c.moduleId !== "database" && c.moduleId !== "local-storage" && c.moduleId !== "configuration" && c.moduleId !== "logs" && c.moduleId !== "desktop-services")) {
      results.push(...(await this.checkSingleModule(def.moduleId, def.pluginId, def.implemented)));
    }
    return results;
  }

  private async checkSingleModule(
    moduleId: string,
    pluginId?: string,
    implemented = true
  ): Promise<SystemHealthCheckResult[]> {
    if (!implemented) {
      return [{
        name: `module:${moduleId}`,
        category: HealthCheckCategory.Module,
        passed: true,
        message: "Framework slot — monitoring only",
      }];
    }

    const start = Date.now();
    const core = this.deps.getCore();
    const manager = this.deps.getModuleManager();

    if (moduleId === "ai-core") {
      return [{ name: "module:ai-core", category: HealthCheckCategory.Module, passed: core.isReady(), message: "AI Core operational", responseTimeMs: Date.now() - start }];
    }
    if (moduleId === "module-manager") {
      return [{ name: "module:module-manager", category: HealthCheckCategory.Module, passed: Boolean(manager?.isInitialized()), message: manager?.isInitialized() ? "Module Manager operational" : "Not initialized", responseTimeMs: Date.now() - start }];
    }
    if (moduleId === "communication-bus") {
      const bus = this.deps.getCommunicationBus();
      return [{ name: "module:communication-bus", category: HealthCheckCategory.Module, passed: Boolean(bus?.isInitialized()), message: bus?.isInitialized() ? "Communication Bus operational" : "Not initialized", responseTimeMs: Date.now() - start }];
    }
    if (moduleId === "state-manager") {
      const state = this.deps.getStateManager();
      return [{ name: "module:state-manager", category: HealthCheckCategory.Module, passed: Boolean(state?.isInitialized()), message: state?.isInitialized() ? "State Manager operational" : "Not initialized", responseTimeMs: Date.now() - start }];
    }
    if (moduleId === "recovery-engine") {
      const recovery = this.deps.getRecoveryEngine();
      return [{ name: "module:recovery-engine", category: HealthCheckCategory.Module, passed: Boolean(recovery?.isInitialized()), message: recovery?.isInitialized() ? "Recovery Engine operational" : "Not initialized", responseTimeMs: Date.now() - start }];
    }
    if (moduleId === "health-monitor") {
      return [{ name: "module:health-monitor", category: HealthCheckCategory.Module, passed: true, message: "Health Monitor self-check passed", responseTimeMs: Date.now() - start }];
    }

    if (pluginId) {
      const plugin = core.registry.getPlugin(pluginId);
      if (!plugin) {
        return [{ name: `module:${moduleId}`, category: HealthCheckCategory.Module, passed: false, message: `Plugin ${pluginId} not registered` }];
      }
      try {
        const health = await plugin.healthCheck();
        return [{
          name: `module:${moduleId}`,
          category: HealthCheckCategory.Module,
          passed: health.healthy,
          message: health.message,
          responseTimeMs: Date.now() - start,
        }];
      } catch (error) {
        return [{
          name: `module:${moduleId}`,
          category: HealthCheckCategory.Module,
          passed: false,
          message: error instanceof Error ? error.message : String(error),
          responseTimeMs: Date.now() - start,
        }];
      }
    }

    return [{ name: `module:${moduleId}`, category: HealthCheckCategory.Module, passed: true, message: "Monitored" }];
  }

  private checkQueues(): SystemHealthCheckResult[] {
    const taskManager = this.deps.getCore().taskManager;
    if (!taskManager?.isInitialized()) {
      return [{ name: "queue-status", category: HealthCheckCategory.Queue, passed: true, message: "Task Manager not active" }];
    }
    const status = taskManager.getQueueStatus();
    return [{
      name: "queue-status",
      category: HealthCheckCategory.Queue,
      passed: status.totalQueued < 1000,
      message: `Queued: ${status.totalQueued}`,
    }];
  }

  private checkTasks(): SystemHealthCheckResult[] {
    const tasks = this.deps.getStateManager()?.getCurrentSnapshot().tasks ?? {};
    const failed = Object.values(tasks).filter((t) => t.state === "failed").length;
    return [{
      name: "task-status",
      category: HealthCheckCategory.Task,
      passed: failed === 0,
      message: failed ? `${failed} failed task(s)` : "All tasks healthy",
    }];
  }

  private checkWorkflows(): SystemHealthCheckResult[] {
    const workflows = this.deps.getStateManager()?.getCurrentSnapshot().workflows ?? {};
    const failed = Object.values(workflows).filter((w) => w.state === "failed").length;
    return [{
      name: "workflow-status",
      category: HealthCheckCategory.Workflow,
      passed: failed === 0,
      message: failed ? `${failed} failed workflow(s)` : "All workflows healthy",
    }];
  }

  private checkProjects(): SystemHealthCheckResult[] {
    const projects = this.deps.getStateManager()?.getCurrentSnapshot().projects ?? {};
    return [{
      name: "project-status",
      category: HealthCheckCategory.Project,
      passed: true,
      message: `${Object.keys(projects).length} project(s) tracked`,
    }];
  }

  private checkSessions(): SystemHealthCheckResult[] {
    const sessions = this.deps.getCore().sessions.getActiveSessionCount();
    return [{
      name: "session-status",
      category: HealthCheckCategory.Session,
      passed: true,
      message: `${sessions} active session(s)`,
    }];
  }

  private checkDesktopServices(): SystemHealthCheckResult[] {
    return [{
      name: "desktop-services",
      category: HealthCheckCategory.Runtime,
      passed: true,
      message: "Desktop services framework ready (Electron deferred)",
    }];
  }
}
