import fs from "node:fs";
import path from "node:path";
import { resolveLogDirectory } from "../../storage/paths/storage-paths.js";
import {
  AiCoreError,
  AiInitializationDiagnostic,
  AiLifecycleState,
} from "./types.js";
import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiConfigurationManager } from "./ai-configuration-manager.js";
import type { AiContextManager } from "./ai-context-manager.js";
import type { AiRuntime } from "./ai-runtime.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiSessionManager } from "./ai-session-manager.js";
import type { AiHealthMonitor } from "./ai-health-monitor.js";

export interface AiStartupManagerDeps {
  lifecycle: AiLifecycleManager;
  logger: AiCoreLogger;
  configuration: AiConfigurationManager;
  context: AiContextManager;
  runtime: AiRuntime;
  registry: AiModuleRegistry;
  sessions: AiSessionManager;
  health: AiHealthMonitor;
}

export class AiStartupManager {
  private diagnostics: AiInitializationDiagnostic[] = [];

  getDiagnostics(): ReadonlyArray<AiInitializationDiagnostic> {
    return this.diagnostics;
  }

  private record(diagnostic: AiInitializationDiagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  async start(
    deps: AiStartupManagerDeps,
    options: { storageRootOverride?: string; correlationId?: string } = {}
  ): Promise<void> {
    this.diagnostics = [];
    deps.lifecycle.reset();
    deps.lifecycle.transition(AiLifecycleState.Initializing, "startup begin");

    const recordStage = (
      stage: string,
      success: boolean,
      message: string,
      error?: string
    ): void => {
      this.record({
        stage,
        success,
        message,
        timestamp: new Date().toISOString(),
        error,
      });
    };

    try {
      deps.lifecycle.transition(AiLifecycleState.Loading, "load configuration");
      recordStage("lifecycle", true, "Entered loading state");

      const config = deps.configuration.load(deps.logger, options.storageRootOverride);
      recordStage("configuration", true, "Configuration loaded");

      deps.configuration.ensureStorageDirectories(deps.logger);
      recordStage("storage", true, "Storage directories ensured");

      const logDir = resolveLogDirectory(config.storage.storageRoot);
      deps.logger.configure({
        logDirectory: logDir,
        minLevel: config.ai.logLevel,
        correlationId: options.correlationId,
      });
      recordStage("logging", true, `Logger configured at ${logDir}`);

      const context = deps.context.create(options.correlationId);
      deps.context.updateLifecycleState(AiLifecycleState.Loading);
      recordStage("context", true, "Runtime context created", undefined);

      deps.sessions.configure(config.ai.maxConcurrentSessions);
      recordStage("sessions", true, "Session manager configured");

      deps.registry.initializeSlots(config.futureModules.futureModules, deps.logger);
      recordStage("registry", true, "Future module slots reserved");

      deps.runtime.prepare(config, deps.context, deps.logger);
      recordStage("runtime", true, "AI Runtime prepared");

      deps.context.updateLifecycleState(AiLifecycleState.Ready);
      deps.lifecycle.transition(AiLifecycleState.Ready, "startup complete");
      recordStage("ready", true, "AI Core ready");

      deps.logger.info("startup", "KWIZERA AI Core startup complete", {
        correlationId: context.correlationId,
        storageRoot: config.storage.storageRoot,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordStage("startup", false, "Startup failed", message);

      try {
        deps.lifecycle.transition(AiLifecycleState.Failed, message);
      } catch {
        // lifecycle may already be failed or invalid
      }

      deps.logger.error("startup", "AI Core startup failed", { error: message });

      const recoveryPath = options.storageRootOverride
        ? path.join(options.storageRootOverride, "logs")
        : path.join(
            options.storageRootOverride ?? "D:\\KWIZERA-AI-STUDIO",
            "logs"
          );

      if (!fs.existsSync(recoveryPath)) {
        fs.mkdirSync(recoveryPath, { recursive: true });
      }

      throw new AiCoreError(
        `AI Core startup failed: ${message}`,
        "STARTUP_FAILED",
        this.diagnostics[this.diagnostics.length - 1]
      );
    }
  }
}
