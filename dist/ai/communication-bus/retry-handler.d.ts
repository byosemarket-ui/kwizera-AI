import { CommunicationBusLogger } from "./communication-bus-logger.js";
import { BusMessage } from "./types.js";
export interface RetryPolicy {
    maxRetries: number;
    baseDelayMs: number;
}
export declare class RetryHandler {
    private readonly logger;
    private readonly policy;
    private readonly retryCounts;
    constructor(logger: CommunicationBusLogger, policy?: RetryPolicy);
    canRetry(message: BusMessage): boolean;
    retry(message: BusMessage, retryFn: () => Promise<boolean>): Promise<{
        success: boolean;
        message: BusMessage;
    }>;
    getRetryCount(messageId: string): number;
    getTotalRetries(): number;
}
//# sourceMappingURL=retry-handler.d.ts.map