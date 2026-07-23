import { AiCoreError, AiLifecycleState } from "./types.js";
/**
 * Coordinates communication between AI Core subsystems and future modules.
 * No business logic — routing and lifecycle coordination only.
 */
export class AiCoordinator {
    lifecycle;
    registry;
    sessions;
    context;
    logger;
    constructor(lifecycle, registry, sessions, context, logger) {
        this.lifecycle = lifecycle;
        this.registry = registry;
        this.sessions = sessions;
        this.context = context;
        this.logger = logger;
    }
    ensureOperational() {
        if (!this.lifecycle.isOperational()) {
            throw new AiCoreError(`AI Core not operational (state: ${this.lifecycle.getState()})`, "CORE_NOT_OPERATIONAL");
        }
    }
    async registerFutureModule(plugin) {
        this.ensureOperational();
        this.registry.registerPlugin(plugin, this.logger);
    }
    beginSession(metadata = {}) {
        this.ensureOperational();
        if (this.lifecycle.getState() === AiLifecycleState.Ready) {
            this.lifecycle.transition(AiLifecycleState.Running, "session started");
            this.context.updateLifecycleState(AiLifecycleState.Running);
        }
        const session = this.sessions.createSession(metadata, this.logger);
        this.context.setActiveSession(session.id);
        return session.id;
    }
    endSession(sessionId) {
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
//# sourceMappingURL=ai-coordinator.js.map