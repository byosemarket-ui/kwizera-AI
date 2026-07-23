/**
 * KWIZERA AI STUDIO — Knowledge Health Monitor Engine types (Step 4N)
 */
export var KnowledgeHealthScoreLevel;
(function (KnowledgeHealthScoreLevel) {
    KnowledgeHealthScoreLevel["Excellent"] = "excellent";
    KnowledgeHealthScoreLevel["Good"] = "good";
    KnowledgeHealthScoreLevel["Warning"] = "warning";
    KnowledgeHealthScoreLevel["Critical"] = "critical";
    KnowledgeHealthScoreLevel["Failed"] = "failed";
})(KnowledgeHealthScoreLevel || (KnowledgeHealthScoreLevel = {}));
export var MonitoredKnowledgeModule;
(function (MonitoredKnowledgeModule) {
    MonitoredKnowledgeModule["KnowledgeFoundation"] = "knowledge-foundation";
    MonitoredKnowledgeModule["StorageEngine"] = "knowledge-storage-engine";
    MonitoredKnowledgeModule["RetrievalEngine"] = "knowledge-retrieval-engine";
    MonitoredKnowledgeModule["GraphEngine"] = "knowledge-graph-engine";
    MonitoredKnowledgeModule["ImageKnowledge"] = "image-knowledge-engine";
    MonitoredKnowledgeModule["VideoKnowledge"] = "video-knowledge-engine";
    MonitoredKnowledgeModule["MarketingKnowledge"] = "marketing-knowledge-engine";
    MonitoredKnowledgeModule["ProductKnowledge"] = "product-knowledge-engine";
    MonitoredKnowledgeModule["BrandKnowledge"] = "brand-knowledge-engine";
    MonitoredKnowledgeModule["LanguageKnowledge"] = "language-knowledge-engine";
    MonitoredKnowledgeModule["CreativeKnowledge"] = "creative-knowledge-engine";
    MonitoredKnowledgeModule["OptimizationEngine"] = "knowledge-optimization-engine";
    MonitoredKnowledgeModule["ValidationEngine"] = "knowledge-validation-engine";
    MonitoredKnowledgeModule["KnowledgeRegistry"] = "knowledge-registry";
    MonitoredKnowledgeModule["KnowledgeDatabase"] = "knowledge-database";
    MonitoredKnowledgeModule["KnowledgeCache"] = "knowledge-cache";
    MonitoredKnowledgeModule["KnowledgeRelationships"] = "knowledge-relationships";
    MonitoredKnowledgeModule["KnowledgeSearch"] = "knowledge-search";
    MonitoredKnowledgeModule["KnowledgeStorage"] = "knowledge-storage";
})(MonitoredKnowledgeModule || (MonitoredKnowledgeModule = {}));
export var KnowledgeWarningType;
(function (KnowledgeWarningType) {
    KnowledgeWarningType["KnowledgeCorruption"] = "knowledge-corruption";
    KnowledgeWarningType["BrokenRelationships"] = "broken-relationships";
    KnowledgeWarningType["InvalidSources"] = "invalid-sources";
    KnowledgeWarningType["DuplicateKnowledge"] = "duplicate-knowledge";
    KnowledgeWarningType["OutdatedKnowledge"] = "outdated-knowledge";
    KnowledgeWarningType["IncompleteKnowledge"] = "incomplete-knowledge";
    KnowledgeWarningType["GraphProblems"] = "graph-problems";
    KnowledgeWarningType["SearchFailure"] = "search-failure";
    KnowledgeWarningType["RetrievalFailure"] = "retrieval-failure";
    KnowledgeWarningType["ValidationFailure"] = "validation-failure";
    KnowledgeWarningType["StorageProblems"] = "storage-problems";
    KnowledgeWarningType["HighDiskUsage"] = "high-disk-usage";
    KnowledgeWarningType["HighMemoryUsage"] = "high-memory-usage";
    KnowledgeWarningType["SlowRetrieval"] = "slow-retrieval";
    KnowledgeWarningType["SlowSearch"] = "slow-search";
})(KnowledgeWarningType || (KnowledgeWarningType = {}));
export class KnowledgeHealthMonitorEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "KnowledgeHealthMonitorEngineError";
    }
}
//# sourceMappingURL=types.js.map