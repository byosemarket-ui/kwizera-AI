import { DecisionPriority } from "./types.js";
export declare class DecisionPriorityManager {
    private activeCriticalId;
    acquire(priority: DecisionPriority, decisionId: string): void;
    release(decisionId: string): void;
    hasActiveCritical(): boolean;
    getActiveCriticalId(): string | null;
}
//# sourceMappingURL=decision-priority-manager.d.ts.map