import { randomUUID } from "node:crypto";
import { AiLifecycleState } from "./types.js";
export class AiContextManager {
    context = null;
    create(correlationId) {
        this.context = {
            correlationId: correlationId ?? randomUUID(),
            startedAt: new Date().toISOString(),
            lifecycleState: AiLifecycleState.Initializing,
            metadata: {},
        };
        return this.context;
    }
    getContext() {
        return this.context;
    }
    updateLifecycleState(state) {
        if (!this.context) {
            return;
        }
        this.context = {
            ...this.context,
            lifecycleState: state,
        };
    }
    setActiveSession(sessionId) {
        if (!this.context) {
            return;
        }
        this.context = {
            ...this.context,
            activeSessionId: sessionId,
        };
    }
    setMetadata(key, value) {
        if (!this.context) {
            return;
        }
        this.context = {
            ...this.context,
            metadata: { ...this.context.metadata, [key]: value },
        };
    }
    clear() {
        this.context = null;
    }
}
//# sourceMappingURL=ai-context-manager.js.map