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
export declare const PREPARED_MEMORY_CATEGORIES: PreparedMemoryCategory[];
export declare const PROTECTED_DATA_CATEGORIES: readonly ["projects", "learning", "history", "decisions", "reasoning", "generated-content", "user-preferences", "workflows", "brand-assets", "recovery-information"];
export declare const DEFAULT_MODULE_STATUS = MemoryModuleStatus.Prepared;
//# sourceMappingURL=memory-categories.d.ts.map