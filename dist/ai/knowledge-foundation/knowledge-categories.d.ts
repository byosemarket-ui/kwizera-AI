import { KnowledgeAccessPermission, KnowledgeCategory, KnowledgeModuleStatus, KnowledgeSource } from "./types.js";
export interface PreparedKnowledgeCategory {
    category: KnowledgeCategory;
    knowledgeId: string;
    knowledgeName: string;
    subdirectory: string;
    dependencies: string[];
    defaultSource: KnowledgeSource;
    accessPermissions: KnowledgeAccessPermission[];
}
/** Foundation slots for future knowledge modules — prepared, not implemented */
export declare const PREPARED_KNOWLEDGE_CATEGORIES: PreparedKnowledgeCategory[];
export declare const SUPPORTED_KNOWLEDGE_SOURCES: readonly [KnowledgeSource.MemoryEngine, KnowledgeSource.LearningEngine, KnowledgeSource.Project, KnowledgeSource.Product, KnowledgeSource.Video, KnowledgeSource.MarketingCampaign, KnowledgeSource.UserPreference, KnowledgeSource.ReasoningHistory, KnowledgeSource.DecisionHistory, KnowledgeSource.KnowledgeModule, KnowledgeSource.Manual, KnowledgeSource.System];
export declare const DEFAULT_MODULE_STATUS = KnowledgeModuleStatus.Prepared;
//# sourceMappingURL=knowledge-categories.d.ts.map