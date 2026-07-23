import { AiLifecycleState, AiRuntimeContext } from "./types.js";
export declare class AiContextManager {
    private context;
    create(correlationId?: string): AiRuntimeContext;
    getContext(): AiRuntimeContext | null;
    updateLifecycleState(state: AiLifecycleState): void;
    setActiveSession(sessionId: string | undefined): void;
    setMetadata(key: string, value: unknown): void;
    clear(): void;
}
//# sourceMappingURL=ai-context-manager.d.ts.map