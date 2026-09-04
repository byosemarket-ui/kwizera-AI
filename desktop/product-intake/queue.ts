import type { IntakeProgress, IntakeQueueItem, IntakeQueueStatus } from "./types";

/** Soft concurrency for VPS-safe parallel uploads (not unlimited). */
export const INTAKE_UPLOAD_CONCURRENCY = 2;

export class IntakeImportQueue {
  private items: IntakeQueueItem[] = [];
  private paused = false;
  private cancelled = false;

  reset(): void {
    this.items = [];
    this.paused = false;
    this.cancelled = false;
  }

  list(): IntakeQueueItem[] {
    return [...this.items];
  }

  enqueue(fileName: string, sizeBytes: number, mimeType: string): IntakeQueueItem {
    const item: IntakeQueueItem = {
      id: `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      fileName,
      sizeBytes,
      mimeType,
      status: "pending",
      progress: 0,
    };
    this.items.push(item);
    return item;
  }

  update(id: string, patch: Partial<IntakeQueueItem>): void {
    this.items = this.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  }

  /** Atomically claim the next pending item so parallel workers do not race. */
  claimNext(): IntakeQueueItem | null {
    if (this.paused || this.cancelled) return null;
    const item = this.items.find((entry) => entry.status === "pending");
    if (!item) return null;
    item.status = "validating";
    item.startedAt = new Date().toISOString();
    item.progress = Math.max(item.progress, 5);
    return { ...item };
  }

  pause(): void {
    this.paused = true;
    this.items = this.items.map((item) =>
      item.status === "pending" || item.status === "importing" || item.status === "validating"
        ? { ...item, status: "paused" as IntakeQueueStatus }
        : item,
    );
  }

  resume(): void {
    this.paused = false;
    this.items = this.items.map((item) =>
      item.status === "paused" ? { ...item, status: "pending" as IntakeQueueStatus } : item,
    );
  }

  cancelAll(): void {
    this.cancelled = true;
    this.items = this.items.map((item) =>
      item.status === "pending" || item.status === "paused" || item.status === "importing" || item.status === "validating"
        ? { ...item, status: "cancelled" as IntakeQueueStatus, finishedAt: new Date().toISOString() }
        : item,
    );
  }

  cancelOne(id: string): void {
    this.update(id, { status: "cancelled", finishedAt: new Date().toISOString() });
  }

  isPaused(): boolean {
    return this.paused;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  clearFlags(): void {
    this.paused = false;
    this.cancelled = false;
  }

  nextPending(): IntakeQueueItem | null {
    return this.claimNext();
  }

  progress(bytesPerSecond = 0, currentFile: string | null = null): IntakeProgress {
    const total = this.items.length;
    const completed = this.items.filter((i) => i.status === "completed").length;
    const failed = this.items.filter((i) => i.status === "failed").length;
    const cancelled = this.items.filter((i) => i.status === "cancelled").length;
    const done = completed + failed + cancelled;
    const remaining = Math.max(0, total - done);
    const running = this.items.some((i) => i.status === "importing" || i.status === "validating" || i.status === "pending");
    const percent = total ? Math.round((done / total) * 100) : 0;
    let statusLabel = "Idle";
    if (this.paused) statusLabel = "Paused";
    else if (running && currentFile) statusLabel = "Validating / importing…";
    else if (total && done === total) statusLabel = failed ? "Import finished with errors" : "Import Complete ✓";
    else if (running) statusLabel = "Importing…";
    return {
      total,
      completed,
      failed,
      cancelled,
      currentFile,
      percent,
      bytesPerSecond,
      remaining,
      statusLabel,
      running,
      paused: this.paused,
    };
  }
}
