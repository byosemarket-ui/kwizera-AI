/**
 * Global startup recovery — prevents permanent blank screens from uncaught
 * bootstrap errors, stale deployment chunks, or stuck loaders.
 */
const CHUNK_RELOAD_KEY = "kwizera.studio.chunk-reload.v1";
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

function isChunkLoadFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("loading chunk")
    || lower.includes("failed to fetch dynamically imported module")
    || lower.includes("importing a module script failed")
    || lower.includes("error loading dynamically imported module")
  );
}

function tryControlledChunkReload(reason: string): void {
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < CHUNK_RELOAD_COOLDOWN_MS) {
      console.error("[KWIZERA] Chunk reload already attempted recently:", reason);
      return;
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    console.warn("[KWIZERA] Stale bundle detected — reloading once:", reason);
    window.location.reload();
  } catch {
    window.location.reload();
  }
}

export function installBootstrapRecovery(): void {
  window.addEventListener("error", (event) => {
    const message = event.message || String(event.error ?? "");
    if (isChunkLoadFailure(message)) {
      tryControlledChunkReload(message);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "");
    if (isChunkLoadFailure(message)) {
      tryControlledChunkReload(message);
    } else {
      console.error("[KWIZERA] Unhandled promise rejection during startup/runtime:", reason);
    }
  });
}

export const STARTUP_READY_TIMEOUT_MS = 12_000;
