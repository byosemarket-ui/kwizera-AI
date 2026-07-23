import { BusMessagePriority, PRIORITY_ORDER } from "./types.js";
export class MessageQueue {
    queue = [];
    processedCount = 0;
    enqueue(message) {
        this.queue.push(message);
        this.queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            a.timestamp.localeCompare(b.timestamp));
    }
    dequeue() {
        const message = this.queue.shift();
        if (message) {
            this.processedCount += 1;
        }
        return message;
    }
    peek() {
        return this.queue[0];
    }
    getDepth() {
        return this.queue.length;
    }
    getProcessedCount() {
        return this.processedCount;
    }
    clear() {
        this.queue.length = 0;
    }
    getPriorityDistribution() {
        const dist = {
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
//# sourceMappingURL=message-queue.js.map