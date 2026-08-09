import type { AutomationTaskDefinition, MaintenanceSchedule } from "./types.js";

export const TASK_CATALOG: AutomationTaskDefinition[] = [
  {
    name: "project-auto-save",
    schedule: "hourly",
    description: "Trigger personal project workspace auto-save markers",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "workspace-auto-save",
    schedule: "hourly",
    description: "Persist workspace settings snapshot",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "incremental-backup",
    schedule: "daily",
    description: "Create incremental restore points for projects/knowledge/settings",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "cache-cleanup",
    schedule: "daily",
    description: "Remove unused/broken cache only after backup verification",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "temporary-file-cleanup",
    schedule: "daily",
    description: "Remove expired temp files; never user assets/projects",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "log-rotation",
    schedule: "weekly",
    description: "Rotate oversized maintenance and engine logs",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "index-optimization",
    schedule: "weekly",
    description: "Compact local search indexes",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "database-optimization",
    schedule: "weekly",
    description: "Optimize/compact JSON store databases safely",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "knowledge-index-refresh",
    schedule: "daily",
    description: "Refresh knowledge search index without removing validated knowledge",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "asset-index-refresh",
    schedule: "daily",
    description: "Refresh local asset library search index",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "project-integrity-check",
    schedule: "weekly",
    description: "Verify project folder integrity and repair safe inconsistencies",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
];

export const MONTHLY_TASKS: AutomationTaskDefinition[] = [
  {
    name: "incremental-backup",
    schedule: "monthly",
    description: "Full monthly restore-point sweep",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "database-optimization",
    schedule: "monthly",
    description: "Deep monthly database compact",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
  {
    name: "log-rotation",
    schedule: "monthly",
    description: "Monthly archive of rotated logs",
    touchesUserAssets: false,
    touchesValidatedKnowledge: false,
  },
];

export function tasksForSchedule(schedule: MaintenanceSchedule): AutomationTaskDefinition[] {
  if (schedule === "manual") return [...TASK_CATALOG];
  if (schedule === "monthly") return MONTHLY_TASKS;
  return TASK_CATALOG.filter((t) => t.schedule === schedule);
}

export function isProtectedPath(relativeOrAbsolute: string): boolean {
  const lower = relativeOrAbsolute.replace(/\\/g, "/").toLowerCase();
  const protectedSegments = [
    "/projects/",
    "/originals/",
    "/assets/",
    "/images/",
    "/videos/",
    "/knowledge/",
    "/validated/",
    "library-store.json",
    "workspace-store.json",
  ];
  // Temp/cache only zones are never protected by name alone
  if (lower.includes("/cache/") || lower.includes("/tmp/") || lower.includes("/temp/") || lower.includes("/logs/")) {
    return false;
  }
  return protectedSegments.some((s) => lower.includes(s));
}
