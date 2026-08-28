/** Normalize backend / UI project name sentinels into a real project or null. */

const EMPTY_PROJECT_LABELS = new Set([
  "",
  "none",
  "no project",
  "no active project",
]);

export function resolveActiveProjectName(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (EMPTY_PROJECT_LABELS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function deriveProjectStatus(
  projectName: string | null,
  activeJobs: number,
): "idle" | "draft" | "in-production" {
  if (!projectName) return "idle";
  if (activeJobs > 0) return "in-production";
  return "draft";
}
