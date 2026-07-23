import type { AiCoreManager } from "../core/ai-core-manager.js";
import { CommunicationBusLogger } from "./communication-bus-logger.js";
import { MessageHistoryStore } from "./message-history-store.js";
import { RetryHandler } from "./retry-handler.js";
import {
  BusCommunicationState,
  BusMessage,
  BusMessageHistoryRecord,
  BusMessageType,
} from "./types.js";

export interface MessageRouterDeps {
  getCore: () => AiCoreManager;
}

export class MessageRouter {
  private totalLatencyMs = 0;
  private routedCount = 0;

  constructor(
    private readonly deps: MessageRouterDeps,
    private readonly logger: CommunicationBusLogger,
    private readonly history: MessageHistoryStore,
    private readonly retryHandler: RetryHandler
  ) {}

  async route(
    message: BusMessage,
    handler?: (payload: BusMessage["payload"] | undefined) => Promise<unknown>
  ): Promise<{ success: boolean; result?: unknown; errors: string[] }> {
    const start = Date.now();
    const errors: string[] = [];
    let result: unknown;
    let success = false;

    message.status = BusCommunicationState.Sending;

    const deliver = async (): Promise<boolean> => {
      message.status = BusCommunicationState.Delivered;
      message.status = BusCommunicationState.Received;
      message.status = BusCommunicationState.Processing;

      try {
        if (message.messageType === BusMessageType.Broadcast) {
          result = { broadcast: true, payload: message.payload };
          success = true;
        } else if (handler) {
          result = await handler(message.payload);
          success = true;
        } else if (
          message.messageType === BusMessageType.HealthCheck ||
          message.messageType === BusMessageType.Request
        ) {
          const core = this.deps.getCore();
          const plugin =
            core.registry.getPlugin(message.receiver) ??
            core.registry.getPlugin(message.module);
          if (!plugin) {
            errors.push(`No handler for ${message.receiver}`);
            return false;
          }
          const health = await plugin.healthCheck();
          result = { health, action: message.payload.action, payload: message.payload.data };
          success = health.healthy;
          if (!success) {
            errors.push("Health check failed");
          }
        } else if (message.messageType === BusMessageType.Response) {
          result = message.payload.data ?? {};
          success = true;
        } else {
          result = { acknowledged: true, type: message.messageType };
          success = true;
        }
        return success;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        return false;
      }
    };

    success = await deliver();

    if (!success && this.retryHandler.canRetry(message)) {
      const retryResult = await this.retryHandler.retry(message, deliver);
      success = retryResult.success;
    }

    message.executionTimeMs = Date.now() - start;
    message.status = success ? BusCommunicationState.Completed : BusCommunicationState.Failed;
    message.errors = errors.length ? errors : undefined;
    message.result = result;

    this.totalLatencyMs += message.executionTimeMs;
    this.routedCount += 1;

    const historyRecord: BusMessageHistoryRecord = {
      messageId: message.messageId,
      sender: message.sender,
      receiver: message.receiver,
      time: message.timestamp,
      type: message.messageType,
      priority: message.priority,
      result: success ? "success" : "failed",
      errors,
      retries: message.retryCount,
      performanceMs: message.executionTimeMs,
      learningValue: success ? 1 : 0,
    };
    this.history.append(historyRecord);

    this.logger.log(
      success ? "info" : "error",
      success ? "response" : "error",
      `Routed ${message.messageType}: ${message.sender} → ${message.receiver}`,
      {
        messageId: message.messageId,
        executionTimeMs: message.executionTimeMs,
        retryCount: message.retryCount,
      }
    );

    return { success, result, errors };
  }

  getAverageLatencyMs(): number {
    return this.routedCount > 0 ? Math.round(this.totalLatencyMs / this.routedCount) : 0;
  }

  getRoutedCount(): number {
    return this.routedCount;
  }
}
