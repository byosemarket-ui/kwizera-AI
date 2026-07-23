import fs from "node:fs";
import path from "node:path";
export class NonDestructiveWorkflow {
    logger;
    states = new Map();
    workflowPath = "";
    catalogPath = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage) {
        this.workflowPath = storage.getWorkflowPath();
        this.catalogPath = path.join(this.workflowPath, "workflow-states.json");
        fs.mkdirSync(this.workflowPath, { recursive: true });
        fs.mkdirSync(path.join(this.workflowPath, "originals"), { recursive: true });
        fs.mkdirSync(path.join(this.workflowPath, "versions"), { recursive: true });
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "workflow", "Non-destructive workflow initialized", {
            workflowStates: this.states.size,
        });
    }
    initializeVideo(projectId, videoId) {
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
    recordEdit(projectId, videoId, actionType, summary, beforeStateRef, afterStateRef, timelineId) {
        const key = this.stateKey(projectId, videoId);
        let state = this.states.get(key);
        if (!state) {
            state = this.initializeVideo(projectId, videoId);
        }
        const edit = {
            editId: `edit-${Date.now()}-${state.editHistory.length + 1}`,
            projectId,
            videoId,
            timelineId,
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
        this.logger.log("info", "workflow", `Edit recorded: ${edit.editId}`, { actionType, summary });
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
    restoreOriginal(projectId, videoId) {
        const key = this.stateKey(projectId, videoId);
        const state = this.states.get(key) ?? this.initializeVideo(projectId, videoId);
        state.currentVersion = 1;
        state.undoStack = [];
        state.redoStack = [];
        state.originalPreserved = true;
        state.lastUpdated = new Date().toISOString();
        this.states.set(key, state);
        this.persist();
        this.logger.log("info", "workflow", "Original video state restored", { projectId, videoId });
        return state;
    }
    getState(projectId, videoId) {
        return this.states.get(this.stateKey(projectId, videoId));
    }
    getEditHistory(projectId, videoId) {
        return this.states.get(this.stateKey(projectId, videoId))?.editHistory ?? [];
    }
    verifyIntegrity() {
        const issues = [];
        if (!fs.existsSync(this.workflowPath)) {
            issues.push("Workflow directory missing");
        }
        if (!fs.existsSync(path.join(this.workflowPath, "originals"))) {
            issues.push("Original preservation directory missing");
        }
        for (const state of this.states.values()) {
            if (!state.originalPreserved) {
                issues.push(`Original not preserved for ${state.videoId}`);
            }
        }
        return { valid: issues.length === 0, issues };
    }
    repairSafeIssues() {
        const repairs = [];
        for (const state of this.states.values()) {
            if (!state.originalPreserved) {
                state.originalPreserved = true;
                this.persistOriginalMarker(state.projectId, state.videoId);
                repairs.push(`Restored original preservation for ${state.videoId}`);
            }
        }
        if (repairs.length > 0)
            this.persist();
        return repairs;
    }
    stateKey(projectId, videoId) {
        return `${projectId}::${videoId}`;
    }
    persistOriginalMarker(projectId, videoId) {
        const markerPath = path.join(this.workflowPath, "originals", `${projectId}-${videoId}.json`);
        fs.writeFileSync(markerPath, JSON.stringify({ projectId, videoId, preservedAt: new Date().toISOString() }, null, 2), "utf8");
    }
    loadFromDisk() {
        const raw = fs.readFileSync(this.catalogPath, "utf8");
        const catalog = JSON.parse(raw);
        this.states.clear();
        for (const state of catalog.states) {
            this.states.set(this.stateKey(state.projectId, state.videoId), state);
        }
    }
    persist() {
        const catalog = {
            lastUpdated: new Date().toISOString(),
            stateCount: this.states.size,
            states: [...this.states.values()],
        };
        fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2), "utf8");
    }
}
//# sourceMappingURL=non-destructive-workflow.js.map