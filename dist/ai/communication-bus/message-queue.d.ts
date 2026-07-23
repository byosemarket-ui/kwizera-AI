import { BusMessage, BusMessagePriority } from "./types.js";
export declare class MessageQueue {
    private readonly queue;
    private processedCount;
    enqueue(message: BusMessage): void;
    dequeue(): BusMessage | undefined;
    peek(): BusMessage | undefined;
    getDepth(): number;
    getProcessedCount(): number;
    clear(): void;
    getPriorityDistribution(): Record<BusMessagePriority, number>;
}
//# sourceMappingURL=message-queue.d.ts.map