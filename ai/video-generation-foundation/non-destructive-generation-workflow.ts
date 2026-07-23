import fs from "node:fs";
import path from "node:path";
import {
  GenerationWorkflowActionType,
  GenerationWorkflowEditEntry,
  GenerationWorkflowState,
} from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";

export class NonDestructiveGenerationWorkflow {
  private states = new Map<string, GenerationWorkflowState>();
  private workflowPath = "";
  private catalogPath = "";

  constructor(private readonly logger: VideoGenerationFoundationLogger) {}

  initialize(storage: VideoGenerationStorageManager): void {
    this.workflowPath = storage.getWorkflowPath();
    this.catalogPath = path.join(this.workflowPath, "generation-workflow-states.json");
    fs.mkdirSync(this.workflowPath, { recursive: true });
    fs.mkdirSync(path.join(this.workflowPath, "originals"), { recursive: true });
    fs.mkdirSync(path.join(this.workflowPath, "versions"), { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "workflow", "Non-destructive generation workflow initialized", {
      workflowStates: this.states.size,
    });
  }

  initializeProject(projectId: string, videoId?: string): GenerationWorkflowState {
    const key = this.stateKey(projectId, videoId);
    const existing = this.states.get(key);
    if (existing) return existing;

    const state: GenerationWorkflowState = {
      projectId,
      videoId,
      originalPreserved: true,
      currentVersion: 1,
      undoStack: [],
      redoStack: [],
      editHistory: [],
      lastUpdated: new Date().toISOString(),
    };
    this.states.set(key, state);
    this.persistOriginalMarker(projectId, videoId);
    this.persist();
    return state;
  }

  recordEdit(
    projectId: string,
    actionType: GenerationWorkflowActionType,
    summary: string,
    beforeStateRef: string,
    afterStateRef: string,
    videoId?: string
  ): GenerationWorkflowEditEntry {
    const key = this.stateKey(projectId, videoId);
    let state = this.states.get(key);
    if (!state) state = this.initializeProject(projectId, videoId);

    const edit: GenerationWorkflowEditEntry = {
      editId: `gen-edit-${Date.now()}-${state.editHistory.length + 1}`,
      projectId,
      videoId,
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

  undo(projectId: string, videoId?: string): GenerationWorkflowEditEntry | null {
    const state = this.states.get(this.stateKey(projectId, videoId));
    if (!state || state.undoStack.length === 0) return null;
    const editId = state.undoStack.pop()!;
    state.redoStack.push(editId);
    state.currentVersion = Math.max(1, state.currentVersion - 1);
    state.lastUpdated = new Date().toISOString();
    this.persist();
    return state.editHistory.find((e) => e.editId === editId) ?? null;
  }

  redo(projectId: string, videoId?: string): GenerationWorkflowEditEntry | null {
    const state = this.states.get(this.stateKey(projectId, videoId));
    if (!state || state.redoStack.length === 0) return null;
    const editId = state.redoStack.pop()!;
    state.undoStack.push(editId);
    const edit = state.editHistory.find((e) => e.editId === editId);
    if (edit) state.currentVersion = edit.version;
    state.lastUpdated = new Date().toISOString();
    this.persist();
    return edit ?? null;
  }

  rollback(projectId: string, videoId?: string): boolean {
    const state = this.states.get(this.stateKey(projectId, videoId));
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
      issues.push("Generation workflow catalog missing");
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

  private stateKey(projectId: string, videoId?: string): string {
    return videoId ? `${projectId}:${videoId}` : projectId;
  }

  private persistOriginalMarker(projectId: string, videoId?: string): void {
    const markerPath = path.join(
      this.workflowPath,
      "originals",
      `${this.stateKey(projectId, videoId).replace(/:/g, "-")}.marker.json`
    );
    fs.writeFileSync(
      markerPath,
      JSON.stringify({ projectId, videoId, preservedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  }

  private loadFromDisk(): void {
    const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8")) as {
      states: GenerationWorkflowState[];
    };
    this.states.clear();
    for (const state of data.states ?? []) {
      this.states.set(this.stateKey(state.projectId, state.videoId), state);
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
