/**
 * KWIZERA AI STUDIO — Knowledge Validation Engine types (Step 4M)
 */
import { KnowledgeSource } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export var KnowledgeValidationLevel;
(function (KnowledgeValidationLevel) {
    KnowledgeValidationLevel["Draft"] = "draft";
    KnowledgeValidationLevel["PendingValidation"] = "pending-validation";
    KnowledgeValidationLevel["Validated"] = "validated";
    KnowledgeValidationLevel["Trusted"] = "trusted";
    KnowledgeValidationLevel["Archived"] = "archived";
    KnowledgeValidationLevel["Rejected"] = "rejected";
})(KnowledgeValidationLevel || (KnowledgeValidationLevel = {}));
export class KnowledgeValidationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "KnowledgeValidationEngineError";
    }
}
export const TRUSTED_QUALITY_MIN = 75;
export const TRUSTED_CONFIDENCE_MIN = 70;
export const TRUSTED_RELIABILITY_MIN = 65;
export const TRUSTED_CONSISTENCY_MIN = 70;
export const KNOWN_KNOWLEDGE_SOURCES = [
    KnowledgeSource.MemoryEngine,
    KnowledgeSource.LearningEngine,
    KnowledgeSource.Project,
    KnowledgeSource.Product,
    KnowledgeSource.Video,
    KnowledgeSource.MarketingCampaign,
    KnowledgeSource.UserPreference,
    KnowledgeSource.ReasoningHistory,
    KnowledgeSource.DecisionHistory,
    KnowledgeSource.KnowledgeModule,
    KnowledgeSource.Manual,
    KnowledgeSource.System,
];
export const SOURCE_MODULE_MAP = {
    [KnowledgeSource.MemoryEngine]: "memory-engine",
    [KnowledgeSource.LearningEngine]: "learning-memory-engine",
    [KnowledgeSource.Product]: "product-knowledge",
    [KnowledgeSource.Video]: "video-knowledge",
    [KnowledgeSource.MarketingCampaign]: "marketing-knowledge",
    [KnowledgeSource.KnowledgeModule]: "knowledge-module",
    [KnowledgeStorageType.Image]: "image-knowledge",
    [KnowledgeStorageType.Brand]: "brand-knowledge",
    [KnowledgeStorageType.Language]: "language-knowledge",
    [KnowledgeStorageType.Creative]: "creative-knowledge",
};
//# sourceMappingURL=types.js.map