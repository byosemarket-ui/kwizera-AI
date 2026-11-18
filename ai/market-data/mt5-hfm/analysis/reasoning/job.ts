/**
 * Single-flight Phase 3 reasoning job lock (compatible with Phase 2 prep lock).
 */
import type { HfmReasoningJobStatus, HfmReasoningRecord } from "./types.js";

let lockHeld = false;
let active: HfmReasoningRecord | null = null;

export function tryAcquireReasoningLock(): boolean {
  if (lockHeld) return false;
  lockHeld = true;
  return true;
}

export function releaseReasoningLock(): void {
  lockHeld = false;
}

export function setActiveReasoningRecord(record: HfmReasoningRecord | null): void {
  active = record;
}

export function getActiveReasoningRecord(): HfmReasoningRecord | null {
  return active;
}

export function isReasoningLocked(): boolean {
  return lockHeld;
}

export function patchActiveStatus(status: HfmReasoningJobStatus): void {
  if (active) active = { ...active, status };
}

export function __resetReasoningJobStateForTests(): void {
  lockHeld = false;
  active = null;
}
