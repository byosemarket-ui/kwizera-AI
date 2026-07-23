import { CommunicationBusLogger } from "./communication-bus-logger.js";
import { BusMessage, BusCommunicationState } from "./types.js";

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
}

export class RetryHandler {
  private readonly retryCounts = new Map<string, number>();

  constructor(
    private readonly logger: CommunicationBusLogger,
    private readonly policy: RetryPolicy = { maxRetries: 3, baseDelayMs: 10 }
  ) {}

  canRetry(message: BusMessage): boolean {
    return message.retryCount < this.policy.maxRetries;
  }

  async retry(
    message: BusMessage,
    retryFn: () => Promise<boolean>
  ): Promise<{ success: boolean; message: BusMessage }> {
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

  getRetryCount(messageId: string): number {
    return this.retryCounts.get(messageId) ?? 0;
  }

  getTotalRetries(): number {
    let total = 0;
    for (const count of this.retryCounts.values()) {
      total += count;
    }
    return total;
  }
}
