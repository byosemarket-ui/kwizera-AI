import { randomUUID } from "node:crypto";
import { ApplicationState, SystemState } from "./types.js";
export class StateRecovery {
    snapshots;
    logger;
    constructor(snapshots, logger) {
        this.snapshots = snapshots;
        this.logger = logger;
    }
    recoverFromUnexpectedShutdown(snapshot, target) {
        const unfinishedWorkflows = Object.entries(snapshot.state.workflows)
            .filter(([, w]) => w.state === "running" || w.state === "waiting" || w.state === "paused")
            .map(([id]) => id);
        const unfinishedTasks = Object.entries(snapshot.state.tasks)
            .filter(([, t]) => t.state === "running" || t.state === "queued" || t.state === "retrying")
            .map(([id]) => id);
        target.application = ApplicationState.Recovering;
        target.system = SystemState.Recovery;
        target.workflows = { ...snapshot.state.workflows };
        target.tasks = { ...snapshot.state.tasks };
        target.projects = { ...snapshot.state.projects };
        target.sessions = { ...snapshot.state.sessions };
        target.modules = { ...snapshot.state.modules };
        for (const wfId of unfinishedWorkflows) {
            if (target.workflows[wfId]) {
                target.workflows[wfId] = {
                    ...target.workflows[wfId],
                    state: "recovered",
                    updatedAt: new Date().toISOString(),
                    metadata: { ...target.workflows[wfId].metadata, recoveredFromUnexpectedShutdown: true },
                };
            }
        }
        for (const taskId of unfinishedTasks) {
            if (target.tasks[taskId]) {
                target.tasks[taskId] = {
                    ...target.tasks[taskId],
                    state: "recovered",
                    updatedAt: new Date().toISOString(),
                    metadata: { ...target.tasks[taskId].metadata, recoveredFromUnexpectedShutdown: true },
                };
            }
        }
        const recoverySnapshot = {
            snapshotId: `recovery-${randomUUID().slice(0, 8)}`,
            timestamp: new Date().toISOString(),
            reason: "unexpected-shutdown-recovery",
            cleanShutdown: false,
            state: structuredClone(target),
        };
        this.snapshots.saveSnapshot(recoverySnapshot);
        const message = `Recovered from unclean shutdown; ${unfinishedWorkflows.length} workflow(s), ${unfinishedTasks.length} task(s) preserved`;
        this.logger.log("warn", "recovery", message, {
            snapshotId: snapshot.snapshotId,
            unfinishedWorkflows,
            unfinishedTasks,
        });
        return {
            recovered: true,
            snapshotId: snapshot.snapshotId,
            message,
            unfinishedWorkflows,
            unfinishedTasks,
        };
    }
    wasUncleanShutdown(snapshot) {
        return Boolean(snapshot && !snapshot.cleanShutdown);
    }
}
//# sourceMappingURL=state-recovery.js.map