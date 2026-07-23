import { BusMessage, BusMessagePriority, PRIORITY_ORDER } from "./types.js";

export class MessageQueue {
  private readonly queue: BusMessage[] = [];
  private processedCount = 0;

  enqueue(message: BusMessage): void {
    this.queue.push(message);
    this.queue.sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.timestamp.localeCompare(b.timestamp)
    );
  }

  dequeue(): BusMessage | undefined {
    const message = this.queue.shift();
    if (message) {
      this.processedCount += 1;
    }
    return message;
  }

  peek(): BusMessage | undefined {
    return this.queue[0];
  }

  getDepth(): number {
    return this.queue.length;
  }

  getProcessedCount(): number {
    return this.processedCount;
  }

  clear(): void {
    this.queue.length = 0;
  }

  getPriorityDistribution(): Record<BusMessagePriority, number> {
    const dist: Record<BusMessagePriority, number> = {
      [BusMessagePriority.Critical]: 0,
      [BusMessagePriority.High]: 0,
      [BusMessagePriority.Normal]: 0,
      [BusMessagePriority.Low]: 0,
      [BusMessagePriority.Background]: 0,
    };
    for (const msg of this.queue) {
      dist[msg.priority] += 1;
    }
    return dist;
  }
}
