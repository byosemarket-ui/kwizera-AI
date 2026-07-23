import { AiCoreError, AiCoreHealthReport, AiCoreStatusReport, AiLifecycleState } from "./types.js";
import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiStartupManager } from "./ai-startup-manager.js";
import type { AiShutdownManager } from "./ai-shutdown-manager.js";
import type { AiConfigurationManager } from "./ai-configuration-manager.js";
import type { AiHealthMonitor } from "./ai-health-monitor.js";
import type { AiRuntime } from "./ai-runtime.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiCoordinator } from "./ai-coordinator.js";
import type { AiSessionManager } from "./ai-session-manager.js";

export interface AiControllerDeps {
  lifecycle: AiLifecycleManager;
  startup: AiStartupManager;
  shutdown: AiShutdownManager;
  configuration: AiConfigurationManager;
  runtime: AiRuntime;
  registry: AiModuleRegistry;
  logger: AiCoreLogger;
  health: AiHealthMonitor;
  coordinator: AiCoordinator;
  sessions: AiSessionManager;
}

/**
 * High-level AI Core controller — start, stop, pause, recover, status.
 */
export class AiController {
  constructor(private readonly deps: AiControllerDeps) {}

  getLifecycleState(): AiLifecycleState {
    return this.deps.lifecycle.getState();
  }

  async recover(reason = "manual-recovery"): Promise<void> {
    const state = this.deps.lifecycle.getState();
    if (state !== AiLifecycleState.Failed && state !== AiLifecycleState.Paused) {
      throw new AiCoreError(
        `Recovery not applicable from state: ${state}`,
        "RECOVERY_NOT_APPLICABLE"
      );
    }

    this.deps.lifecycle.transition(AiLifecycleState.Recovering, reason);
    this.deps.logger.info("recovery", "AI Core recovery initiated", { reason });

    this.deps.lifecycle.transition(AiLifecycleState.Ready, "recovery complete");
    this.deps.logger.info("recovery", "AI Core recovery complete");
  }

  pause(): void {
    const state = this.deps.lifecycle.getState();
    if (state !== AiLifecycleState.Running) {
      throw new AiCoreError(`Cannot pause from state: ${state}`, "PAUSE_NOT_APPLICABLE");
    }
    this.deps.lifecycle.transition(AiLifecycleState.Paused, "paused");
    this.deps.logger.info("lifecycle", "AI Core paused");
  }

  resume(): void {
    const state = this.deps.lifecycle.getState();
    if (state !== AiLifecycleState.Paused) {
      throw new AiCoreError(`Cannot resume from state: ${state}`, "RESUME_NOT_APPLICABLE");
    }
    this.deps.lifecycle.transition(AiLifecycleState.Running, "resumed");
    this.deps.logger.info("lifecycle", "AI Core resumed");
  }

  getHealthReport(): AiCoreHealthReport {
    return this.deps.health.runChecks({
      lifecycle: this.deps.lifecycle,
      configuration: this.deps.configuration,
      runtime: this.deps.runtime,
      registry: this.deps.registry,
      logger: this.deps.logger,
      config: this.deps.configuration.isLoaded()
        ? this.deps.configuration.getConfiguration()
        : undefined,
    });
  }

  buildStatusReport(): AiCoreStatusReport {
    const health = this.getHealthReport();
    const lifecycle = this.deps.lifecycle.getState();
    const configLoaded = this.deps.configuration.isLoaded();
    const runtimeReady = this.deps.runtime.isInitialized();
    const loggerReady = this.deps.logger.isInitialized();
    const slots = this.deps.registry.getSlotCount();

    const checks = [
      configLoaded,
      runtimeReady,
      loggerReady,
      slots === 10,
      lifecycle === AiLifecycleState.Ready ||
        lifecycle === AiLifecycleState.Running ||
        lifecycle === AiLifecycleState.Stopped,
      health.healthy || lifecycle === AiLifecycleState.Stopped,
    ];

    const readinessScore = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );

    return {
      aiCoreStatus: runtimeReady ? "operational" : "not-initialized",
      initializationStatus: configLoaded && runtimeReady ? "complete" : "incomplete",
      lifecycleStatus: lifecycle,
      registryStatus: `${slots} slots reserved, ${this.deps.registry.getRegisteredCount()} registered`,
      configurationStatus: configLoaded ? "loaded" : "not-loaded",
      loggingStatus: loggerReady
        ? `active (${this.deps.logger.getLogDirectory()})`
        : "inactive",
      healthStatus: health.healthy ? "healthy" : "unhealthy",
      readinessScore,
      diagnostics: [...this.deps.startup.getDiagnostics()],
      registeredModules: this.deps.registry.getAllEntries(),
      timestamp: new Date().toISOString(),
    };
  }
}
