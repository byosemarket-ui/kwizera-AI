import type { SessionRegistry, WorkspaceHistoryEntry, WorkspaceHistoryLog, WorkspaceSession } from "./types";
import type { WorkspaceId } from "../types";

const SESSION_KEY = "kwizera.workspace-sessions.v1";
const HISTORY_KEY = "kwizera.workspace-history.v1";

function now(): string {
  return new Date().toISOString();
}

function createSessionId(): string {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export class SessionStore {
  loadRegistry(): SessionRegistry {
    try {
      const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as SessionRegistry | null;
      if (!parsed || parsed.version !== 1) {
        return { version: 1, currentSessionId: null, sessions: [], lastClosedProject: null };
      }
      return parsed;
    } catch {
      return { version: 1, currentSessionId: null, sessions: [], lastClosedProject: null };
    }
  }

  saveRegistry(registry: SessionRegistry): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(registry));
  }

  startSession(workspace: WorkspaceId, projectName: string | null, layoutId: string | null): WorkspaceSession {
    const registry = this.loadRegistry();
    const previous = registry.sessions.find((s) => s.id === registry.currentSessionId);
    if (previous && !previous.closedAt) {
      this.closeSession(false);
    }
    const session: WorkspaceSession = {
      id: createSessionId(),
      startedAt: now(),
      lastActiveAt: now(),
      closedAt: null,
      durationMs: 0,
      workspace,
      projectId: projectName ? `local-${projectName.toLowerCase().replace(/\s+/g, "-")}` : null,
      projectName,
      layoutId,
      cleanShutdown: false,
    };
    const sessions = [session, ...registry.sessions].slice(0, 30);
    this.saveRegistry({
      version: 1,
      currentSessionId: session.id,
      sessions,
      lastClosedProject: registry.lastClosedProject,
    });
    return session;
  }

  touch(sessionId: string): WorkspaceSession | null {
    const registry = this.loadRegistry();
    const sessions = registry.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const lastActiveAt = now();
      return {
        ...s,
        lastActiveAt,
        durationMs: Math.max(0, new Date(lastActiveAt).getTime() - new Date(s.startedAt).getTime()),
      };
    });
    this.saveRegistry({ ...registry, sessions });
    return sessions.find((s) => s.id === sessionId) ?? null;
  }

  closeSession(cleanShutdown: boolean): WorkspaceSession | null {
    const registry = this.loadRegistry();
    if (!registry.currentSessionId) return null;
    const closedAt = now();
    let closed: WorkspaceSession | null = null;
    const sessions = registry.sessions.map((s) => {
      if (s.id !== registry.currentSessionId) return s;
      closed = {
        ...s,
        closedAt,
        cleanShutdown,
        lastActiveAt: closedAt,
        durationMs: Math.max(0, new Date(closedAt).getTime() - new Date(s.startedAt).getTime()),
      };
      return closed;
    });
    this.saveRegistry({
      version: 1,
      currentSessionId: null,
      sessions,
      lastClosedProject: closed?.projectName ?? registry.lastClosedProject,
    });
    return closed;
  }

  getCurrent(): WorkspaceSession | null {
    const registry = this.loadRegistry();
    return registry.sessions.find((s) => s.id === registry.currentSessionId) ?? null;
  }

  getLatestValid(): WorkspaceSession | null {
    const registry = this.loadRegistry();
    return registry.sessions[0] ?? null;
  }

  loadHistory(): WorkspaceHistoryLog {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "null") as WorkspaceHistoryLog | null;
      if (!parsed || parsed.version !== 1) return { version: 1, entries: [] };
      return parsed;
    } catch {
      return { version: 1, entries: [] };
    }
  }

  pushHistory(category: WorkspaceHistoryEntry["category"], summary: string, snapshotId?: string): WorkspaceHistoryLog {
    const log = this.loadHistory();
    const entry: WorkspaceHistoryEntry = {
      id: `hist-${Date.now().toString(36)}`,
      category,
      summary,
      at: now(),
      snapshotId,
    };
    const next = { version: 1 as const, entries: [entry, ...log.entries].slice(0, 80) };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    return next;
  }
}

export const sessionStore = new SessionStore();
