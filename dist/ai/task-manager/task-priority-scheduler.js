import { TaskPriority } from "./types.js";
import { TaskQueueManager } from "./task-queue-manager.js";
export class TaskPriorityScheduler {
    activeCriticalId = null;
    selectNext(tasks, queueIds) {
        const candidates = queueIds
            .map((id) => tasks.get(id))
            .filter((t) => t !== undefined)
            .sort((a, b) => TaskQueueManager.comparePriority(a.priority, b.priority));
        for (const task of candidates) {
            if (task.priority === TaskPriority.Critical) {
                if (this.activeCriticalId && this.activeCriticalId !== task.id) {
                    continue;
                }
            }
            return task;
        }
        return candidates[0];
    }
    acquireCritical(taskId, priority) {
        if (priority !== TaskPriority.Critical)
            return;
        this.activeCriticalId = taskId;
    }
    releaseCritical(taskId) {
        if (this.activeCriticalId === taskId) {
            this.activeCriticalId = null;
        }
    }
    hasActiveCritical() {
        return this.activeCriticalId !== null;
    }
}
//# sourceMappingURL=task-priority-scheduler.js.map