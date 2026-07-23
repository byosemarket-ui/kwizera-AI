import fs from "node:fs";
import path from "node:path";
import {
  ImageGenerationWorkflowActionType,
  ImageGenerationWorkflowEditEntry,
  ImageGenerationWorkflowState,
} from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";

export class NonDestructiveGenerationWorkflow {
  private states = new Map<string, ImageGenerationWorkflowState>();
  private workflowPath = "";
  private catalogPath = "";

  constructor(private readonly logger: ImageGenerationFoundationLogger) {}

  initialize(storage: ImageGenerationStorageManager): void {
    this.workflowPath = storage.getWorkflowPath();
    this.catalogPath = path.join(this.workflowPath, "image-generation-workflow-states.json");
    fs.mkdirSync(this.workflowPath, { recursive: true });
    fs.mkdirSync(path.join(this.workflowPath, "originals"), { recursive: true });
    fs.mkdirSync(path.join(this.workflowPath, "versions"), { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "workflow", "Non-destructive image generation workflow initialized", {
      workflowStates: this.states.size,
    });
  }

  initializeProject(projectId: string, imageId?: string): ImageGenerationWorkflowState {
    const key = this.stateKey(projectId, imageId);
    const existing = this.states.get(key);
    if (existing) return existing;

    const state: ImageGenerationWorkflowState = {
      projectId,
      imageId,
      originalPreserved: true,
      currentVersion: 1,
      undoStack: [],
      redoStack: [],
      editHistory: [],
      lastUpdated: new Date().toISOString(),
    };
    this.states.set(key, state);
    this.persistOriginalMarker(projectId, imageId);
    this.persist();
    return state;
  }

  recordEdit(
    projectId: string,
    actionType: ImageGenerationWorkflowActionType,
    summary: string,
    beforeStateRef: string,
    afterStateRef: string,
    imageId?: string
  ): ImageGenerationWorkflowEditEntry {
    const key = this.stateKey(projectId, imageId);
    let state = this.states.get(key);
    if (!state) state = this.initializeProject(projectId, imageId);

    const edit: ImageGenerationWorkflowEditEntry = {
      editId: `img-edit-${Date.now()}-${state.editHistory.length + 1}`,
      projectId,
      imageId,
      actionType,
      summary,
      beforeStateRef,
      afterStateRef,
      reversible: true,
      timestamp: new Date().toISOString(),
      version: state.currentVersion + 1,
    };

    state.editHistory.push(edit);
    state.undoStack.push(edit.editId);
    state.redoStack = [];
    state.currentVersion = edit.version;
    state.lastUpdated = edit.timestamp;
    this.states.set(key, state);
    this.persist();
    return edit;
  }

  undo(projectId: string, imageId?: string): ImageGenerationWorkflowEditEntry | null {
    const state = this.states.get(this.stateKey(projectId, imageId));
    if (!state || state.undoStack.length === 0) return null;
    const editId = state.undoStack.pop()!;
    state.redoStack.push(editId);
    state.currentVersion = Math.max(1, state.currentVersion - 1);
    state.lastUpdated = new Date().toISOString();
    this.persist();
    return state.editHistory.find((e) => e.editId === editId) ?? null;
  }

  redo(projectId: string, imageId?: string): ImageGenerationWorkflowEditEntry | null {
    const state = this.states.get(this.stateKey(projectId, imageId));
    if (!state || state.redoStack.length === 0) return null;
    const editId = state.redoStack.pop()!;
    state.undoStack.push(editId);
    const edit = state.editHistory.find((e) => e.editId === editId);
    if (edit) state.currentVersion = edit.version;
    state.lastUpdated = new Date().toISOString();
    this.persist();
    return edit ?? null;
  }

  rollback(projectId: string, imageId?: string): boolean {
    const state = this.states.get(this.stateKey(projectId, imageId));
    if (!state) return false;
    state.currentVersion = 1;
    state.undoStack = [];
    state.redoStack = [];
    state.lastUpdated = new Date().toISOString();
    this.persist();
    return true;
  }

  verifyIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!fs.existsSync(this.catalogPath)) {
      issues.push("Image generation workflow catalog missing");
    }
    for (const state of this.states.values()) {
      if (!state.originalPreserved) {
        issues.push(`Original not preserved for ${state.projectId}`);
      }
    }
    return { valid: issues.length === 0, issues };
  }

  repairSafeIssues(): void {
    for (const [key, state] of this.states.entries()) {
      if (!state.originalPreserved) {
        state.originalPreserved = true;
        state.lastUpdated = new Date().toISOString();
        this.states.set(key, state);
      }
    }
    this.persist();
  }

  private stateKey(projectId: string, imageId?: string): string {
    return imageId ? `${projectId}:${imageId}` : projectId;
  }

  private persistOriginalMarker(projectId: string, imageId?: string): void {
    const markerPath = path.join(
      this.workflowPath,
      "originals",
      `${this.stateKey(projectId, imageId).replace(/:/g, "-")}.marker.json`
    );
    fs.writeFileSync(
      markerPath,
      JSON.stringify({ projectId, imageId, preservedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  }

  private loadFromDisk(): void {
    const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8")) as {
      states: ImageGenerationWorkflowState[];
    };
    this.states.clear();
    for (const state of data.states ?? []) {
      this.states.set(this.stateKey(state.projectId, state.imageId), state);
    }
  }

  private persist(): void {
    fs.writeFileSync(
      this.catalogPath,
      JSON.stringify({ states: [...this.states.values()] }, null, 2),
      "utf8"
    );
  }
}
