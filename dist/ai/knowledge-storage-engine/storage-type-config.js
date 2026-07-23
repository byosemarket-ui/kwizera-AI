import { KnowledgeCategory } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "./types.js";
/** Storage infrastructure for future knowledge modules — prepared, not implemented */
export const KNOWLEDGE_STORAGE_TYPE_DEFINITIONS = [
    { type: KnowledgeStorageType.Product, name: "Product Knowledge", subdirectory: "products", categoryLabel: "product", foundationCategory: KnowledgeCategory.Product },
    { type: KnowledgeStorageType.Image, name: "Image Knowledge", subdirectory: "images", categoryLabel: "image", foundationCategory: KnowledgeCategory.Image },
    { type: KnowledgeStorageType.Video, name: "Video Knowledge", subdirectory: "videos", categoryLabel: "video", foundationCategory: KnowledgeCategory.Video },
    { type: KnowledgeStorageType.Marketing, name: "Marketing Knowledge", subdirectory: "marketing", categoryLabel: "marketing", foundationCategory: KnowledgeCategory.Marketing },
    { type: KnowledgeStorageType.Brand, name: "Brand Knowledge", subdirectory: "brand", categoryLabel: "brand", foundationCategory: KnowledgeCategory.Brand },
    { type: KnowledgeStorageType.Language, name: "Language Knowledge", subdirectory: "language", categoryLabel: "language", foundationCategory: KnowledgeCategory.Language },
    { type: KnowledgeStorageType.Creative, name: "Creative Knowledge", subdirectory: "creative", categoryLabel: "creative", foundationCategory: KnowledgeCategory.Creative },
    { type: KnowledgeStorageType.Technical, name: "Technical Knowledge", subdirectory: "technical", categoryLabel: "technical", foundationCategory: KnowledgeCategory.Technical },
    { type: KnowledgeStorageType.Business, name: "Business Knowledge", subdirectory: "business", categoryLabel: "business", foundationCategory: KnowledgeCategory.Business },
    { type: KnowledgeStorageType.Workflow, name: "Workflow Knowledge", subdirectory: "workflow", categoryLabel: "workflow", foundationCategory: KnowledgeCategory.Workflow },
    { type: KnowledgeStorageType.Decision, name: "Decision Knowledge", subdirectory: "decisions", categoryLabel: "decision", foundationCategory: KnowledgeCategory.Workflow },
    { type: KnowledgeStorageType.Reasoning, name: "Reasoning Knowledge", subdirectory: "reasoning", categoryLabel: "reasoning", foundationCategory: KnowledgeCategory.Technical },
    { type: KnowledgeStorageType.Industry, name: "Industry Knowledge", subdirectory: "industry", categoryLabel: "industry", foundationCategory: KnowledgeCategory.Industry },
];
export function getKnowledgeStorageTypeDefinition(type) {
    const def = KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.find((d) => d.type === type);
    if (!def) {
        throw new Error(`Unsupported knowledge storage type: ${type}`);
    }
    return def;
}
export function mapStorageTypeToFoundationCategory(type) {
    return getKnowledgeStorageTypeDefinition(type).foundationCategory;
}
//# sourceMappingURL=storage-type-config.js.map