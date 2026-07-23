import fs from "node:fs";
import path from "node:path";
import { StateManagerLogger } from "./state-logger.js";
import { ApplicationStateSnapshot, StateSnapshot } from "./types.js";

export class StateSnapshotStore {
  private stateDirectory: string | null = null;
  private snapshotsDirectory: string | null = null;
  private currentStatePath: string | null = null;
  private readonly snapshots: StateSnapshot[] = [];
  private diskWrites = 0;

  constructor(private readonly logger: StateManagerLogger) {}

  initialize(stateDirectory: string): void {
    fs.mkdirSync(stateDirectory, { recursive: true });
    this.stateDirectory = stateDirectory;
    this.snapshotsDirectory = path.join(stateDirectory, "snapshots");
    this.currentStatePath = path.join(stateDirectory, "current-state.json");
    fs.mkdirSync(this.snapshotsDirectory, { recursive: true });
  }

  saveSnapshot(snapshot: StateSnapshot): void {
    if (!this.snapshotsDirectory || !this.currentStatePath) {
      return;
    }

    const filePath = path.join(this.snapshotsDirectory, `${snapshot.snapshotId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");

    const updateCurrent =
      snapshot.cleanShutdown ||
      snapshot.reason.startsWith("application-") ||
      snapshot.reason === "recovery-complete" ||
      snapshot.reason === "auto-save";

    if (updateCurrent) {
      fs.writeFileSync(this.currentStatePath, JSON.stringify(snapshot, null, 2), "utf8");
      this.diskWrites += 1;
    }

    this.snapshots.push(snapshot);
    this.diskWrites += 1;

    this.logger.log("info", "snapshot", `Snapshot saved: ${snapshot.snapshotId}`, {
      reason: snapshot.reason,
      cleanShutdown: snapshot.cleanShutdown,
    });
  }

  loadLatestSnapshot(): StateSnapshot | null {
    if (!this.currentStatePath || !fs.existsSync(this.currentStatePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.currentStatePath, "utf8");
      const snapshot = JSON.parse(raw) as StateSnapshot;
      return snapshot;
    } catch {
      return this.loadLatestFromSnapshotsDirectory();
    }
  }

  loadLatestFromSnapshotsDirectory(): StateSnapshot | null {
    if (!this.snapshotsDirectory || !fs.existsSync(this.snapshotsDirectory)) {
      return null;
    }

    const files = fs
      .readdirSync(this.snapshotsDirectory)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.snapshotsDirectory!, file), "utf8");
        return JSON.parse(raw) as StateSnapshot;
      } catch {
        continue;
      }
    }
    return null;
  }

  getSnapshots(): ReadonlyArray<StateSnapshot> {
    return this.snapshots;
  }

  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  getDiskWrites(): number {
    return this.diskWrites;
  }

  getStateDirectory(): string | null {
    return this.stateDirectory;
  }

  persistCurrentState(state: ApplicationStateSnapshot, cleanShutdown: boolean): void {
    if (!this.currentStatePath) return;
    const snapshot: StateSnapshot = {
      snapshotId: `current-${Date.now()}`,
      timestamp: new Date().toISOString(),
      reason: "auto-save",
      cleanShutdown,
      state,
    };
    fs.writeFileSync(this.currentStatePath, JSON.stringify(snapshot, null, 2), "utf8");
    this.diskWrites += 1;
  }
}
