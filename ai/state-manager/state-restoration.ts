import { StateManagerLogger } from "./state-logger.js";
import { StateSnapshotStore } from "./state-snapshot-store.js";
import { ApplicationStateSnapshot, RestorationResult, StateSnapshot } from "./types.js";

export class StateRestoration {
  constructor(
    private readonly snapshots: StateSnapshotStore,
    private readonly logger: StateManagerLogger
  ) {}

  restore(snapshot: StateSnapshot, target: ApplicationStateSnapshot): RestorationResult {
    const s = snapshot.state;
    target.application = s.application;
    target.aiCore = s.aiCore;
    target.system = s.system;
    target.modules = { ...s.modules };
    target.workflows = { ...s.workflows };
    target.tasks = { ...s.tasks };
    target.projects = { ...s.projects };
    target.sessions = { ...s.sessions };

    const result: RestorationResult = {
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

  findRestorableSnapshot(): StateSnapshot | null {
    return this.snapshots.loadLatestSnapshot();
  }
}
