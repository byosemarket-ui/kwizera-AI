import { DecisionEngineError, DecisionPriority } from "./types.js";

export class DecisionPriorityManager {
  private activeCriticalId: string | null = null;

  acquire(priority: DecisionPriority, decisionId: string): void {
    if (priority !== DecisionPriority.Critical) {
      return;
    }
    if (this.activeCriticalId && this.activeCriticalId !== decisionId) {
      throw new DecisionEngineError(
        "Only one critical decision task may execute at a time",
        "CRITICAL_TASK_LIMIT"
      );
    }
    this.activeCriticalId = decisionId;
  }

  release(decisionId: string): void {
    if (this.activeCriticalId === decisionId) {
      this.activeCriticalId = null;
    }
  }

  hasActiveCritical(): boolean {
    return this.activeCriticalId !== null;
  }

  getActiveCriticalId(): string | null {
    return this.activeCriticalId;
  }
}
