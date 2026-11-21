/**
 * Portable filesystem stem for logical persistence IDs.
 * Logical IDs (e.g. oe:<hash>:<kind>) are preserved in record payloads;
 * only physical filenames are sanitized for Windows + Linux.
 *
 * Allowed characters match ranking/probability path policy: [a-zA-Z0-9._-]
 * Characters outside that set (including ':') become '_'.
 */
export function portablePersistenceFileStem(logicalId: string): string {
  const raw = String(logicalId ?? "");
  if (!raw) return "_empty";
  const stem = raw.replace(/[^a-zA-Z0-9._-]/g, "_");
  return stem.length > 0 ? stem : "_empty";
}

/**
 * Legacy outcome stem that previously permitted ':' (Linux-writable, Windows-unsafe).
 * Used only for backward-compatible reads of historical files.
 */
export function legacyOutcomeFileStem(logicalId: string): string {
  const raw = String(logicalId ?? "");
  if (!raw) return "_empty";
  const stem = raw.replace(/[^a-zA-Z0-9._:-]/g, "_");
  return stem.length > 0 ? stem : "_empty";
}

export function isWindowsUnsafeFileStem(stem: string): boolean {
  return /[<>:"/\\|?*\u0000-\u001f]/.test(stem);
}
