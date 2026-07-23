import { AiCoreError, AiLifecycleState } from "./types.js";

const VALID_TRANSITIONS: Record<AiLifecycleState, AiLifecycleState[]> = {
  [AiLifecycleState.Initializing]: [
    AiLifecycleState.Loading,
    AiLifecycleState.Failed,
    AiLifecycleState.Stopping,
  ],
  [AiLifecycleState.Loading]: [
    AiLifecycleState.Ready,
    AiLifecycleState.Failed,
    AiLifecycleState.Stopping,
  ],
  [AiLifecycleState.Ready]: [
    AiLifecycleState.Running,
    AiLifecycleState.Recovering,
    AiLifecycleState.Stopping,
    AiLifecycleState.Failed,
  ],
  [AiLifecycleState.Running]: [
    AiLifecycleState.Paused,
    AiLifecycleState.Ready,
    AiLifecycleState.Recovering,
    AiLifecycleState.Stopping,
    AiLifecycleState.Failed,
  ],
  [AiLifecycleState.Paused]: [
    AiLifecycleState.Running,
    AiLifecycleState.Recovering,
    AiLifecycleState.Stopping,
    AiLifecycleState.Failed,
  ],
  [AiLifecycleState.Recovering]: [
    AiLifecycleState.Ready,
    AiLifecycleState.Running,
    AiLifecycleState.Failed,
    AiLifecycleState.Stopping,
  ],
  [AiLifecycleState.Stopping]: [AiLifecycleState.Stopped, AiLifecycleState.Failed],
  [AiLifecycleState.Stopped]: [AiLifecycleState.Initializing],
  [AiLifecycleState.Failed]: [
    AiLifecycleState.Recovering,
    AiLifecycleState.Stopping,
    AiLifecycleState.Initializing,
  ],
};

export class AiLifecycleManager {
  private state: AiLifecycleState = AiLifecycleState.Stopped;
  private readonly history: Array<{ state: AiLifecycleState; at: string }> = [];

  getState(): AiLifecycleState {
    return this.state;
  }

  getHistory(): ReadonlyArray<{ state: AiLifecycleState; at: string }> {
    return this.history;
  }

  transition(next: AiLifecycleState, reason?: string): void {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      throw new AiCoreError(
        `Invalid lifecycle transition: ${this.state} -> ${next}${reason ? ` (${reason})` : ""}`,
        "LIFECYCLE_INVALID_TRANSITION"
      );
    }
    this.state = next;
    this.history.push({ state: next, at: new Date().toISOString() });
  }

  reset(): void {
    this.state = AiLifecycleState.Stopped;
    this.history.length = 0;
    this.history.push({ state: AiLifecycleState.Stopped, at: new Date().toISOString() });
  }

  isOperational(): boolean {
    return (
      this.state === AiLifecycleState.Ready ||
      this.state === AiLifecycleState.Running ||
      this.state === AiLifecycleState.Paused
    );
  }
}
