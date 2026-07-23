import type { PlanTask } from "../planning/types.js";

export class TaskScheduler {
  schedule(executionOrder: string[], tasks: PlanTask[]): PlanTask[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const scheduled: PlanTask[] = [];

    for (const id of executionOrder) {
      const task = taskMap.get(id);
      if (task) {
        scheduled.push(task);
      }
    }

    for (const task of tasks) {
      if (!scheduled.find((t) => t.id === task.id)) {
        scheduled.push(task);
      }
    }

    return scheduled;
  }

  getRemaining(completed: string[], scheduled: PlanTask[]): PlanTask[] {
    return scheduled.filter((t) => !completed.includes(t.id));
  }
}
