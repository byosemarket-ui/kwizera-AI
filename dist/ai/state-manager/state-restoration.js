export class StateRestoration {
    snapshots;
    logger;
    constructor(snapshots, logger) {
        this.snapshots = snapshots;
        this.logger = logger;
    }
    restore(snapshot, target) {
        const s = snapshot.state;
        target.application = s.application;
        target.aiCore = s.aiCore;
        target.system = s.system;
        target.modules = { ...s.modules };
        target.workflows = { ...s.workflows };
        target.tasks = { ...s.tasks };
        target.projects = { ...s.projects };
        target.sessions = { ...s.sessions };
        const result = {
            restored: true,
            snapshotId: snapshot.snapshotId,
            restoredWorkflows: Object.keys(s.workflows).length,
            restoredTasks: Object.keys(s.tasks).length,
            restoredProjects: Object.keys(s.projects).length,
            restoredSessions: Object.keys(s.sessions).length,
            message: `Restored from snapshot ${snapshot.snapshotId}`,
        };
        this.logger.log("info", "restoration", result.message, {
            snapshotId: snapshot.snapshotId,
            workflows: result.restoredWorkflows,
            tasks: result.restoredTasks,
        });
        return result;
    }
    findRestorableSnapshot() {
        return this.snapshots.loadLatestSnapshot();
    }
}
//# sourceMappingURL=state-restoration.js.map