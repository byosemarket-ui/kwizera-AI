import { AiCoreConfiguration } from "./types.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiContextManager } from "./ai-context-manager.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiSessionManager } from "./ai-session-manager.js";

export interface AiRuntimeState {
  initialized: boolean;
  preparedAt?: string;
  workflowReady: boolean;
}

/**
 * Lightweight runtime shell — no business logic, no future module dependencies.
 */
export class AiRuntime {
  private state: AiRuntimeState = {
    initialized: false,
    workflowReady: false,
  };

  prepare(
    config: AiCoreConfiguration,
    contextManager: AiContextManager,
    logger: AiCoreLogger
  ): void {
    contextManager.setMetadata("applicationVersion", config.application.applicationVersion);
    contextManager.setMetadata("assistantName", config.application.assistantName);
    contextManager.setMetadata("storageRoot", config.storage.storageRoot);

    this.state = {
      initialized: true,
      preparedAt: new Date().toISOString(),
      workflowReady: true,
    };

    logger.info("initialization", "AI Runtime prepared for future workflow execution");
  }

  getState(): Readonly<AiRuntimeState> {
    return this.state;
  }

  isInitialized(): boolean {
    return this.state.initialized;
  }

  isWorkflowReady(): boolean {
    return this.state.workflowReady;
  }

  reset(): void {
    this.state = { initialized: false, workflowReady: false };
  }
}

export type { AiModuleRegistry, AiSessionManager };
