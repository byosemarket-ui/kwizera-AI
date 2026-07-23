import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import { ManagedModuleState, ModuleHealthStatus, ModuleRegistryRecord } from "../module-manager/types.js";
import { ChannelRegistry, FRAMEWORK_CHANNEL_CATALOG } from "./channel-registry.js";
import { CommunicationBusLogger } from "./communication-bus-logger.js";
import { MessageHistoryStore } from "./message-history-store.js";
import { MessageQueue } from "./message-queue.js";
import { MessageRouter } from "./message-router.js";
import { MessageValidator } from "./message-validator.js";
import { RetryHandler } from "./retry-handler.js";
import {
  BusCommunicationState,
  BusMessage,
  BusMessageInput,
  BusMessagePriority,
  BusMessageResult,
  BusMessageType,
  BusStatusReport,
  CommunicationBusError,
} from "./types.js";

let messageCounter = 0;

/**
 * AI Communication Bus — official communication layer for KWIZERA AI STUDIO.
 * All inter-module communication must pass through this bus.
 */
export class AiCommunicationBus {
  private core: AiCoreManager | null = null;
  private moduleManager: AiModuleManager | null = null;
  private storageRoot = "";
  private initialized = false;

  readonly logger = new CommunicationBusLogger();
  readonly history = new MessageHistoryStore();
  readonly channels = new ChannelRegistry();
  readonly queue = new MessageQueue();

  private validator: MessageValidator | null = null;
  private router: MessageRouter | null = null;
  private retryHandler: RetryHandler | null = null;

  private readonly messages = new Map<string, BusMessage>();
  private readonly validationFailures: string[] = [];
  private routingStartMs = 0;

  initialize(core: AiCoreManager, moduleManager: AiModuleManager, storageRoot: string): void {
    this.core = core;
    this.moduleManager = moduleManager;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const commDir = path.join(storageRoot, "communications");
    this.logger.initialize(logDir);
    this.history.initialize(commDir);
    this.channels.registerAll(FRAMEWORK_CHANNEL_CATALOG);

    this.retryHandler = new RetryHandler(this.logger);
    this.validator = new MessageValidator({
      resolveRecord: (id) => this.resolveRecord(id),
      isIsolated: (id) => this.moduleManager!.isModuleIsolated(id),
      channels: this.channels,
      isDependencyAvailable: (dep) => this.isDependencyAvailable(dep),
    });
    this.router = new MessageRouter(
      { getCore: () => this.core! },
      this.logger,
      this.history,
      this.retryHandler
    );

    this.initialized = true;
    this.routingStartMs = Date.now();
    this.logger.log("info", "request", "AI Communication Bus initialized", {
      channels: this.channels.getCount(),
      storageRoot,
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  registerChannel(moduleId: string, active = true): void {
    this.channels.setActive(moduleId, active);
    this.logger.log("info", "request", `Channel updated: ${moduleId}`, { active });
  }

  async send(input: BusMessageInput): Promise<BusMessageResult> {
    this.ensureReady();

    const message = this.createMessage(input);
    message.status = BusCommunicationState.Created;
    this.messages.set(message.messageId, message);

    const validation = this.validator!.validate(message);
    if (!validation.valid) {
      message.status = BusCommunicationState.Failed;
      message.errors = [validation.rejectionReason ?? "Validation failed"];
      this.validationFailures.push(message.messageId);
      this.logger.log("warn", "validation", `Message rejected: ${message.messageId}`, {
        reason: validation.rejectionReason,
        checks: validation.checks,
      });
      this.history.append({
        messageId: message.messageId,
        sender: message.sender,
        receiver: message.receiver,
        time: message.timestamp,
        type: message.messageType,
        priority: message.priority,
        result: "rejected",
        errors: message.errors,
        retries: 0,
        performanceMs: 0,
        learningValue: 0,
      });
      throw new CommunicationBusError(
        validation.rejectionReason ?? "Message validation failed",
        "VALIDATION_FAILED",
        message.messageId
      );
    }

    message.status = BusCommunicationState.Queued;
    this.queue.enqueue(message);
    this.logger.log("info", "request", `Message queued: ${message.messageId}`, {
      priority: message.priority,
      type: message.messageType,
    });

    return this.processMessage(message, input.handler);
  }

  async broadcast(
    sender: string,
    payload: BusMessage["payload"],
    priority: BusMessagePriority = BusMessagePriority.Normal,
    correlationId?: string
  ): Promise<BusMessageResult> {
    return this.send({
      sender,
      receiver: "*",
      messageType: BusMessageType.Broadcast,
      priority,
      payload,
      correlationId,
    });
  }

  async sendHealthCheck(
    sender: string,
    receiver: string,
    correlationId?: string
  ): Promise<BusMessageResult> {
    return this.send({
      sender,
      receiver,
      module: receiver,
      messageType: BusMessageType.HealthCheck,
      priority: BusMessagePriority.High,
      payload: { action: "health-check" },
      correlationId,
    });
  }

  /** Adapter for Module Manager legacy communication API */
  async routeLegacyRequest(
    senderId: string,
    receiverId: string,
    action: string,
    payload?: Record<string, unknown>,
    handler?: (payload: Record<string, unknown> | undefined) => Promise<unknown>
  ): Promise<BusMessageResult> {
    return this.send({
      sender: senderId,
      receiver: receiverId,
      module: receiverId,
      messageType: BusMessageType.Request,
      priority: BusMessagePriority.Normal,
      payload: { action, data: payload },
      handler: handler
        ? async (p) => handler(p?.data as Record<string, unknown> | undefined)
        : undefined,
    });
  }

  getMessage(messageId: string): BusMessage | undefined {
    return this.messages.get(messageId);
  }

  getMessages(): BusMessage[] {
    return Array.from(this.messages.values());
  }

  getValidationFailures(): ReadonlyArray<string> {
    return this.validationFailures;
  }

  getChannelCount(): number {
    return this.channels.getCount();
  }

  buildStatusReport(): BusStatusReport {
    const queueDepth = this.queue.getDepth();
    const throughput = this.queue.getProcessedCount();
    const avgLatency = this.router?.getAverageLatencyMs() ?? 0;
    const mem = process.memoryUsage();
    const knownIssues: string[] = [];

    if (this.validationFailures.length > 0) {
      knownIssues.push(`${this.validationFailures.length} message(s) rejected by validation`);
    }
    if ((this.retryHandler?.getTotalRetries() ?? 0) > 0) {
      knownIssues.push(`${this.retryHandler!.getTotalRetries()} retry attempt(s) recorded`);
    }

    let readinessScore = 100;
    if (this.validationFailures.length > 5) readinessScore -= 10;
    if (!this.initialized) readinessScore = 0;
    readinessScore = Math.max(0, Math.min(100, readinessScore));

    const uptimeMs = Date.now() - this.routingStartMs;

    return {
      communicationBusStatus: this.initialized ? "operational" : "not-initialized",
      routingStatus: `${this.router?.getRoutedCount() ?? 0} message(s) routed`,
      validationStatus:
        this.validationFailures.length === 0
          ? "all messages validated"
          : `${this.validationFailures.length} rejection(s)`,
      queuePerformance: `depth ${queueDepth}, processed ${throughput}, uptime ${uptimeMs}ms`,
      recoveryStatus:
        (this.retryHandler?.getTotalRetries() ?? 0) > 0
          ? `${this.retryHandler!.getTotalRetries()} retries handled`
          : "no retries required",
      performance: {
        routingSpeedMs: avgLatency,
        queueDepth,
        messageThroughput: throughput,
        averageLatencyMs: avgLatency,
        memoryUsageMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      },
      knownIssues,
      readinessScore,
      timestamp: new Date().toISOString(),
    };
  }

  private async processMessage(
    message: BusMessage,
    handler?: BusMessageInput["handler"]
  ): Promise<BusMessageResult> {
    this.queue.dequeue();
    const { success, result, errors } = await this.router!.route(message, handler);

    if (!success && errors.length) {
      this.logger.log("error", "error", `Communication failed: ${message.messageId}`, { errors });
    }

    return {
      success,
      message,
      result,
    };
  }

  private createMessage(input: BusMessageInput): BusMessage {
    return {
      messageId: `msg-${++messageCounter}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sender: input.sender,
      receiver: input.receiver,
      module: input.module ?? input.receiver,
      messageType: input.messageType,
      priority: input.priority ?? BusMessagePriority.Normal,
      payload: input.payload ?? { action: "communicate", data: {} },
      status: BusCommunicationState.Created,
      executionTimeMs: 0,
      retryCount: 0,
      correlationId: input.correlationId ?? `corr-${Date.now()}`,
    };
  }

  private resolveRecord(id: string): ModuleRegistryRecord | undefined {
    if (id === "module-manager") {
      return {
        moduleId: "module-manager",
        moduleName: "Module Manager",
        version: "0.1.0",
        status: ManagedModuleState.Running,
        dependencies: ["ai-core"],
        capabilities: { features: ["module-control"], interfaces: ["module-api"] },
        owner: "KWIZERA AI",
        registrationDate: new Date().toISOString(),
        healthStatus: ModuleHealthStatus.Healthy,
        lastActivity: new Date().toISOString(),
        compatibility: ">=0.1.0",
        enabled: true,
      };
    }
    return this.moduleManager?.getRegistryRecord(id) ??
      this.moduleManager?.getAllRegistryRecords().find((r) => r.slotId === id);
  }

  private isDependencyAvailable(dep: string): boolean {
    if (dep === "ai-core") {
      return this.core?.isReady() ?? false;
    }
    const record = this.resolveRecord(dep);
    if (!record) {
      return this.channels.get(dep)?.active ?? false;
    }
    return (
      record.enabled &&
      (record.status === ManagedModuleState.Running ||
        record.status === ManagedModuleState.Ready)
    );
  }

  private ensureReady(): void {
    if (!this.initialized || !this.core || !this.moduleManager) {
      throw new CommunicationBusError("Communication Bus not initialized", "NOT_INITIALIZED");
    }
  }
}
