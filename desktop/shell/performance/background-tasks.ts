import type { BackgroundTask, BackgroundTaskKind, BackgroundTaskPriority } from "./types";

type TaskHandler = (task: BackgroundTask) => Promise<void> | void;

export class BackgroundTaskManager {
  private queue: BackgroundTask[] = [];
  private running = 0;
  private handlers = new Map<BackgroundTaskKind, TaskHandler>();
  private productionActive = false;
  private maxParallel = 2;
  private throttle = 0.5;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(tickMs = 750): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.pump(), tickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  configure(options: { maxParallel: number; throttle: number; productionActive: boolean }): void {
    this.maxParallel = Math.max(1, options.maxParallel);
    this.throttle = options.throttle;
    this.productionActive = options.productionActive;
  }

  register(kind: BackgroundTaskKind, handler: TaskHandler): void {
    this.handlers.set(kind, handler);
  }

  enqueue(
    kind: BackgroundTaskKind,
    label: string,
    priority: BackgroundTaskPriority = "low",
    productionSafe = true,
  ): BackgroundTask {
    const task: BackgroundTask = {
      id: `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      priority,
      label,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      status: "queued",
      productionSafe,
    };
    this.queue.push(task);
    this.queue.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
    return task;
  }

  list(): BackgroundTask[] {
    return [...this.queue];
  }

  /** When production is active, defer non-safe low-priority work. Never cancel critical. */
  private async pump(): Promise<void> {
    if (this.running >= this.maxParallel) return;
    if (this.productionActive && Math.random() < this.throttle) return;

    const nextIndex = this.queue.findIndex((task) => {
      if (task.status !== "queued") return false;
      if (this.productionActive && !task.productionSafe && task.priority === "low") {
        task.status = "deferred";
        return false;
      }
      return true;
    });
    if (nextIndex < 0) {
      // Re-queue deferred when production idle
      if (!this.productionActive) {
        for (const task of this.queue) {
          if (task.status === "deferred") task.status = "queued";
        }
      }
      return;
    }

    const task = this.queue[nextIndex];
    task.status = "running";
    task.startedAt = new Date().toISOString();
    this.running += 1;
    try {
      const handler = this.handlers.get(task.kind);
      if (handler) await handler(task);
      task.status = "completed";
      task.completedAt = new Date().toISOString();
    } catch {
      task.status = "cancelled";
      task.completedAt = new Date().toISOString();
    } finally {
      this.running = Math.max(0, this.running - 1);
      this.queue = this.queue.filter((t) => t.status === "queued" || t.status === "running" || t.status === "deferred").slice(0, 40);
    }
  }
}

function priorityRank(priority: BackgroundTaskPriority): number {
  switch (priority) {
    case "critical": return 4;
    case "high": return 3;
    case "normal": return 2;
    default: return 1;
  }
}

export const backgroundTaskManager = new BackgroundTaskManager();
