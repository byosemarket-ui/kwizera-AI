/**
 * KWIZERA AI STUDIO — Product Intelligence Health Monitor Engine types (Step 5N)
 */
export var ProductIntelligenceHealthScoreLevel;
(function (ProductIntelligenceHealthScoreLevel) {
    ProductIntelligenceHealthScoreLevel["Excellent"] = "excellent";
    ProductIntelligenceHealthScoreLevel["Good"] = "good";
    ProductIntelligenceHealthScoreLevel["Warning"] = "warning";
    ProductIntelligenceHealthScoreLevel["Critical"] = "critical";
    ProductIntelligenceHealthScoreLevel["Failed"] = "failed";
})(ProductIntelligenceHealthScoreLevel || (ProductIntelligenceHealthScoreLevel = {}));
export var MonitoredProductIntelligenceModule;
(function (MonitoredProductIntelligenceModule) {
    MonitoredProductIntelligenceModule["ProductIntelligenceFoundation"] = "product-intelligence-foundation";
    MonitoredProductIntelligenceModule["ProductAnalysis"] = "product-analysis-engine";
    MonitoredProductIntelligenceModule["ProductUnderstanding"] = "product-understanding-engine";
    MonitoredProductIntelligenceModule["AudienceIntelligence"] = "audience-intelligence";
    MonitoredProductIntelligenceModule["MarketingStrategy"] = "marketing-strategy-intelligence";
    MonitoredProductIntelligenceModule["CreativeDirection"] = "creative-direction";
    MonitoredProductIntelligenceModule["StoryboardIntelligence"] = "storyboard-intelligence";
    MonitoredProductIntelligenceModule["ScriptPlanning"] = "script-planning";
    MonitoredProductIntelligenceModule["VisualPlanning"] = "visual-planning";
    MonitoredProductIntelligenceModule["AudioPlanning"] = "audio-planning";
    MonitoredProductIntelligenceModule["ProductionPlanning"] = "production-planning";
    MonitoredProductIntelligenceModule["QualityPrediction"] = "quality-prediction";
    MonitoredProductIntelligenceModule["ProductIntelligenceOptimization"] = "product-intelligence-optimization";
    MonitoredProductIntelligenceModule["ProductIntelligenceRegistry"] = "product-intelligence-registry";
    MonitoredProductIntelligenceModule["ProductIntelligenceDatabase"] = "product-intelligence-database";
    MonitoredProductIntelligenceModule["ProductRelationships"] = "product-relationships";
    MonitoredProductIntelligenceModule["ProductSearch"] = "product-search";
    MonitoredProductIntelligenceModule["ProductCache"] = "product-cache";
})(MonitoredProductIntelligenceModule || (MonitoredProductIntelligenceModule = {}));
export var ProductIntelligenceWarningType;
(function (ProductIntelligenceWarningType) {
    ProductIntelligenceWarningType["PlanningFailure"] = "planning-failure";
    ProductIntelligenceWarningType["RelationshipFailure"] = "relationship-failure";
    ProductIntelligenceWarningType["BrokenDependencies"] = "broken-dependencies";
    ProductIntelligenceWarningType["InvalidProductData"] = "invalid-product-data";
    ProductIntelligenceWarningType["AudienceMismatch"] = "audience-mismatch";
    ProductIntelligenceWarningType["MarketingMisalignment"] = "marketing-misalignment";
    ProductIntelligenceWarningType["CreativeInconsistency"] = "creative-inconsistency";
    ProductIntelligenceWarningType["StoryboardProblems"] = "storyboard-problems";
    ProductIntelligenceWarningType["ScriptProblems"] = "script-problems";
    ProductIntelligenceWarningType["VisualPlanningProblems"] = "visual-planning-problems";
    ProductIntelligenceWarningType["AudioPlanningProblems"] = "audio-planning-problems";
    ProductIntelligenceWarningType["ProductionPlanningProblems"] = "production-planning-problems";
    ProductIntelligenceWarningType["HighResourceUsage"] = "high-resource-usage";
    ProductIntelligenceWarningType["SearchFailure"] = "search-failure";
    ProductIntelligenceWarningType["DatabaseProblems"] = "database-problems";
    ProductIntelligenceWarningType["RegistryProblems"] = "registry-problems";
    ProductIntelligenceWarningType["CacheProblems"] = "cache-problems";
})(ProductIntelligenceWarningType || (ProductIntelligenceWarningType = {}));
export class ProductIntelligenceHealthMonitorEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductIntelligenceHealthMonitorEngineError";
    }
}
//# sourceMappingURL=types.js.map