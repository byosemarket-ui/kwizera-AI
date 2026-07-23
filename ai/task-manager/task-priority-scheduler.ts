import { ManagedTask, TaskPriority } from "./types.js";
import { TaskQueueManager } from "./task-queue-manager.js";

export class TaskPriorityScheduler {
  private activeCriticalId: string | null = null;

  selectNext(
    tasks: Map<string, ManagedTask>,
    queueIds: string[]
  ): ManagedTask | undefined {
    const candidates = queueIds
      .map((id) => tasks.get(id))
      .filter((t): t is ManagedTask => t !== undefined)
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

  acquireCritical(taskId: string, priority: TaskPriority): void {
    if (priority !== TaskPriority.Critical) return;
    this.activeCriticalId = taskId;
  }

  releaseCritical(taskId: string): void {
    if (this.activeCriticalId === taskId) {
      this.activeCriticalId = null;
    }
  }

  hasActiveCritical(): boolean {
    return this.activeCriticalId !== null;
  }
}
