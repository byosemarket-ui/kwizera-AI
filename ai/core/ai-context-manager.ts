import { randomUUID } from "node:crypto";
import { AiLifecycleState, AiRuntimeContext } from "./types.js";

export class AiContextManager {
  private context: AiRuntimeContext | null = null;

  create(correlationId?: string): AiRuntimeContext {
    this.context = {
      correlationId: correlationId ?? randomUUID(),
      startedAt: new Date().toISOString(),
      lifecycleState: AiLifecycleState.Initializing,
      metadata: {},
    };
    return this.context;
  }

  getContext(): AiRuntimeContext | null {
    return this.context;
  }

  updateLifecycleState(state: AiLifecycleState): void {
    if (!this.context) {
      return;
    }
    this.context = {
      ...this.context,
      lifecycleState: state,
    };
  }

  setActiveSession(sessionId: string | undefined): void {
    if (!this.context) {
      return;
    }
    this.context = {
      ...this.context,
      activeSessionId: sessionId,
    };
  }

  setMetadata(key: string, value: unknown): void {
    if (!this.context) {
      return;
    }
    this.context = {
      ...this.context,
      metadata: { ...this.context.metadata, [key]: value },
    };
  }

  clear(): void {
    this.context = null;
  }
}
