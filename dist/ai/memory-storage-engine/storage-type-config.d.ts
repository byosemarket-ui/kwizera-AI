import { MemoryCategory } from "../memory-foundation/types.js";
import { MemoryStorageType } from "./types.js";
export interface StorageTypeDefinition {
    type: MemoryStorageType;
    name: string;
    subdirectory: string;
    categoryLabel: string;
    foundationCategory: MemoryCategory;
}
/** Storage infrastructure for future memory modules — prepared, not implemented */
export declare const STORAGE_TYPE_DEFINITIONS: StorageTypeDefinition[];
export declare function getStorageTypeDefinition(type: MemoryStorageType): StorageTypeDefinition;
export declare function mapStorageTypeToFoundationCategory(type: MemoryStorageType): MemoryCategory;
//# sourceMappingURL=storage-type-config.d.ts.map