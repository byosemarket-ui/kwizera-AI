import { BusCommunicationState } from "./types.js";
export class RetryHandler {
    logger;
    policy;
    retryCounts = new Map();
    constructor(logger, policy = { maxRetries: 3, baseDelayMs: 10 }) {
        this.logger = logger;
        this.policy = policy;
    }
    canRetry(message) {
        return message.retryCount < this.policy.maxRetries;
    }
    async retry(message, retryFn) {
        message.status = BusCommunicationState.Retrying;
        message.retryCount += 1;
        this.retryCounts.set(message.messageId, message.retryCount);
        this.logger.log("warn", "retry", `Retry ${message.retryCount}/${this.policy.maxRetries}: ${message.messageId}`, {
            sender: message.sender,
            receiver: message.receiver,
        });
        if (this.policy.baseDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.policy.baseDelayMs * message.retryCount));
        }
        const success = await retryFn();
        message.status = success ? BusCommunicationState.Completed : BusCommunicationState.Failed;
        return { success, message };
    }
    getRetryCount(messageId) {
        return this.retryCounts.get(messageId) ?? 0;
    }
    getTotalRetries() {
        let total = 0;
        for (const count of this.retryCounts.values()) {
            total += count;
        }
        return total;
    }
}
//# sourceMappingURL=retry-handler.js.map