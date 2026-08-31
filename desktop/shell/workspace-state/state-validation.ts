import type { ValidationResult, WorkspaceStateSnapshot } from "./types";

export function checksumPayload(payload: unknown): string {
  const text = JSON.stringify(payload);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

export function validateSnapshot(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Snapshot is missing or not an object"], warnings };
  }
  const snap = raw as Partial<WorkspaceStateSnapshot>;
  if (snap.version !== 1) errors.push("Unsupported snapshot version");
  if (!snap.id) errors.push("Missing snapshot id");
  if (!snap.savedAt) errors.push("Missing savedAt");
  if (!snap.session?.id) errors.push("Missing session");
  if (!snap.shell?.workspace) errors.push("Missing shell workspace");
  if (!snap.navigation) errors.push("Missing navigation state");
  if (!snap.layoutManager) errors.push("Missing layout manager state");
  if (!snap.preferences) errors.push("Missing preferences");
  if (!snap.projectMemory) errors.push("Missing project memory");
  if (!snap.ui) errors.push("Missing UI state");
  if (snap.checksum) {
    const { checksum: _ignored, ...rest } = snap as WorkspaceStateSnapshot;
    const expected = checksumPayload(rest);
    if (expected !== snap.checksum) {
      errors.push("Checksum mismatch — snapshot may be corrupted");
    }
  } else {
    warnings.push("Snapshot has no checksum");
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function rejectCorrupt<T>(raw: unknown, fallback: T, validate: (value: unknown) => ValidationResult): T {
  const result = validate(raw);
  return result.valid ? (raw as T) : fallback;
}

/** Recompute checksum after navigation-only patches so applySnapshot validation passes. */
export function recomputeSnapshotChecksum(snapshot: WorkspaceStateSnapshot): WorkspaceStateSnapshot {
  const { checksum: _ignored, ...base } = snapshot;
  return { ...base, checksum: checksumPayload(base) };
}
