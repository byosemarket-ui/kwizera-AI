import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BusMessagePriority,
  BusMessageType,
  CommunicationBusError,
  createAiCore,
  FRAMEWORK_CHANNEL_CATALOG,
  MessageQueue,
  PRIORITY_ORDER,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-communication-bus-test-"));
}

describe("MessageQueue", () => {
  it("prioritizes critical messages over background", () => {
    const queue = new MessageQueue();
    const now = new Date().toISOString();

    queue.enqueue({
      messageId: "bg-1",
      timestamp: now,
      sender: "a",
      receiver: "b",
      module: "b",
      messageType: BusMessageType.Request,
      priority: BusMessagePriority.Background,
      payload: {},
      status: "queued" as never,
      executionTimeMs: 0,
      retryCount: 0,
      correlationId: "c1",
    });

    queue.enqueue({
      messageId: "crit-1",
      timestamp: now,
      sender: "a",
      receiver: "b",
      module: "b",
      messageType: BusMessageType.Request,
      priority: BusMessagePriority.Critical,
      payload: {},
      status: "queued" as never,
      executionTimeMs: 0,
      retryCount: 0,
      correlationId: "c2",
    });

    expect(queue.dequeue()?.messageId).toBe("crit-1");
    expect(PRIORITY_ORDER[BusMessagePriority.Critical]).toBeLessThan(
      PRIORITY_ORDER[BusMessagePriority.Background]
    );
  });
});

describe("AiCommunicationBus", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(async () => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("initializes with framework channels for all supported modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bus-init-test");

    const bus = core.getManager().communicationBus!;
    expect(bus.isInitialized()).toBe(true);
    expect(bus.getChannelCount()).toBe(FRAMEWORK_CHANNEL_CATALOG.length);

    await core.stop();
  });

  it("routes requests through the bus via module manager", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bus-route-test");

    const manager = core.getManager().moduleManager!;
    const response = await manager.routeCommunication({
      senderId: "ai-core",
      receiverId: "reasoning-engine",
      action: "health-probe",
    });

    expect(response.success).toBe(true);
    expect(manager.getCommunicationRecords().length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("validates and rejects messages to inactive receivers", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bus-validation-test");

    const bus = core.getManager().communicationBus!;
    core.getManager().moduleManager!.disableModule("reasoning-engine");

    await expect(
      bus.sendHealthCheck("ai-core", "reasoning-engine")
    ).rejects.toThrow(CommunicationBusError);

    expect(bus.getValidationFailures().length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("supports broadcast messages", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bus-broadcast-test");

    const bus = core.getManager().communicationBus!;
    const result = await bus.broadcast("ai-core", { action: "system-notice", data: { text: "hello" } });

    expect(result.success).toBe(true);
    expect(result.message.messageType).toBe(BusMessageType.Broadcast);

    await core.stop();
  });

  it("retries failed communication with custom handler", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bus-retry-test");

    const bus = core.getManager().communicationBus!;
    let attempts = 0;

    const result = await bus.send({
      sender: "ai-core",
      receiver: "task-manager",
      messageType: BusMessageType.Request,
      priority: BusMessagePriority.High,
      payload: { action: "retry-test" },
      handler: async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("Simulated failure");
        }
        return { recovered: true };
      },
    });

    expect(result.success).toBe(true);
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(result.message.retryCount).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("stores message history and writes logs", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bus-history-test");

    const bus = core.getManager().communicationBus!;
    await bus.sendHealthCheck("ai-core", "decision-engine");

    expect(bus.history.getCount()).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(bus.history.getHistoryPath() ?? "")).toBe(true);

    const logDir = bus.logger.getLogDirectory();
    expect(logDir).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(logDir!)).toBe(true);

    await core.stop();
  });

  it("builds status report with performance metrics", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bus-report-test");

    const bus = core.getManager().communicationBus!;
    await bus.sendHealthCheck("ai-core", "workflow-engine");

    const report = bus.buildStatusReport();
    expect(report.communicationBusStatus).toBe("operational");
    expect(report.routingStatus).toContain("routed");
    expect(report.readinessScore).toBeGreaterThanOrEqual(80);

    await core.stop();
  });
});
