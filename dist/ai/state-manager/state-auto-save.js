export class StateAutoSave {
    logger;
    snapshots;
    triggers = new Set();
    autoSaveCount = 0;
    constructor(logger, snapshots) {
        this.logger = logger;
        this.snapshots = snapshots;
    }
    trigger(trigger, state) {
        this.triggers.add(trigger);
        this.snapshots.persistCurrentState(state, false);
        this.autoSaveCount += 1;
        this.logger.log("info", "auto-save", `Auto-save triggered: ${trigger}`, {
            trigger,
            count: this.autoSaveCount,
        });
    }
    getTriggeredCount() {
        return this.autoSaveCount;
    }
    getActiveTriggers() {
        return Array.from(this.triggers);
    }
    supports(trigger) {
        const supported = [
            "workflow-execution",
            "video-generation",
            "project-editing",
            "learning",
            "memory-update",
            "knowledge-update",
            "recovery",
        ];
        return supported.includes(trigger);
    }
}
//# sourceMappingURL=state-auto-save.js.map