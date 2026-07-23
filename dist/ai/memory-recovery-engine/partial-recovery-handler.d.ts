import { RestoreMode } from "../memory-backup-engine/types.js";
import { MemoryRecoveryType } from "./types.js";
export declare const RECOVERY_PATH_PREFIXES: Partial<Record<MemoryRecoveryType, string[]>>;
export declare function resolveRestoreMode(type: MemoryRecoveryType): RestoreMode;
export declare function resolveRecoveredComponents(type: MemoryRecoveryType): string[];
//# sourceMappingURL=partial-recovery-handler.d.ts.map