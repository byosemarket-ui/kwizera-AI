import { StateManagerLogger } from "./state-logger.js";
import { StateSnapshotStore } from "./state-snapshot-store.js";
import { ApplicationStateSnapshot, AutoSaveTrigger } from "./types.js";

export class StateAutoSave {
  private readonly triggers = new Set<AutoSaveTrigger>();
  private autoSaveCount = 0;

  constructor(
    private readonly logger: StateManagerLogger,
    private readonly snapshots: StateSnapshotStore
  ) {}

  trigger(trigger: AutoSaveTrigger, state: ApplicationStateSnapshot): void {
    this.triggers.add(trigger);
    this.snapshots.persistCurrentState(state, false);
    this.autoSaveCount += 1;
    this.logger.log("info", "auto-save", `Auto-save triggered: ${trigger}`, {
      trigger,
      count: this.autoSaveCount,
    });
  }

  getTriggeredCount(): number {
    return this.autoSaveCount;
  }

  getActiveTriggers(): AutoSaveTrigger[] {
    return Array.from(this.triggers);
  }

  supports(trigger: AutoSaveTrigger): boolean {
    const supported: AutoSaveTrigger[] = [
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
