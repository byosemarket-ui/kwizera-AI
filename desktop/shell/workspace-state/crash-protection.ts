import type { WorkspaceStateEngine } from "./workspace-state-engine";

const FLAG_KEY = "kwizera.workspace-crash-flag.v1";

export class CrashProtection {
  constructor(private readonly engine: WorkspaceStateEngine) {}

  install(): () => void {
    const emergency = () => {
      try {
        localStorage.setItem(FLAG_KEY, JSON.stringify({ at: new Date().toISOString(), unclean: true }));
        this.engine.persist("emergency");
        this.engine.markCleanShutdown(false);
      } catch {
        /* best effort */
      }
    };

    const clean = () => {
      try {
        this.engine.persist("background");
        this.engine.markCleanShutdown(true);
        localStorage.setItem(FLAG_KEY, JSON.stringify({ at: new Date().toISOString(), unclean: false }));
      } catch {
        /* best effort */
      }
    };

    window.addEventListener("pagehide", emergency);
    window.addEventListener("beforeunload", emergency);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") emergency();
    });

    return () => {
      clean();
      window.removeEventListener("pagehide", emergency);
      window.removeEventListener("beforeunload", emergency);
    };
  }

  wasUncleanShutdown(): boolean {
    try {
      const raw = JSON.parse(localStorage.getItem(FLAG_KEY) ?? "null") as { unclean?: boolean } | null;
      return Boolean(raw?.unclean);
    } catch {
      return false;
    }
  }

  clearFlag(): void {
    localStorage.setItem(FLAG_KEY, JSON.stringify({ at: new Date().toISOString(), unclean: false }));
  }
}
