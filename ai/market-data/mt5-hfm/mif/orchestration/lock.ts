/**
 * Single-flight lock for Phase 3 intelligence orchestration.
 * Independent of Charts prepare lock / OpenAI gate; one orchestration at a time.
 */

let locked = false;
let holder: string | null = null;

export function tryAcquireOrchestrationLock(correlationId: string): boolean {
  if (locked) return false;
  locked = true;
  holder = correlationId;
  return true;
}

export function releaseOrchestrationLock(correlationId?: string | null): void {
  if (correlationId && holder && correlationId !== holder) return;
  locked = false;
  holder = null;
}

export function isOrchestrationLocked(): boolean {
  return locked;
}

export function getOrchestrationLockHolder(): string | null {
  return holder;
}

/** Test helper — never use in production paths. */
export function __resetOrchestrationLockForTests(): void {
  locked = false;
  holder = null;
}
