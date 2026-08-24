import type { ProjectMemoryRecord } from "./types";

const STORAGE_KEY = "kwizera.project-memory.v1";

export const emptyProjectMemory = (): ProjectMemoryRecord => ({
  projectId: null,
  projectName: null,
  productInformation: {},
  uploadedImages: [],
  marketingSettings: {},
  storyboardProgress: 0,
  productionProgress: 0,
  renderingProgress: 0,
  exportSettings: {},
  aiDecisions: [],
  updatedAt: new Date().toISOString(),
});

export class ProjectMemoryStore {
  load(): ProjectMemoryRecord {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as ProjectMemoryRecord | null;
      if (!parsed || typeof parsed !== "object") return emptyProjectMemory();
      return { ...emptyProjectMemory(), ...parsed, aiDecisions: parsed.aiDecisions ?? [], uploadedImages: parsed.uploadedImages ?? [] };
    } catch {
      return emptyProjectMemory();
    }
  }

  save(record: ProjectMemoryRecord): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
  }

  syncFromRuntime(activeProject: string | null | undefined): ProjectMemoryRecord {
    const current = this.load();
    if (!activeProject) {
      if (!current.projectName) return current;
      return { ...current, updatedAt: new Date().toISOString() };
    }
    if (current.projectName === activeProject && current.projectId) {
      return current;
    }
    const next: ProjectMemoryRecord = {
      ...current,
      projectId: current.projectId ?? `local-${activeProject.toLowerCase().replace(/\s+/g, "-")}`,
      projectName: activeProject,
      updatedAt: new Date().toISOString(),
    };
    this.save(next);
    return next;
  }

  updateProgress(
    patch: Partial<Pick<ProjectMemoryRecord, "storyboardProgress" | "productionProgress" | "renderingProgress" | "marketingSettings" | "exportSettings" | "productInformation">>,
  ): ProjectMemoryRecord {
    const next = { ...this.load(), ...patch, updatedAt: new Date().toISOString() };
    this.save(next);
    return next;
  }

  recordAiDecision(summary: string): ProjectMemoryRecord {
    const current = this.load();
    const decision = { id: `ai-${Date.now().toString(36)}`, summary, at: new Date().toISOString() };
    const next = {
      ...current,
      aiDecisions: [decision, ...current.aiDecisions].slice(0, 40),
      updatedAt: new Date().toISOString(),
    };
    this.save(next);
    return next;
  }

  recordUploadedImage(name: string, sizeBytes?: number): ProjectMemoryRecord {
    const current = this.load();
    const image = { id: `img-${Date.now().toString(36)}`, name, sizeBytes };
    const next = {
      ...current,
      uploadedImages: [image, ...current.uploadedImages].slice(0, 80),
      updatedAt: new Date().toISOString(),
    };
    this.save(next);
    return next;
  }
}

export const projectMemoryStore = new ProjectMemoryStore();
