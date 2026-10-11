/**
 * JSON persistence for forex monitor sessions and events.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../storage/safe-json.js";
import { resolveForexMonitorLimits } from "./limits.js";
import {
  FOREX_MONITOR_SCHEMA_VERSION,
  type ForexMonitorEvent,
  type ForexMonitorSession,
  type ForexMonitorStoreFile,
} from "./types.js";

const EMPTY_STORE: ForexMonitorStoreFile = {
  version: 1,
  schemaVersion: FOREX_MONITOR_SCHEMA_VERSION,
  sessions: [],
};

type EventsBySession = Record<string, ForexMonitorEvent[]>;

function stripRuntime(session: ForexMonitorSession): ForexMonitorSession {
  const { workerActive: _w, nextEvalAfterMs: _n, ...rest } = session;
  return rest as ForexMonitorSession;
}

export class ForexMonitorStore {
  private readonly rootDir: string;
  private readonly storePath: string;
  private readonly eventsPath: string;
  private ready = false;
  private writeChain: Promise<void> = Promise.resolve();
  private events: EventsBySession = {};
  private readonly limits = resolveForexMonitorLimits();

  constructor(storageRoot?: string) {
    const root = storageRoot ?? resolveStorageRoot();
    this.rootDir = path.join(root, "forex-monitor");
    this.storePath = path.join(this.rootDir, "store.json");
    this.eventsPath = path.join(this.rootDir, "events.json");
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    fs.mkdirSync(this.rootDir, { recursive: true });
    if (!fs.existsSync(this.storePath)) {
      await writeJsonAtomic(this.storePath, EMPTY_STORE);
    }
    if (!fs.existsSync(this.eventsPath)) {
      await writeJsonAtomic(this.eventsPath, {} as EventsBySession);
    }
    const ev = readJsonSafeSync<EventsBySession>(this.eventsPath, {});
    this.events = ev.value && typeof ev.value === "object" ? ev.value : {};
    this.ready = true;
  }

  private readStoreFile(): ForexMonitorStoreFile {
    const result = readJsonSafeSync<ForexMonitorStoreFile>(this.storePath, EMPTY_STORE);
    const value = result.value ?? EMPTY_STORE;
    return {
      version: 1,
      schemaVersion: FOREX_MONITOR_SCHEMA_VERSION,
      sessions: Array.isArray(value.sessions) ? value.sessions : [],
    };
  }

  private async persistStore(sessions: ForexMonitorSession[]): Promise<void> {
    await this.ensureReady();
    fs.mkdirSync(this.rootDir, { recursive: true });
    await writeJsonAtomic(this.storePath, {
      version: 1,
      schemaVersion: FOREX_MONITOR_SCHEMA_VERSION,
      sessions: sessions.map(stripRuntime),
    } satisfies ForexMonitorStoreFile);
  }

  private async persistEvents(): Promise<void> {
    await this.ensureReady();
    fs.mkdirSync(this.rootDir, { recursive: true });
    await writeJsonAtomic(this.eventsPath, this.events);
  }

  async load(): Promise<{ sessions: ForexMonitorSession[]; events: EventsBySession }> {
    await this.ensureReady();
    const store = this.readStoreFile();
    return { sessions: store.sessions, events: { ...this.events } };
  }

  async saveSession(session: ForexMonitorSession): Promise<ForexMonitorSession> {
    await this.ensureReady();
    const store = this.readStoreFile();
    const idx = store.sessions.findIndex((s) => s.sessionId === session.sessionId);
    const saved = stripRuntime(session);
    if (idx >= 0) store.sessions[idx] = saved;
    else store.sessions.push(saved);
    await this.persistStore(store.sessions);
    return saved;
  }

  async appendEvent(event: Omit<ForexMonitorEvent, "eventId"> & { eventId?: string }): Promise<ForexMonitorEvent> {
    await this.ensureReady();
    const full: ForexMonitorEvent = {
      ...event,
      eventId: event.eventId ?? randomUUID(),
    };
    const list = this.events[full.sessionId] ?? [];
    list.push(full);
    const max = this.limits.MAX_EVENTS_PER_SESSION;
    this.events[full.sessionId] = list.length > max ? list.slice(-max) : list;
    await this.persistEvents();
    return full;
  }

  async listSessions(): Promise<ForexMonitorSession[]> {
    await this.ensureReady();
    return this.readStoreFile().sessions;
  }

  async getSession(sessionId: string): Promise<ForexMonitorSession | null> {
    const sessions = await this.listSessions();
    return sessions.find((s) => s.sessionId === sessionId) ?? null;
  }

  async getEvents(sessionId: string): Promise<ForexMonitorEvent[]> {
    await this.ensureReady();
    return [...(this.events[sessionId] ?? [])];
  }

  /** Drop oldest STOPPED sessions beyond retention cap. */
  async pruneStoppedSessions(): Promise<number> {
    await this.ensureReady();
    const store = this.readStoreFile();
    const stopped = store.sessions.filter((s) => s.lifecycleState === "STOPPED");
    const active = store.sessions.filter((s) => s.lifecycleState !== "STOPPED");
    const max = this.limits.MAX_STOPPED_SESSIONS;
    if (stopped.length <= max) return 0;
    stopped.sort((a, b) => (a.stoppedAt ?? a.updatedAt).localeCompare(b.stoppedAt ?? b.updatedAt));
    const keep = stopped.slice(-max);
    const dropIds = new Set(
      stopped.slice(0, stopped.length - max).map((s) => s.sessionId),
    );
    for (const id of dropIds) {
      delete this.events[id];
    }
    await this.persistStore([...active, ...keep]);
    await this.persistEvents();
    return dropIds.size;
  }
}
