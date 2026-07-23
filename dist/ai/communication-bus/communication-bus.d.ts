import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import { ChannelRegistry } from "./channel-registry.js";
import { CommunicationBusLogger } from "./communication-bus-logger.js";
import { MessageHistoryStore } from "./message-history-store.js";
import { MessageQueue } from "./message-queue.js";
import { BusMessage, BusMessageInput, BusMessagePriority, BusMessageResult, BusStatusReport } from "./types.js";
/**
 * AI Communication Bus — official communication layer for KWIZERA AI STUDIO.
 * All inter-module communication must pass through this bus.
 */
export declare class AiCommunicationBus {
    private core;
    private moduleManager;
    private storageRoot;
    private initialized;
    readonly logger: CommunicationBusLogger;
    readonly history: MessageHistoryStore;
    readonly channels: ChannelRegistry;
    readonly queue: MessageQueue;
    private validator;
    private router;
    private retryHandler;
    private readonly messages;
    private readonly validationFailures;
    private routingStartMs;
    initialize(core: AiCoreManager, moduleManager: AiModuleManager, storageRoot: string): void;
    isInitialized(): boolean;
    registerChannel(moduleId: string, active?: boolean): void;
    send(input: BusMessageInput): Promise<BusMessageResult>;
    broadcast(sender: string, payload: BusMessage["payload"], priority?: BusMessagePriority, correlationId?: string): Promise<BusMessageResult>;
    sendHealthCheck(sender: string, receiver: string, correlationId?: string): Promise<BusMessageResult>;
    /** Adapter for Module Manager legacy communication API */
    routeLegacyRequest(senderId: string, receiverId: string, action: string, payload?: Record<string, unknown>, handler?: (payload: Record<string, unknown> | undefined) => Promise<unknown>): Promise<BusMessageResult>;
    getMessage(messageId: string): BusMessage | undefined;
    getMessages(): BusMessage[];
    getValidationFailures(): ReadonlyArray<string>;
    getChannelCount(): number;
    buildStatusReport(): BusStatusReport;
    private processMessage;
    private createMessage;
    private resolveRecord;
    private isDependencyAvailable;
    private ensureReady;
}
//# sourceMappingURL=communication-bus.d.ts.map