import { ManagedTaskState } from "./types.js";
export class TaskProgressTracker {
    createInitial() {
        return {
            status: ManagedTaskState.Created,
            progressPercent: 0,
            estimatedRemainingMs: 0,
            elapsedMs: 0,
            currentStage: "created",
            warnings: [],
            errors: [],
            recoveryAttempts: 0,
        };
    }
    transition(task, state, stage, percent) {
        task.state = state;
        task.progress.status = state;
        task.progress.currentStage = stage;
        task.progress.progressPercent = Math.min(100, Math.max(0, percent));
    }
    updateElapsed(task, elapsedMs, estimatedMs) {
        task.progress.elapsedMs = elapsedMs;
        task.progress.estimatedRemainingMs = Math.max(0, estimatedMs - elapsedMs);
        if (estimatedMs > 0) {
            task.progress.progressPercent = Math.min(99, Math.round((elapsedMs / estimatedMs) * 100));
        }
    }
    complete(task) {
        task.progress.progressPercent = 100;
        task.progress.estimatedRemainingMs = 0;
        task.progress.currentStage = "completed";
    }
}
//# sourceMappingURL=task-progress-tracker.js.map