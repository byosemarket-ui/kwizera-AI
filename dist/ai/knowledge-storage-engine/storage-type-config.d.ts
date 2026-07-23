import { KnowledgeCategory } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "./types.js";
export interface KnowledgeStorageTypeDefinition {
    type: KnowledgeStorageType;
    name: string;
    subdirectory: string;
    categoryLabel: string;
    foundationCategory: KnowledgeCategory;
}
/** Storage infrastructure for future knowledge modules — prepared, not implemented */
export declare const KNOWLEDGE_STORAGE_TYPE_DEFINITIONS: KnowledgeStorageTypeDefinition[];
export declare function getKnowledgeStorageTypeDefinition(type: KnowledgeStorageType): KnowledgeStorageTypeDefinition;
export declare function mapStorageTypeToFoundationCategory(type: KnowledgeStorageType): KnowledgeCategory;
//# sourceMappingURL=storage-type-config.d.ts.map