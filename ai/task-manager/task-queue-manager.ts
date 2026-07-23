import { ManagedTask, TaskQueueCategory, TaskPriority } from "./types.js";

const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  background: 4,
};

export class TaskQueueManager {
  private readonly queues: Record<TaskQueueCategory, string[]> = {
    interactive: [],
    background: [],
    learning: [],
    maintenance: [],
    recovery: [],
  };

  private activeCategories = new Set<TaskQueueCategory>();

  enqueue(task: ManagedTask): void {
    this.queues[task.queueCategory].push(task.id);
    this.sortQueue(task.queueCategory);
  }

  dequeue(category: TaskQueueCategory): string | undefined {
    return this.queues[category].shift();
  }

  remove(taskId: string): void {
    for (const category of Object.keys(this.queues) as TaskQueueCategory[]) {
      this.queues[category] = this.queues[category].filter((id) => id !== taskId);
    }
  }

  getQueueLength(category: TaskQueueCategory): number {
    return this.queues[category].length;
  }

  getTotalQueued(): number {
    return Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
  }

  canRunInParallel(task: ManagedTask): boolean {
    if (this.activeCategories.has(task.queueCategory)) {
      return false;
    }
    if (task.queueCategory === TaskQueueCategory.Interactive) {
      return this.activeCategories.size === 0;
    }
    return !this.activeCategories.has(TaskQueueCategory.Interactive);
  }

  markActive(category: TaskQueueCategory): void {
    this.activeCategories.add(category);
  }

  markInactive(category: TaskQueueCategory): void {
    this.activeCategories.delete(category);
  }

  private sortQueue(category: TaskQueueCategory): void {
    // Queue order resolved at dequeue time via task lookup in scheduler
    this.queues[category].sort();
  }

  static comparePriority(a: TaskPriority, b: TaskPriority): number {
    return PRIORITY_RANK[a] - PRIORITY_RANK[b];
  }
}
