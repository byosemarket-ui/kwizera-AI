import { KnowledgeSource } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KNOWN_KNOWLEDGE_SOURCES } from "./types.js";
const STORAGE_TYPE_SOURCES = {
    [KnowledgeStorageType.Product]: KnowledgeSource.Product,
    [KnowledgeStorageType.Image]: KnowledgeSource.KnowledgeModule,
    [KnowledgeStorageType.Video]: KnowledgeSource.Video,
    [KnowledgeStorageType.Marketing]: KnowledgeSource.MarketingCampaign,
    [KnowledgeStorageType.Brand]: KnowledgeSource.KnowledgeModule,
    [KnowledgeStorageType.Language]: KnowledgeSource.KnowledgeModule,
    [KnowledgeStorageType.Creative]: KnowledgeSource.KnowledgeModule,
    [KnowledgeStorageType.Technical]: KnowledgeSource.System,
    [KnowledgeStorageType.Business]: KnowledgeSource.KnowledgeModule,
    [KnowledgeStorageType.Workflow]: KnowledgeSource.MemoryEngine,
    [KnowledgeStorageType.Decision]: KnowledgeSource.DecisionHistory,
    [KnowledgeStorageType.Reasoning]: KnowledgeSource.ReasoningHistory,
    [KnowledgeStorageType.Industry]: KnowledgeSource.KnowledgeModule,
};
const MODULE_BY_TYPE = {
    [KnowledgeStorageType.Product]: "product-knowledge",
    [KnowledgeStorageType.Image]: "image-knowledge",
    [KnowledgeStorageType.Video]: "video-knowledge",
    [KnowledgeStorageType.Marketing]: "marketing-knowledge",
    [KnowledgeStorageType.Brand]: "brand-knowledge",
    [KnowledgeStorageType.Language]: "language-knowledge",
    [KnowledgeStorageType.Creative]: "creative-knowledge",
};
export class KnowledgeSourceValidator {
    foundation;
    logger;
    static MODULE_ENGINE_SOURCES = new Set([
        "creative-knowledge-engine",
        "language-knowledge-engine",
        "brand-knowledge-engine",
        "product-knowledge-engine",
        "marketing-knowledge-engine",
        "video-knowledge-engine",
        "image-knowledge-engine",
        "knowledge-validation-engine",
        "knowledge-optimization-engine",
    ]);
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    validateSource(source) {
        const issues = [];
        const isKnown = KNOWN_KNOWLEDGE_SOURCES.includes(source) ||
            KnowledgeSourceValidator.MODULE_ENGINE_SOURCES.has(source);
        if (!isKnown) {
            issues.push(`Unknown knowledge source: ${source}`);
        }
        const moduleId = this.resolveModuleForSource(source);
        const trusted = isKnown && issues.length === 0;
        if (!trusted) {
            this.logger.log("warn", "source", "Source validation failed", { source, issues });
        }
        return { source, valid: issues.length === 0, trusted, moduleId, issues };
    }
    validateRecordSource(record) {
        const base = this.validateSource(record.source);
        const issues = [...base.issues];
        const expectedSource = STORAGE_TYPE_SOURCES[record.knowledgeType];
        const isModuleEngineSource = KnowledgeSourceValidator.MODULE_ENGINE_SOURCES.has(record.source);
        if (expectedSource &&
            record.source !== expectedSource &&
            record.source !== KnowledgeSource.KnowledgeModule &&
            record.source !== KnowledgeSource.Manual &&
            !isModuleEngineSource) {
            issues.push(`Source ${record.source} does not match expected source for ${record.knowledgeType}`);
        }
        const moduleId = MODULE_BY_TYPE[record.knowledgeType];
        if (moduleId) {
            const mod = this.foundation.getRegistry().getModule(moduleId);
            if (!mod || !mod.implemented) {
                issues.push(`Knowledge module not implemented: ${moduleId}`);
            }
        }
        if (record.sourceReliability < 30) {
            issues.push("Source reliability critically low");
        }
        return {
            source: record.source,
            valid: issues.length === 0,
            trusted: issues.length === 0 && record.sourceReliability >= 50,
            moduleId: moduleId ?? base.moduleId,
            issues,
        };
    }
    resolveModuleForSource(source) {
        switch (source) {
            case KnowledgeSource.Product:
                return "product-knowledge";
            case KnowledgeSource.Video:
                return "video-knowledge";
            case KnowledgeSource.MarketingCampaign:
                return "marketing-knowledge";
            case KnowledgeSource.MemoryEngine:
                return "memory-engine";
            case KnowledgeSource.LearningEngine:
                return "learning-memory-engine";
            default:
                return undefined;
        }
    }
}
//# sourceMappingURL=knowledge-source-validator.js.map