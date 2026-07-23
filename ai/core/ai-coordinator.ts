import { AiCoreError, AiLifecycleState, AiModulePlugin } from "./types.js";
import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiSessionManager } from "./ai-session-manager.js";
import type { AiContextManager } from "./ai-context-manager.js";

/**
 * Coordinates communication between AI Core subsystems and future modules.
 * No business logic — routing and lifecycle coordination only.
 */
export class AiCoordinator {
  constructor(
    private readonly lifecycle: AiLifecycleManager,
    private readonly registry: AiModuleRegistry,
    private readonly sessions: AiSessionManager,
    private readonly context: AiContextManager,
    private readonly logger: AiCoreLogger
  ) {}

  ensureOperational(): void {
    if (!this.lifecycle.isOperational()) {
      throw new AiCoreError(
        `AI Core not operational (state: ${this.lifecycle.getState()})`,
        "CORE_NOT_OPERATIONAL"
      );
    }
  }

  async registerFutureModule(plugin: AiModulePlugin): Promise<void> {
    this.ensureOperational();
    this.registry.registerPlugin(plugin, this.logger);
  }

  beginSession(metadata: Record<string, unknown> = {}): string {
    this.ensureOperational();

    if (this.lifecycle.getState() === AiLifecycleState.Ready) {
      this.lifecycle.transition(AiLifecycleState.Running, "session started");
      this.context.updateLifecycleState(AiLifecycleState.Running);
    }

    const session = this.sessions.createSession(metadata, this.logger);
    this.context.setActiveSession(session.id);
    return session.id;
  }

  endSession(sessionId: string): void {
    this.sessions.closeSession(sessionId, this.logger);
    if (this.context.getContext()?.activeSessionId === sessionId) {
      this.context.setActiveSession(undefined);
    }

    if (this.sessions.getActiveSessionCount() === 0) {
      const state = this.lifecycle.getState();
      if (state === AiLifecycleState.Running || state === AiLifecycleState.Paused) {
        this.lifecycle.transition(AiLifecycleState.Ready, "all sessions closed");
        this.context.updateLifecycleState(AiLifecycleState.Ready);
      }
    }
  }

  getRegistrySnapshot() {
    return this.registry.getAllEntries();
  }
}
