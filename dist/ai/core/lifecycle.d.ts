import { AiLifecycleState } from "./types.js";
export declare class AiLifecycleManager {
    private state;
    private readonly history;
    getState(): AiLifecycleState;
    getHistory(): ReadonlyArray<{
        state: AiLifecycleState;
        at: string;
    }>;
    transition(next: AiLifecycleState, reason?: string): void;
    reset(): void;
    isOperational(): boolean;
}
//# sourceMappingURL=lifecycle.d.ts.map