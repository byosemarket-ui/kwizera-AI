import type { CoreStatus } from "../types";
import { sessionStore } from "../workspace-state/session-store";
import type {
  IntegrationSnapshot, MessagePriority, WorkspaceEvent, WorkspaceEventType, WorkspaceModuleId,
} from "./types";
import { WorkspaceEventBus } from "./event-bus";
import { IntegrationMessageQueue } from "./message-queue";
import { StateSyncStore } from "./state-sync";
import { WorkflowSynchronizer } from "./workflow-sync";
import { buildErrorPropagationEvent } from "./error-propagation";
import { buildAiMeIntegrationContext } from "./aime-integration-awareness";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

export class WorkspaceIntegrationEngine {
  readonly bus = new WorkspaceEventBus();
  readonly queue = new IntegrationMessageQueue();
  readonly state = new StateSyncStore();
  readonly workflow = new WorkflowSynchronizer();

  private notify: NotifyFn | null = null;
  private aiBusBridged = false;
  private pumpTimer: ReturnType<typeof setInterval> | null = null;
  private unsubBus: (() => void) | null = null;
  private listeners = new Set<(snap: IntegrationSnapshot) => void>();
  private historyCategories = new Set<string>();
  private started = false;

  start(options?: { notify?: NotifyFn; core?: CoreStatus | null }): void {
    if (options?.notify) this.notify = options.notify;
    this.setCore(options?.core ?? null);
    if (this.started) {
      this.emitSnapshot();
      return;
    }
    this.started = true;

    this.unsubBus = this.bus.subscribe("*", async (event) => {
      this.state.applyEvent(event);
      this.workflow.observe(event);
      this.mirrorHistory(event);
      if (event.notify && this.notify) {
        this.notify(event.notify.tone, event.notify.title, event.notify.detail, event.notify.category);
      }
      this.emitSnapshot();
    });

    // Safe repair of persisted failed messages from prior sessions
    this.queue.repairFailed();

    this.pumpTimer = setInterval(() => void this.pump(), 250);
    void this.emit({
      type: "module.ready",
      source: "integration",
      priority: "normal",
      payload: { module: "integration" },
    });
  }

  stop(): void {
    if (this.pumpTimer) clearInterval(this.pumpTimer);
    this.pumpTimer = null;
    this.unsubBus?.();
    this.unsubBus = null;
    this.started = false;
  }

  setCore(core: CoreStatus | null): void {
    const bridged = Boolean(core?.communicationBus);
    if (bridged !== this.aiBusBridged) {
      this.aiBusBridged = bridged;
      void this.emit({
        type: bridged ? "bus.bridged" : "bus.offline",
        source: "integration",
        priority: "low",
        payload: { communicationBus: bridged },
        notify: bridged
          ? { tone: "info", title: "AI bus bridged", detail: "Workspace events can mirror to the AI Communication Bus.", category: "updates" }
          : undefined,
      });
    }
  }

  subscribe(listener: (snap: IntegrationSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): IntegrationSnapshot {
    const failed = this.queue.failedCount();
    return {
      version: 1,
      busOnline: this.bus.isOnline(),
      aiBusBridged: this.aiBusBridged,
      queueDepth: this.queue.depth(),
      deliveredCount: this.bus.getDeliveredCount(),
      failedCount: failed,
      lastEvents: this.bus.getRecent(12),
      shared: this.state.get(),
      workflow: this.workflow.snapshot(),
      recommendation: failed
        ? "Repair failed messages before continuing blocked workflow steps."
        : this.aiBusBridged
          ? "Integration healthy — AI bus bridged."
          : "Local offline bus healthy.",
    };
  }

  buildAiMeContext() {
    return buildAiMeIntegrationContext(this.snapshot());
  }

  /** Publish + enqueue for reliable delivery. Never loses important events. */
  async emit(input: {
    type: WorkspaceEventType;
    source: WorkspaceModuleId;
    targets?: WorkspaceModuleId[];
    payload?: Record<string, unknown>;
    priority?: MessagePriority;
    correlationId?: string;
    notify?: WorkspaceEvent["notify"];
    delayMs?: number;
  }): Promise<WorkspaceEvent> {
    const event: WorkspaceEvent = {
      id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      type: input.type,
      source: input.source,
      targets: input.targets,
      at: new Date().toISOString(),
      correlationId: input.correlationId ?? `corr-${Date.now().toString(36)}`,
      priority: input.priority ?? defaultPriority(input.type),
      payload: input.payload ?? {},
      notify: input.notify ?? autoNotify(input.type, input.payload),
    };

    const queued = this.queue.enqueue(event, { delayMs: input.delayMs });

    // Live path for interactive priorities — instant sync without waiting for pump
    const live = !input.delayMs && (event.priority === "critical" || event.priority === "high" || event.priority === "normal");
    if (live) {
      await this.bus.publish(event);
      if (queued) this.queue.markDelivered(queued.id);
    }

    this.emitSnapshot();
    return event;
  }

  async sendModuleMessage(
    from: WorkspaceModuleId,
    to: WorkspaceModuleId | WorkspaceModuleId[],
    action: string,
    data?: Record<string, unknown>,
  ): Promise<WorkspaceEvent> {
    const targets = Array.isArray(to) ? to : [to];
    return this.emit({
      type: "module.message",
      source: from,
      targets,
      priority: "normal",
      payload: { action, ...data },
    });
  }

  async reportError(sourceEvent: WorkspaceEvent, error: string): Promise<WorkspaceEvent> {
    const propagated = buildErrorPropagationEvent(sourceEvent, error);
    // Prevent cascading: mark workflow failure without auto-starting dependents
    this.workflow.observe(propagated);
    await this.bus.publish(propagated);
    if (propagated.notify && this.notify) {
      this.notify(propagated.notify.tone, propagated.notify.title, propagated.notify.detail, propagated.notify.category);
    }
    this.queue.enqueue(propagated);
    this.emitSnapshot();
    return propagated;
  }

  repair(): { queueRepaired: number } {
    const queueRepaired = this.queue.repairFailed();
    this.emitSnapshot();
    return { queueRepaired };
  }

  private async pump(): Promise<void> {
    const next = this.queue.dequeue();
    if (!next) return;
    try {
      await this.bus.publish(next.event);
      this.queue.markDelivered(next.id);
    } catch (error) {
      this.queue.markFailed(next.id, error instanceof Error ? error.message : "deliver failed");
      await this.bus.publish({
        id: `retry-${next.id}-${next.attempts}`,
        type: "queue.retried",
        source: "integration",
        at: new Date().toISOString(),
        correlationId: next.event.correlationId,
        priority: "low",
        payload: { queuedId: next.id, error: String(error), originalType: next.event.type },
      });
    }
    this.emitSnapshot();
  }

  private mirrorHistory(event: WorkspaceEvent): void {
    const key = `${event.type}:${event.id}`;
    if (this.historyCategories.has(key)) return;
    this.historyCategories.add(key);
    if (this.historyCategories.size > 200) {
      this.historyCategories = new Set([...this.historyCategories].slice(-100));
    }
    const category = event.type.startsWith("project") || event.type.includes("production")
      ? "production"
      : event.type.startsWith("ai") || event.source === "ai-me"
        ? "ai"
        : event.type.includes("error")
          ? "session"
          : "workspace";
    sessionStore.pushHistory(category, `${event.type} ← ${event.source}`, event.id);
  }

  private emitSnapshot(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}

function defaultPriority(type: WorkspaceEventType): MessagePriority {
  if (type.includes("error") || type === "workflow.failed") return "high";
  if (type.endsWith(".completed") || type.endsWith(".started")) return "normal";
  if (type.startsWith("notify") || type === "ai.recommendation") return "normal";
  if (type.startsWith("queue") || type.startsWith("bus")) return "low";
  return "normal";
}

function autoNotify(
  type: WorkspaceEventType,
  payload?: Record<string, unknown>,
): WorkspaceEvent["notify"] | undefined {
  if (type.endsWith(".completed")) {
    return {
      tone: "success",
      title: humanize(type),
      detail: String(payload?.summary ?? `${humanize(type)} finished successfully.`),
      category: "production-complete",
    };
  }
  if (type === "ai.recommendation") {
    return {
      tone: "info",
      title: "AI recommendation",
      detail: String(payload?.message ?? "AI Me has a workflow suggestion."),
      category: "ai-suggestions",
    };
  }
  if (type === "production.progress") {
    return {
      tone: "info",
      title: "Production progress",
      detail: `${payload?.percent ?? 0}% — ${payload?.status ?? "running"}`,
      category: "updates",
    };
  }
  if (type === "recovery.status") {
    return {
      tone: "warning",
      title: "Recovery status",
      detail: String(payload?.message ?? "Recovery update"),
      category: "warnings",
    };
  }
  return undefined;
}

function humanize(type: string): string {
  return type.replace(/\./g, " ").replace(/-/g, " ");
}

export const workspaceIntegrationEngine = new WorkspaceIntegrationEngine();
