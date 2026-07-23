import { MemoryCategory } from "../memory-foundation/types.js";
import { MemoryStorageType } from "./types.js";
/** Storage infrastructure for future memory modules — prepared, not implemented */
export const STORAGE_TYPE_DEFINITIONS = [
    { type: MemoryStorageType.Project, name: "Project Memory", subdirectory: "projects", categoryLabel: "project", foundationCategory: MemoryCategory.Project },
    { type: MemoryStorageType.Product, name: "Product Memory", subdirectory: "products", categoryLabel: "product", foundationCategory: MemoryCategory.Product },
    { type: MemoryStorageType.Video, name: "Video Memory", subdirectory: "videos", categoryLabel: "video", foundationCategory: MemoryCategory.Video },
    { type: MemoryStorageType.Marketing, name: "Marketing Memory", subdirectory: "marketing", categoryLabel: "marketing", foundationCategory: MemoryCategory.Marketing },
    { type: MemoryStorageType.Knowledge, name: "Knowledge Memory", subdirectory: "knowledge", categoryLabel: "knowledge", foundationCategory: MemoryCategory.Knowledge },
    { type: MemoryStorageType.Learning, name: "Learning Memory", subdirectory: "learning", categoryLabel: "learning", foundationCategory: MemoryCategory.Learning },
    { type: MemoryStorageType.Language, name: "Language Memory", subdirectory: "language", categoryLabel: "language", foundationCategory: MemoryCategory.Language },
    { type: MemoryStorageType.Workflow, name: "Workflow Memory", subdirectory: "workflows", categoryLabel: "workflow", foundationCategory: MemoryCategory.Workflow },
    { type: MemoryStorageType.Decision, name: "Decision Memory", subdirectory: "decisions", categoryLabel: "decision", foundationCategory: MemoryCategory.Decision },
    { type: MemoryStorageType.Reasoning, name: "Reasoning Memory", subdirectory: "reasoning", categoryLabel: "reasoning", foundationCategory: MemoryCategory.Reasoning },
    { type: MemoryStorageType.UserPreference, name: "User Preference Memory", subdirectory: "user-preferences", categoryLabel: "user-preference", foundationCategory: MemoryCategory.UserPreference },
    { type: MemoryStorageType.System, name: "System Memory", subdirectory: "system", categoryLabel: "system", foundationCategory: MemoryCategory.Persistent },
];
export function getStorageTypeDefinition(type) {
    const def = STORAGE_TYPE_DEFINITIONS.find((d) => d.type === type);
    if (!def) {
        throw new Error(`Unsupported memory storage type: ${type}`);
    }
    return def;
}
export function mapStorageTypeToFoundationCategory(type) {
    return getStorageTypeDefinition(type).foundationCategory;
}
//# sourceMappingURL=storage-type-config.js.map