import { RestoreMode } from "../memory-backup-engine/types.js";
import { MemoryRecoveryType } from "./types.js";

export const RECOVERY_PATH_PREFIXES: Partial<Record<MemoryRecoveryType, string[]>> = {
  [MemoryRecoveryType.Learning]: ["memory/learning"],
  [MemoryRecoveryType.Relationship]: ["memory/relationships"],
  [MemoryRecoveryType.Memory]: ["memory"],
  [MemoryRecoveryType.Configuration]: ["config"],
  [MemoryRecoveryType.Database]: ["database"],
};

export function resolveRestoreMode(type: MemoryRecoveryType): RestoreMode {
  switch (type) {
    case MemoryRecoveryType.Full:
    case MemoryRecoveryType.Emergency:
      return RestoreMode.Full;
    case MemoryRecoveryType.Project:
      return RestoreMode.Project;
    case MemoryRecoveryType.Memory:
      return RestoreMode.Memory;
    case MemoryRecoveryType.Configuration:
      return RestoreMode.Configuration;
    case MemoryRecoveryType.Database:
      return RestoreMode.Database;
    case MemoryRecoveryType.Selective:
      return RestoreMode.Selective;
    default:
      return RestoreMode.Selective;
  }
}

export function resolveRecoveredComponents(type: MemoryRecoveryType): string[] {
  const map: Record<MemoryRecoveryType, string[]> = {
    [MemoryRecoveryType.Full]: ["memory", "projects", "learning", "relationships", "config", "database"],
    [MemoryRecoveryType.Selective]: ["selective-components"],
    [MemoryRecoveryType.Project]: ["project-memory", "project-assets"],
    [MemoryRecoveryType.Memory]: ["persistent-memory", "indexes"],
    [MemoryRecoveryType.Database]: ["database"],
    [MemoryRecoveryType.Configuration]: ["configuration", "ai-settings"],
    [MemoryRecoveryType.Learning]: ["learning-memory"],
    [MemoryRecoveryType.Relationship]: ["relationship-memory"],
    [MemoryRecoveryType.Emergency]: ["full-system"],
  };
  return map[type];
}
