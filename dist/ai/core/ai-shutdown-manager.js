import { AiLifecycleState } from "./types.js";
export class AiShutdownManager {
    async shutdown(deps, reason = "requested") {
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
//# sourceMappingURL=ai-shutdown-manager.js.map