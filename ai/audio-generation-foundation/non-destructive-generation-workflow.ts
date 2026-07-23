import fs from "node:fs";
import path from "node:path";
import {
  AudioGenerationWorkflowActionType,
  AudioGenerationWorkflowEditEntry,
  AudioGenerationWorkflowState,
} from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";

export class NonDestructiveGenerationWorkflow {
  private states = new Map<string, AudioGenerationWorkflowState>();
  private workflowPath = "";
  private catalogPath = "";

  constructor(private readonly logger: AudioGenerationFoundationLogger) {}

  initialize(storage: AudioGenerationStorageManager): void {
    this.workflowPath = storage.getWorkflowPath();
    this.catalogPath = path.join(this.workflowPath, "audio-generation-workflow-states.json");
    fs.mkdirSync(this.workflowPath, { recursive: true });
    fs.mkdirSync(path.join(this.workflowPath, "originals"), { recursive: true });
    fs.mkdirSync(path.join(this.workflowPath, "versions"), { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "workflow", "Non-destructive audio generation workflow initialized", {
      workflowStates: this.states.size,
    });
  }

  initializeProject(projectId: string, trackId?: string): AudioGenerationWorkflowState {
    const key = this.stateKey(projectId, trackId);
    const existing = this.states.get(key);
    if (existing) return existing;

    const state: AudioGenerationWorkflowState = {
      projectId,
      trackId,
      originalPreserved: true,
      currentVersion: 1,
      undoStack: [],
      redoStack: [],
      editHistory: [],
      lastUpdated: new Date().toISOString(),
    };
    this.states.set(key, state);
    this.persistOriginalMarker(projectId, trackId);
    this.persist();
    return state;
  }

  recordEdit(
    projectId: string,
    actionType: AudioGenerationWorkflowActionType,
    summary: string,
    beforeStateRef: string,
    afterStateRef: string,
    trackId?: string
  ): AudioGenerationWorkflowEditEntry {
    const key = this.stateKey(projectId, trackId);
    let state = this.states.get(key);
    if (!state) state = this.initializeProject(projectId, trackId);

    const edit: AudioGenerationWorkflowEditEntry = {
      editId: `aud-edit-${Date.now()}-${state.editHistory.length + 1}`,
      projectId,
      trackId,
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

  undo(projectId: string, trackId?: string): AudioGenerationWorkflowEditEntry | null {
    const state = this.states.get(this.stateKey(projectId, trackId));
    if (!state || state.undoStack.length === 0) return null;
    const editId = state.undoStack.pop()!;
    state.redoStack.push(editId);
    state.currentVersion = Math.max(1, state.currentVersion - 1);
    state.lastUpdated = new Date().toISOString();
    this.persist();
    return state.editHistory.find((e) => e.editId === editId) ?? null;
  }

  redo(projectId: string, trackId?: string): AudioGenerationWorkflowEditEntry | null {
    const state = this.states.get(this.stateKey(projectId, trackId));
    if (!state || state.redoStack.length === 0) return null;
    const editId = state.redoStack.pop()!;
    state.undoStack.push(editId);
    const edit = state.editHistory.find((e) => e.editId === editId);
    if (edit) state.currentVersion = edit.version;
    state.lastUpdated = new Date().toISOString();
    this.persist();
    return edit ?? null;
  }

  rollback(projectId: string, trackId?: string): boolean {
    const state = this.states.get(this.stateKey(projectId, trackId));
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
      issues.push("Audio generation workflow catalog missing");
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

  private stateKey(projectId: string, trackId?: string): string {
    return trackId ? `${projectId}:${trackId}` : projectId;
  }

  private persistOriginalMarker(projectId: string, trackId?: string): void {
    const markerPath = path.join(
      this.workflowPath,
      "originals",
      `${this.stateKey(projectId, trackId).replace(/:/g, "-")}.marker.json`
    );
    fs.writeFileSync(
      markerPath,
      JSON.stringify({ projectId, trackId, preservedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  }

  private loadFromDisk(): void {
    const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8")) as {
      states: AudioGenerationWorkflowState[];
    };
    this.states.clear();
    for (const state of data.states ?? []) {
      this.states.set(this.stateKey(state.projectId, state.trackId), state);
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
