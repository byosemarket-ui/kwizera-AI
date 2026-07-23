import { TaskQueueCategory } from "./types.js";
const PRIORITY_RANK = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
    background: 4,
};
export class TaskQueueManager {
    queues = {
        interactive: [],
        background: [],
        learning: [],
        maintenance: [],
        recovery: [],
    };
    activeCategories = new Set();
    enqueue(task) {
        this.queues[task.queueCategory].push(task.id);
        this.sortQueue(task.queueCategory);
    }
    dequeue(category) {
        return this.queues[category].shift();
    }
    remove(taskId) {
        for (const category of Object.keys(this.queues)) {
            this.queues[category] = this.queues[category].filter((id) => id !== taskId);
        }
    }
    getQueueLength(category) {
        return this.queues[category].length;
    }
    getTotalQueued() {
        return Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
    }
    canRunInParallel(task) {
        if (this.activeCategories.has(task.queueCategory)) {
            return false;
        }
        if (task.queueCategory === TaskQueueCategory.Interactive) {
            return this.activeCategories.size === 0;
        }
        return !this.activeCategories.has(TaskQueueCategory.Interactive);
    }
    markActive(category) {
        this.activeCategories.add(category);
    }
    markInactive(category) {
        this.activeCategories.delete(category);
    }
    sortQueue(category) {
        // Queue order resolved at dequeue time via task lookup in scheduler
        this.queues[category].sort();
    }
    static comparePriority(a, b) {
        return PRIORITY_RANK[a] - PRIORITY_RANK[b];
    }
}
//# sourceMappingURL=task-queue-manager.js.map