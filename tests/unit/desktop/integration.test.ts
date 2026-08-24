import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { WorkspaceEventBus } from "../../../desktop/shell/integration/event-bus.ts";
import { IntegrationMessageQueue } from "../../../desktop/shell/integration/message-queue.ts";
import { StateSyncStore, emptySharedState } from "../../../desktop/shell/integration/state-sync.ts";
import { WorkflowSynchronizer } from "../../../desktop/shell/integration/workflow-sync.ts";
import {
  buildErrorPropagationEvent, relatedModulesForError, recommendRecovery,
} from "../../../desktop/shell/integration/error-propagation.ts";
import { WorkspaceIntegrationEngine } from "../../../desktop/shell/integration/integration-engine.ts";
import { buildAiMeIntegrationContext } from "../../../desktop/shell/integration/aime-integration-awareness.ts";
import { ALL_WORKSPACE_EVENT_TYPES } from "../../../desktop/shell/integration/types.ts";
import type { WorkspaceEvent } from "../../../desktop/shell/integration/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  return store;
}

function sampleEvent(overrides: Partial<WorkspaceEvent> = {}): WorkspaceEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    type: "project.loaded",
    source: "workspace",
    at: new Date().toISOString(),
    correlationId: "corr-1",
    priority: "normal",
    payload: { name: "Demo" },
    ...overrides,
  };
}

describe("Event Bus", () => {
  it("delivers to specific and wildcard subscribers without duplication of delivery count", async () => {
    const bus = new WorkspaceEventBus();
    const seen: string[] = [];
    bus.subscribe("project.loaded", (e) => { seen.push(`s:${e.type}`); });
    bus.subscribe("*", (e) => { seen.push(`*:${e.type}`); });
    await bus.publish(sampleEvent({ type: "project.loaded" }));
    expect(seen).toEqual(["s:project.loaded", "*:project.loaded"]);
    expect(bus.getDeliveredCount()).toBe(1);
  });

  it("isolates handler failures", async () => {
    const bus = new WorkspaceEventBus();
    let ok = false;
    bus.subscribe("*", () => { throw new Error("boom"); });
    bus.subscribe("*", () => { ok = true; });
    await bus.publish(sampleEvent());
    expect(ok).toBe(true);
  });
});

describe("Message Queue", () => {
  beforeEach(() => mockStorage());

  it("dedupes by event id and supports priority order", () => {
    const q = new IntegrationMessageQueue();
    const low = sampleEvent({ id: "a", priority: "low", type: "module.message" });
    const high = sampleEvent({ id: "b", priority: "critical", type: "module.error" });
    expect(q.enqueue(low)).not.toBeNull();
    expect(q.enqueue(low)).toBeNull();
    expect(q.enqueue(high)).not.toBeNull();
    const first = q.dequeue();
    expect(first?.event.id).toBe("b");
  });

  it("retries failed messages with backoff then repair", () => {
    const q = new IntegrationMessageQueue();
    const msg = q.enqueue(sampleEvent({ id: "r1", priority: "high" }))!;
    q.dequeue();
    q.markFailed(msg.id, "temp");
    q.markFailed(msg.id, "temp");
    q.markFailed(msg.id, "temp");
    expect(q.failedCount()).toBe(1);
    expect(q.repairFailed()).toBe(1);
    expect(q.failedCount()).toBe(0);
  });

  it("honors delayed availability", () => {
    const q = new IntegrationMessageQueue();
    q.enqueue(sampleEvent({ id: "d1" }), { delayMs: 60_000 });
    expect(q.dequeue()).toBeNull();
    expect(q.depth()).toBe(1);
  });
});

describe("State Sync", () => {
  beforeEach(() => mockStorage());

  it("shares product/analysis/export state and rejects stale revisions", () => {
    const store = new StateSyncStore();
    store.applyEvent(sampleEvent({ type: "images.imported", payload: { images: [{ id: "1", name: "a.png" }] } }));
    store.applyEvent(sampleEvent({
      type: "product-analysis.completed",
      payload: { results: { score: 9 } },
    }));
    const state = store.get();
    expect(state.uploadedImages[0]?.name).toBe("a.png");
    expect(state.analysisResults).toEqual({ score: 9 });
    const rev = state.revision;
    expect(store.share({ progress: 50 }, rev - 1).ok).toBe(false);
    expect(store.share({ progress: 50 }, rev).ok).toBe(true);
    expect(store.get().progress).toBe(50);
  });

  it("starts from empty shared state shape", () => {
    expect(emptySharedState().productionStatus).toBe("idle");
  });
});

describe("Workflow Synchronization", () => {
  it("enforces dependency order and blocks on failure", () => {
    const wf = new WorkflowSynchronizer();
    expect(wf.nextReady().map((s) => s.id)).toContain("load");
    wf.observe(sampleEvent({ type: "project.loaded" }));
    expect(wf.canStart("images.imported")).toBe(true);
    expect(wf.canStart("marketing.completed")).toBe(false);
    wf.observe(sampleEvent({ type: "images.imported" }));
    wf.observe(sampleEvent({
      type: "error.propagated",
      payload: { relatedEvent: "product-analysis.completed" },
    }));
    const analysis = wf.snapshot().find((s) => s.id === "analysis");
    expect(analysis?.status).toBe("failed");
    expect(wf.snapshot().find((s) => s.id === "marketing")?.status).toBe("failed");
  });
});

describe("Error Propagation", () => {
  it("notifies related modules and recommends recovery", () => {
    const source = sampleEvent({ type: "rendering.started", source: "rendering" });
    const related = relatedModulesForError(source);
    expect(related).toContain("output");
    expect(related).toContain("ai-me");
    const propagated = buildErrorPropagationEvent(source, "GPU OOM");
    expect(propagated.type).toBe("error.propagated");
    expect(propagated.payload.recovery).toContain("GPU");
    expect(recommendRecovery("export.started", "disk full").toLowerCase()).toContain("disk");
  });
});

describe("Integration Engine", () => {
  beforeEach(() => {
    mockStorage();
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits live events, notifies, and syncs state", async () => {
    const engine = new WorkspaceIntegrationEngine();
    const notes: string[] = [];
    engine.start({
      notify: (tone, title) => { notes.push(`${tone}:${title}`); },
    });
    await engine.emit({
      type: "product-analysis.completed",
      source: "product-analysis",
      payload: { results: { ok: true }, summary: "Analysis done" },
      priority: "normal",
    });
    const snap = engine.snapshot();
    expect(snap.busOnline).toBe(true);
    expect(snap.shared.analysisResults).toEqual({ ok: true });
    expect(snap.deliveredCount).toBeGreaterThan(0);
    expect(notes.some((n) => n.includes("success"))).toBe(true);
    expect(buildAiMeIntegrationContext(snap).busOnline).toBe(true);
    engine.stop();
  });

  it("sends module messages and reports errors without cascade start", async () => {
    const engine = new WorkspaceIntegrationEngine();
    engine.start();
    await engine.sendModuleMessage("workspace", ["ai-me", "marketing"], "ping", { n: 1 });
    const err = await engine.reportError(
      sampleEvent({ type: "marketing.started", source: "marketing" }),
      "timeout",
    );
    expect(err.type).toBe("error.propagated");
    expect(err.targets).toContain("storytelling");
    engine.stop();
  });

  it("does not double-subscribe on restart", async () => {
    const engine = new WorkspaceIntegrationEngine();
    let hits = 0;
    engine.bus.subscribe("sync.completed", () => { hits += 1; });
    engine.start();
    engine.stop();
    engine.start();
    await engine.emit({ type: "sync.completed", source: "workspace", priority: "normal" });
    // One delivery to specific handler (wildcard also applies state, not this counter)
    expect(hits).toBe(1);
    engine.stop();
  });
});

describe("Catalog", () => {
  it("includes production lifecycle events", () => {
    expect(ALL_WORKSPACE_EVENT_TYPES).toContain("project.created");
    expect(ALL_WORKSPACE_EVENT_TYPES).toContain("export.completed");
    expect(ALL_WORKSPACE_EVENT_TYPES).toContain("ai.recommendation");
    expect(ALL_WORKSPACE_EVENT_TYPES.length).toBeGreaterThan(30);
  });
});
