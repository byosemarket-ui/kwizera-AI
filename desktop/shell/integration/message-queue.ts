import type { MessagePriority, QueuedMessage, WorkspaceEvent } from "./types";

const PRIORITY_RANK: Record<MessagePriority, number> = {
  critical: 5,
  high: 4,
  normal: 3,
  low: 2,
  background: 1,
};

const STORAGE_KEY = "kwizera.workspace-message-queue.v1";

export class IntegrationMessageQueue {
  private items: QueuedMessage[] = [];
  private seenIds = new Set<string>();

  constructor(private readonly maxSize = 200) {
    this.hydrate();
  }

  enqueue(event: WorkspaceEvent, options?: { delayMs?: number; maxAttempts?: number }): QueuedMessage | null {
    // Never duplicate messages by event id
    if (this.seenIds.has(event.id) || this.items.some((i) => i.event.id === event.id)) {
      return null;
    }
    const message: QueuedMessage = {
      id: `q-${event.id}`,
      event,
      priority: event.priority,
      status: options?.delayMs ? "delayed" : "queued",
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      availableAt: Date.now() + (options?.delayMs ?? 0),
    };
    this.items.push(message);
    this.seenIds.add(event.id);
    this.sort();
    this.trim();
    this.persist();
    return message;
  }

  /** Dequeue next ready message by priority. */
  dequeue(): QueuedMessage | null {
    const now = Date.now();
    const index = this.items.findIndex((item) =>
      (item.status === "queued" || item.status === "delayed" || item.status === "retrying")
      && item.availableAt <= now,
    );
    if (index < 0) return null;
    const item = this.items[index];
    item.status = "delivering";
    this.persist();
    return item;
  }

  markDelivered(id: string): void {
    this.items = this.items.filter((item) => item.id !== id);
    this.persist();
  }

  markFailed(id: string, error: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.attempts += 1;
    item.lastError = error;
    if (item.attempts >= item.maxAttempts) {
      item.status = "failed";
    } else {
      item.status = "retrying";
      item.availableAt = Date.now() + Math.min(30_000, 500 * 2 ** item.attempts);
    }
    this.sort();
    this.persist();
  }

  depth(): number {
    return this.items.filter((i) => i.status !== "failed").length;
  }

  failedCount(): number {
    return this.items.filter((i) => i.status === "failed").length;
  }

  list(): QueuedMessage[] {
    return [...this.items];
  }

  /** Re-queue failed messages that are still recoverable (manual repair). */
  repairFailed(): number {
    let repaired = 0;
    for (const item of this.items) {
      if (item.status === "failed" && item.attempts < item.maxAttempts + 2) {
        item.status = "retrying";
        item.availableAt = Date.now();
        item.maxAttempts += 1;
        repaired += 1;
      }
    }
    this.sort();
    this.persist();
    return repaired;
  }

  private sort(): void {
    this.items.sort((a, b) => {
      const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (pr !== 0) return pr;
      return a.availableAt - b.availableAt;
    });
  }

  private trim(): void {
    if (this.items.length <= this.maxSize) return;
    // Drop lowest priority delivered/failed first, never drop critical queued
    this.items = this.items
      .filter((i) => i.priority === "critical" || i.status === "queued" || i.status === "retrying" || i.status === "delayed")
      .slice(0, this.maxSize);
  }

  private hydrate(): void {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { items?: QueuedMessage[] } | null;
      this.items = (raw?.items ?? []).slice(0, this.maxSize);
      this.seenIds = new Set(this.items.map((i) => i.event.id));
    } catch {
      this.items = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        items: this.items.slice(0, this.maxSize),
      }));
    } catch {
      /* quota — drop background */
      this.items = this.items.filter((i) => i.priority !== "background").slice(0, 80);
    }
  }
}
