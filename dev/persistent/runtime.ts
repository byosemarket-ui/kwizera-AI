import type { AiCore } from "../../ai/core/ai-core.js";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { buildRegistry } from "../server/module-registry.js";
import { DevSessionStore, type DevRuntimeSnapshot } from "./session-store.js";
import { bootstrapPersistentStorage } from "./storage-bootstrap.js";

export interface PersistentRuntimeStatus {
  ready: boolean;
  booting: boolean;
  storageRoot: string;
  sessionId: string;
  restored: boolean;
  message: string;
  runtime: DevRuntimeSnapshot;
  modules: {
    total: number;
    connected: number;
    phases: number;
  };
  bootstrap: {
    created: number;
    existing: number;
  };
}

let core: AiCore | null = null;
let sessionStore: DevSessionStore | null = null;
let status: PersistentRuntimeStatus | null = null;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
let bootPromise: Promise<PersistentRuntimeStatus> | null = null;

function buildDashboardUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}

function countConnectedModules(): { total: number; connected: number; phases: number } {
  const phases = buildRegistry();
  const modules = phases.flatMap((p) => p.modules).filter((m) => m.kind !== "blueprint");
  const connected = modules.filter((m) => m.status === "pass" && m.aiPath).length;
  return { total: modules.length, connected, phases: phases.length };
}

async function collectRuntimeSnapshot(manager: ReturnType<AiCore["getManager"]>): Promise<DevRuntimeSnapshot> {
  const report = manager.getStatusReport();
  const memory = manager.memoryFoundation;
  const knowledge = manager.knowledgeFoundation;
  const stateManager = manager.stateManager;

  const memoryReport = memory?.buildStatusReport();
  const knowledgeReport = knowledge?.buildStatusReport();
  const restoration = stateManager?.getLastRestoration();
  const projectCount = Object.keys(stateManager?.getCurrentSnapshot().projects ?? {}).length;
  const moduleCounts = countConnectedModules();

  return {
    readinessScore: report.readinessScore,
    memoryLoaded: memoryReport?.persistenceStatus === "survives restart" || memoryReport?.foundationStatus === "operational",
    knowledgeLoaded: knowledgeReport?.persistenceStatus === "survives restart" || knowledgeReport?.foundationStatus === "operational",
    projectStateRestored: restoration?.restored === true || projectCount > 0,
    modulesConnected: moduleCounts.connected,
    lifecycleState: String(manager.getLifecycleState()),
    memoryReadiness: memoryReport?.readinessScore ?? null,
    knowledgeReadiness: knowledgeReport?.readinessScore ?? null,
    projectCount,
  };
}

export function getPersistentRuntime(): AiCore | null {
  return core;
}

export function getSessionStore(): DevSessionStore | null {
  return sessionStore;
}

export function getRuntimeStatus(): PersistentRuntimeStatus | null {
  return status;
}

export function isPersistentMode(): boolean {
  return process.env.KWIZERA_PERSISTENT_MODE !== "0";
}

export async function bootPersistentRuntime(host: string, port: number): Promise<PersistentRuntimeStatus> {
  if (bootPromise) return bootPromise;
  if (status?.ready) return status;

  bootPromise = (async () => {
    const storageRoot = resolveStorageRoot();
    const dashboardUrl = buildDashboardUrl(host, port);
    const bootstrap = bootstrapPersistentStorage(storageRoot);
    sessionStore = new DevSessionStore(storageRoot, dashboardUrl);

    status = {
      ready: false,
      booting: true,
      storageRoot,
      sessionId: sessionStore.get().sessionId,
      restored: false,
      message: "Booting persistent AI runtime…",
      runtime: sessionStore.get().lastRuntime,
      modules: countConnectedModules(),
      bootstrap: { created: bootstrap.created.length, existing: bootstrap.existing.length },
    };

    if (!isPersistentMode()) {
      status.message = "Persistent mode disabled — dashboard only";
      status.booting = false;
      status.ready = true;
      return status;
    }

    try {
      console.log("[KWIZERA] Restoring persistent session from", storageRoot);
      const { createAiCore } = await import("../../ai/core/index.js");
      core = createAiCore({ storageRootOverride: storageRoot });
      const manager = core.getManager();

      await core.start("persistent-dev-restore");
      const snapshot = await collectRuntimeSnapshot(manager);
      sessionStore.updateRuntime(snapshot);

      const previousSession = sessionStore.get();
      const restored = previousSession.startCount > 1 || snapshot.projectStateRestored ||
        snapshot.memoryLoaded || snapshot.knowledgeLoaded;

      status = {
        ready: true,
        booting: false,
        storageRoot,
        sessionId: sessionStore.get().sessionId,
        restored,
        message: restored
          ? "Previous session restored — all engines reconnected"
          : "Fresh persistent session initialized",
        runtime: snapshot,
        modules: countConnectedModules(),
        bootstrap: { created: bootstrap.created.length, existing: bootstrap.existing.length },
      };

      console.log(`[KWIZERA] ${status.message}`);
      console.log(`[KWIZERA] Memory: ${snapshot.memoryLoaded ? "loaded" : "pending"}, Knowledge: ${snapshot.knowledgeLoaded ? "loaded" : "pending"}, Projects: ${snapshot.projectCount}`);

      autoSaveTimer = setInterval(() => {
        void saveRuntimeSnapshot();
      }, 60_000);

      return status;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      status = {
        ready: false,
        booting: false,
        storageRoot,
        sessionId: sessionStore.get().sessionId,
        restored: false,
        message: `Runtime boot failed: ${message}`,
        runtime: sessionStore.get().lastRuntime,
        modules: countConnectedModules(),
        bootstrap: { created: bootstrap.created.length, existing: bootstrap.existing.length },
      };
      console.error("[KWIZERA] Persistent runtime boot failed:", message);
      return status;
    } finally {
      bootPromise = null;
    }
  })();

  return bootPromise;
}

export async function saveRuntimeSnapshot(): Promise<void> {
  if (!core || !sessionStore) return;
  try {
    const snapshot = await collectRuntimeSnapshot(core.getManager());
    sessionStore.updateRuntime(snapshot);
    if (status) {
      status.runtime = snapshot;
      status.modules = countConnectedModules();
    }
  } catch {
    /* ignore autosave errors */
  }
}

export async function shutdownPersistentRuntime(): Promise<void> {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }

  await saveRuntimeSnapshot();
  sessionStore?.markShutdown();

  if (core) {
    try {
      await core.stop("persistent-dev-shutdown");
    } catch {
      /* ignore */
    }
    core = null;
  }

  if (status) {
    status.ready = false;
    status.message = "Shutdown complete — session saved";
  }
}

export function registerShutdownHandlers(): void {
  const handler = () => {
    void shutdownPersistentRuntime().finally(() => process.exit(0));
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  process.on("beforeExit", () => {
    void saveRuntimeSnapshot();
  });
}
