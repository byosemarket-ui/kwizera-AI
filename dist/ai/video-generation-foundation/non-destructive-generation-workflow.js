import fs from "node:fs";
import path from "node:path";
export class NonDestructiveGenerationWorkflow {
    logger;
    states = new Map();
    workflowPath = "";
    catalogPath = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage) {
        this.workflowPath = storage.getWorkflowPath();
        this.catalogPath = path.join(this.workflowPath, "generation-workflow-states.json");
        fs.mkdirSync(this.workflowPath, { recursive: true });
        fs.mkdirSync(path.join(this.workflowPath, "originals"), { recursive: true });
        fs.mkdirSync(path.join(this.workflowPath, "versions"), { recursive: true });
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "workflow", "Non-destructive generation workflow initialized", {
            workflowStates: this.states.size,
        });
    }
    initializeProject(projectId, videoId) {
        const key = this.stateKey(projectId, videoId);
        const existing = this.states.get(key);
        if (existing)
            return existing;
        const state = {
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
    recordEdit(projectId, actionType, summary, beforeStateRef, afterStateRef, videoId) {
        const key = this.stateKey(projectId, videoId);
        let state = this.states.get(key);
        if (!state)
            state = this.initializeProject(projectId, videoId);
        const edit = {
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
    undo(projectId, videoId) {
        const state = this.states.get(this.stateKey(projectId, videoId));
        if (!state || state.undoStack.length === 0)
            return null;
        const editId = state.undoStack.pop();
        state.redoStack.push(editId);
        state.currentVersion = Math.max(1, state.currentVersion - 1);
        state.lastUpdated = new Date().toISOString();
        this.persist();
        return state.editHistory.find((e) => e.editId === editId) ?? null;
    }
    redo(projectId, videoId) {
        const state = this.states.get(this.stateKey(projectId, videoId));
        if (!state || state.redoStack.length === 0)
            return null;
        const editId = state.redoStack.pop();
        state.undoStack.push(editId);
        const edit = state.editHistory.find((e) => e.editId === editId);
        if (edit)
            state.currentVersion = edit.version;
        state.lastUpdated = new Date().toISOString();
        this.persist();
        return edit ?? null;
    }
    rollback(projectId, videoId) {
        const state = this.states.get(this.stateKey(projectId, videoId));
        if (!state)
            return false;
        state.currentVersion = 1;
        state.undoStack = [];
        state.redoStack = [];
        state.lastUpdated = new Date().toISOString();
        this.persist();
        return true;
    }
    verifyIntegrity() {
        const issues = [];
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
    repairSafeIssues() {
        for (const [key, state] of this.states.entries()) {
            if (!state.originalPreserved) {
                state.originalPreserved = true;
                state.lastUpdated = new Date().toISOString();
                this.states.set(key, state);
            }
        }
        this.persist();
    }
    stateKey(projectId, videoId) {
        return videoId ? `${projectId}:${videoId}` : projectId;
    }
    persistOriginalMarker(projectId, videoId) {
        const markerPath = path.join(this.workflowPath, "originals", `${this.stateKey(projectId, videoId).replace(/:/g, "-")}.marker.json`);
        fs.writeFileSync(markerPath, JSON.stringify({ projectId, videoId, preservedAt: new Date().toISOString() }, null, 2), "utf8");
    }
    loadFromDisk() {
        const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8"));
        this.states.clear();
        for (const state of data.states ?? []) {
            this.states.set(this.stateKey(state.projectId, state.videoId), state);
        }
    }
    persist() {
        fs.writeFileSync(this.catalogPath, JSON.stringify({ states: [...this.states.values()] }, null, 2), "utf8");
    }
}
//# sourceMappingURL=non-destructive-generation-workflow.js.map