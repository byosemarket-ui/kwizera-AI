import type { SharedWorkspaceState, WorkspaceEvent } from "./types";

const STORAGE_KEY = "kwizera.workspace-shared-state.v1";

export function emptySharedState(): SharedWorkspaceState {
  return {
    productInformation: {},
    uploadedImages: [],
    analysisResults: null,
    marketingStrategy: null,
    storyboard: null,
    productionStatus: "idle",
    renderStatus: "idle",
    exportStatus: "idle",
    progress: 0,
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
}

export class StateSyncStore {
  private state: SharedWorkspaceState = emptySharedState();

  constructor() {
    this.hydrate();
  }

  get(): SharedWorkspaceState {
    return { ...this.state, uploadedImages: [...this.state.uploadedImages] };
  }

  applyEvent(event: WorkspaceEvent): SharedWorkspaceState {
    const next = { ...this.state };
    const data = event.payload;

    switch (event.type) {
      case "project.created":
      case "project.loaded":
        next.productInformation = { ...next.productInformation, ...(data.product as object ?? {}), name: data.name ?? next.productInformation.name };
        next.productionStatus = "loaded";
        break;
      case "images.imported": {
        const images = (data.images as Array<{ id: string; name: string }> | undefined) ?? [];
        next.uploadedImages = [...images, ...next.uploadedImages].slice(0, 80);
        break;
      }
      case "product.updated":
        next.productInformation = { ...next.productInformation, ...(data.product as object ?? {}) };
        break;
      case "product-analysis.completed":
        next.analysisResults = (data.results as Record<string, unknown>) ?? { summary: data.summary };
        next.productionStatus = "analyzed";
        break;
      case "marketing.completed":
        next.marketingStrategy = (data.strategy as Record<string, unknown>) ?? { status: "completed" };
        break;
      case "storyboard.completed":
        next.storyboard = (data.storyboard as Record<string, unknown>) ?? { status: "completed" };
        break;
      case "rendering.started":
        next.renderStatus = "running";
        break;
      case "rendering.completed":
        next.renderStatus = "completed";
        break;
      case "export.started":
        next.exportStatus = "running";
        break;
      case "export.completed":
        next.exportStatus = "completed";
        next.productionStatus = "exported";
        break;
      case "production.progress":
        next.progress = Number(data.percent ?? next.progress) || 0;
        next.productionStatus = String(data.status ?? next.productionStatus);
        break;
      case "state.conflict":
        // Keep higher revision
        if (Number(data.revision ?? 0) <= next.revision) return this.state;
        Object.assign(next, data.patch ?? {});
        break;
      default:
        break;
    }

    next.revision += 1;
    next.updatedAt = new Date().toISOString();
    this.state = next;
    this.persist();
    return this.get();
  }

  /** Safe merge — rejects stale revisions to prevent inconsistent data. */
  share(patch: Partial<SharedWorkspaceState>, expectedRevision?: number): { ok: boolean; state: SharedWorkspaceState } {
    if (expectedRevision != null && expectedRevision < this.state.revision) {
      return { ok: false, state: this.get() };
    }
    this.state = {
      ...this.state,
      ...patch,
      uploadedImages: patch.uploadedImages ?? this.state.uploadedImages,
      revision: this.state.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return { ok: true, state: this.get() };
  }

  private hydrate(): void {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SharedWorkspaceState | null;
      if (raw && typeof raw.revision === "number") this.state = { ...emptySharedState(), ...raw };
    } catch {
      this.state = emptySharedState();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
  }
}
