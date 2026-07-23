import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const SESSION_VERSION = 1;

export interface DevUiState {
  filter: string;
  openPhases: string[];
}

export interface DevRuntimeSnapshot {
  readinessScore: number;
  memoryLoaded: boolean;
  knowledgeLoaded: boolean;
  projectStateRestored: boolean;
  modulesConnected: number;
  lifecycleState: string;
  memoryReadiness: number | null;
  knowledgeReadiness: number | null;
  projectCount: number;
}

export interface DevSessionState {
  version: number;
  sessionId: string;
  createdAt: string;
  lastStartedAt: string;
  lastShutdownAt: string | null;
  startCount: number;
  dashboardUrl: string;
  storageRoot: string;
  persistentMode: boolean;
  autoStartEnabled: boolean;
  ui: DevUiState;
  lastRuntime: DevRuntimeSnapshot;
}

export function createDefaultSession(storageRoot: string, dashboardUrl: string): DevSessionState {
  const now = new Date().toISOString();
  return {
    version: SESSION_VERSION,
    sessionId: randomUUID(),
    createdAt: now,
    lastStartedAt: now,
    lastShutdownAt: null,
    startCount: 1,
    dashboardUrl,
    storageRoot,
    persistentMode: true,
    autoStartEnabled: false,
    ui: { filter: "", openPhases: ["blueprint", "ai-brain", "memory", "knowledge"] },
    lastRuntime: {
      readinessScore: 0,
      memoryLoaded: false,
      knowledgeLoaded: false,
      projectStateRestored: false,
      modulesConnected: 0,
      lifecycleState: "stopped",
      memoryReadiness: null,
      knowledgeReadiness: null,
      projectCount: 0,
    },
  };
}

export class DevSessionStore {
  private readonly sessionPath: string;
  private session: DevSessionState;

  constructor(storageRoot: string, dashboardUrl: string) {
    this.sessionPath = path.join(storageRoot, "config", "dev", "session.json");
    this.session = this.loadOrCreate(storageRoot, dashboardUrl);
  }

  private loadOrCreate(storageRoot: string, dashboardUrl: string): DevSessionState {
    if (fs.existsSync(this.sessionPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.sessionPath, "utf8")) as DevSessionState;
        raw.lastStartedAt = new Date().toISOString();
        raw.startCount = (raw.startCount ?? 0) + 1;
        raw.dashboardUrl = dashboardUrl;
        raw.storageRoot = storageRoot;
        raw.persistentMode = true;
        raw.ui ??= { filter: "", openPhases: ["blueprint", "ai-brain", "memory", "knowledge"] };
        raw.lastRuntime ??= createDefaultSession(storageRoot, dashboardUrl).lastRuntime;
        return raw;
      } catch {
        /* fall through to new session */
      }
    }
    return createDefaultSession(storageRoot, dashboardUrl);
  }

  get(): DevSessionState {
    return this.session;
  }

  updateRuntime(snapshot: Partial<DevRuntimeSnapshot>): void {
    this.session.lastRuntime = { ...this.session.lastRuntime, ...snapshot };
    this.persist();
  }

  updateUi(ui: Partial<DevUiState>): void {
    this.session.ui = { ...this.session.ui, ...ui };
    this.persist();
  }

  markAutoStart(enabled: boolean): void {
    this.session.autoStartEnabled = enabled;
    this.persist();
  }

  markShutdown(): void {
    this.session.lastShutdownAt = new Date().toISOString();
    this.persist();
  }

  persist(): void {
    fs.mkdirSync(path.dirname(this.sessionPath), { recursive: true });
    fs.writeFileSync(this.sessionPath, JSON.stringify(this.session, null, 2), "utf8");
  }
}
