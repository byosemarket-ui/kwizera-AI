import type { EventHandler, WorkspaceEvent, WorkspaceEventType } from "./types";

export class WorkspaceEventBus {
  private handlers = new Map<WorkspaceEventType | "*", Set<EventHandler>>();
  private recent: WorkspaceEvent[] = [];
  private delivered = 0;
  private online = true;

  subscribe(type: WorkspaceEventType | "*", handler: EventHandler): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler);
    };
  }

  once(type: WorkspaceEventType, handler: EventHandler): () => void {
    const unsub = this.subscribe(type, async (event) => {
      unsub();
      await handler(event);
    });
    return unsub;
  }

  async publish(event: WorkspaceEvent): Promise<void> {
    if (!this.online && event.priority !== "critical") return;
    this.recent = [event, ...this.recent].slice(0, 80);
    this.delivered += 1;
    const specific = this.handlers.get(event.type);
    const wildcard = this.handlers.get("*");
    const targets = [...(specific ?? []), ...(wildcard ?? [])];
    for (const handler of targets) {
      try {
        await handler(event);
      } catch {
        /* isolate handler failures — prevent cascading */
      }
    }
  }

  getRecent(limit = 20): WorkspaceEvent[] {
    return this.recent.slice(0, limit);
  }

  getDeliveredCount(): number {
    return this.delivered;
  }

  setOnline(online: boolean): void {
    this.online = online;
  }

  isOnline(): boolean {
    return this.online;
  }
}
