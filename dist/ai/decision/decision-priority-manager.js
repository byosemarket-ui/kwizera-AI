import { DecisionEngineError, DecisionPriority } from "./types.js";
export class DecisionPriorityManager {
    activeCriticalId = null;
    acquire(priority, decisionId) {
        if (priority !== DecisionPriority.Critical) {
            return;
        }
        if (this.activeCriticalId && this.activeCriticalId !== decisionId) {
            throw new DecisionEngineError("Only one critical decision task may execute at a time", "CRITICAL_TASK_LIMIT");
        }
        this.activeCriticalId = decisionId;
    }
    release(decisionId) {
        if (this.activeCriticalId === decisionId) {
            this.activeCriticalId = null;
        }
    }
    hasActiveCritical() {
        return this.activeCriticalId !== null;
    }
    getActiveCriticalId() {
        return this.activeCriticalId;
    }
}
//# sourceMappingURL=decision-priority-manager.js.map