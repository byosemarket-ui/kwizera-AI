import type { AiCoreManager } from "../core/ai-core-manager.js";
import { CommunicationBusLogger } from "./communication-bus-logger.js";
import { MessageHistoryStore } from "./message-history-store.js";
import { RetryHandler } from "./retry-handler.js";
import { BusMessage } from "./types.js";
export interface MessageRouterDeps {
    getCore: () => AiCoreManager;
}
export declare class MessageRouter {
    private readonly deps;
    private readonly logger;
    private readonly history;
    private readonly retryHandler;
    private totalLatencyMs;
    private routedCount;
    constructor(deps: MessageRouterDeps, logger: CommunicationBusLogger, history: MessageHistoryStore, retryHandler: RetryHandler);
    route(message: BusMessage, handler?: (payload: BusMessage["payload"] | undefined) => Promise<unknown>): Promise<{
        success: boolean;
        result?: unknown;
        errors: string[];
    }>;
    getAverageLatencyMs(): number;
    getRoutedCount(): number;
}
//# sourceMappingURL=message-router.d.ts.map