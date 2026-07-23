import { AiLifecycleState } from "./types.js";
import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiContextManager } from "./ai-context-manager.js";
import type { AiRuntime } from "./ai-runtime.js";
import type { AiSessionManager } from "./ai-session-manager.js";

export interface AiShutdownManagerDeps {
  lifecycle: AiLifecycleManager;
  logger: AiCoreLogger;
  context: AiContextManager;
  runtime: AiRuntime;
  sessions: AiSessionManager;
}

export class AiShutdownManager {
  async shutdown(deps: AiShutdownManagerDeps, reason = "requested"): Promise<void> {
    const current = deps.lifecycle.getState();

    if (current === AiLifecycleState.Stopped) {
      return;
    }

    if (current !== AiLifecycleState.Stopping) {
      deps.lifecycle.transition(AiLifecycleState.Stopping, reason);
    }

    deps.logger.info("shutdown", "AI Core shutdown initiated", { reason });

    deps.sessions.closeAllSessions(deps.logger);
    deps.runtime.reset();
    deps.context.clear();

    deps.logger.flush();
    deps.lifecycle.transition(AiLifecycleState.Stopped, "shutdown complete");
    deps.logger.info("shutdown", "KWIZERA AI Core stopped");
  }
}
