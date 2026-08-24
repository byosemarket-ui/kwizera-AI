import type { AutoSaveStatus, SaveMode, WorkspaceStateSnapshot } from "./types";
import type { WorkspaceStateEngine } from "./workspace-state-engine";

export class AutoSaveEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(status: AutoSaveStatus) => void>();
  private status: AutoSaveStatus = {
    enabled: true,
    mode: "auto",
    lastSavedAt: null,
    lastError: null,
    dirty: false,
    inProgress: false,
  };

  constructor(
    private readonly engine: WorkspaceStateEngine,
    private readonly debounceMs = 1200,
  ) {}

  getStatus(): AutoSaveStatus {
    return { ...this.status };
  }

  subscribe(listener: (status: AutoSaveStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.getStatus();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  setEnabled(enabled: boolean): void {
    this.status.enabled = enabled;
    this.emit();
  }

  markDirty(): void {
    this.status.dirty = true;
    this.emit();
    if (!this.status.enabled) return;
    this.schedule("auto");
  }

  schedule(mode: SaveMode = "auto"): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush(mode);
    }, mode === "manual" || mode === "emergency" ? 0 : this.debounceMs);
  }

  async flush(mode: SaveMode = "manual"): Promise<WorkspaceStateSnapshot | null> {
    if (this.status.inProgress && mode !== "emergency") return null;
    this.status.inProgress = true;
    this.status.mode = mode;
    this.emit();
    try {
      const snapshot = this.engine.persist(mode);
      this.status.dirty = false;
      this.status.lastSavedAt = snapshot.savedAt;
      this.status.lastError = null;
      return snapshot;
    } catch (error) {
      this.status.lastError = error instanceof Error ? error.message : "Save failed";
      return null;
    } finally {
      this.status.inProgress = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.emit();
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }
}
