import { MemoryCategory, MemoryAccessPermission, MemoryModuleStatus } from "./types.js";

export interface PreparedMemoryCategory {
  category: MemoryCategory;
  memoryId: string;
  memoryName: string;
  subdirectory: string;
  dependencies: string[];
  accessPermissions: MemoryAccessPermission[];
}

/** Foundation slots for future memory modules — prepared, not implemented */
export const PREPARED_MEMORY_CATEGORIES: PreparedMemoryCategory[] = [
  {
    category: MemoryCategory.Persistent,
    memoryId: "persistent-memory",
    memoryName: "Persistent Memory",
    subdirectory: "persistent",
    dependencies: ["memory-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write, MemoryAccessPermission.Update],
  },
  {
    category: MemoryCategory.Project,
    memoryId: "project-memory",
    memoryName: "Project Memory",
    subdirectory: "projects",
    dependencies: ["memory-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write, MemoryAccessPermission.Update],
  },
  {
    category: MemoryCategory.Product,
    memoryId: "product-memory",
    memoryName: "Product Memory",
    subdirectory: "products",
    dependencies: ["memory-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
  },
  {
    category: MemoryCategory.Video,
    memoryId: "video-memory",
    memoryName: "Video Memory",
    subdirectory: "videos",
    dependencies: ["memory-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
  },
  {
    category: MemoryCategory.Marketing,
    memoryId: "marketing-memory",
    memoryName: "Marketing Memory",
    subdirectory: "marketing",
    dependencies: ["memory-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
  },
  {
    category: MemoryCategory.Knowledge,
    memoryId: "knowledge-memory",
    memoryName: "Knowledge Memory",
    subdirectory: "knowledge",
    dependencies: ["memory-engine", "knowledge-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
  },
  {
    category: MemoryCategory.Language,
    memoryId: "language-memory",
    memoryName: "Language Memory",
    subdirectory: "language",
    dependencies: ["memory-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
  },
  {
    category: MemoryCategory.Learning,
    memoryId: "learning-memory",
    memoryName: "Learning Memory",
    subdirectory: "learning",
    dependencies: ["memory-engine", "learning-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write, MemoryAccessPermission.Update],
  },
  {
    category: MemoryCategory.UserPreference,
    memoryId: "user-preference-memory",
    memoryName: "User Preference Memory",
    subdirectory: "user-preferences",
    dependencies: ["memory-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write, MemoryAccessPermission.Update],
  },
  {
    category: MemoryCategory.Workflow,
    memoryId: "workflow-memory",
    memoryName: "Workflow Memory",
    subdirectory: "workflows",
    dependencies: ["memory-engine", "workflow-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
  },
  {
    category: MemoryCategory.Decision,
    memoryId: "decision-memory",
    memoryName: "Decision Memory",
    subdirectory: "decisions",
    dependencies: ["memory-engine", "decision-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
  },
  {
    category: MemoryCategory.Reasoning,
    memoryId: "reasoning-memory",
    memoryName: "Reasoning Memory",
    subdirectory: "reasoning",
    dependencies: ["memory-engine", "reasoning-engine"],
    accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
  },
];

export const PROTECTED_DATA_CATEGORIES = [
  "projects",
  "learning",
  "history",
  "decisions",
  "reasoning",
  "generated-content",
  "user-preferences",
  "workflows",
  "brand-assets",
  "recovery-information",
] as const;

export const DEFAULT_MODULE_STATUS = MemoryModuleStatus.Prepared;
