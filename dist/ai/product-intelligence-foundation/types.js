/**
 * KWIZERA AI STUDIO — Product Intelligence Foundation types (Step 5A)
 */
export var ProductIntelligenceLifecycleState;
(function (ProductIntelligenceLifecycleState) {
    ProductIntelligenceLifecycleState["Initializing"] = "initializing";
    ProductIntelligenceLifecycleState["Loading"] = "loading";
    ProductIntelligenceLifecycleState["Ready"] = "ready";
    ProductIntelligenceLifecycleState["Analyzing"] = "analyzing";
    ProductIntelligenceLifecycleState["Planning"] = "planning";
    ProductIntelligenceLifecycleState["Validating"] = "validating";
    ProductIntelligenceLifecycleState["Optimizing"] = "optimizing";
    ProductIntelligenceLifecycleState["Recovering"] = "recovering";
    ProductIntelligenceLifecycleState["Closing"] = "closing";
    ProductIntelligenceLifecycleState["Closed"] = "closed";
})(ProductIntelligenceLifecycleState || (ProductIntelligenceLifecycleState = {}));
export var ProductIntelligenceCategory;
(function (ProductIntelligenceCategory) {
    ProductIntelligenceCategory["ProductAnalysis"] = "product-analysis";
    ProductIntelligenceCategory["ProductUnderstanding"] = "product-understanding";
    ProductIntelligenceCategory["AudienceIntelligence"] = "audience-intelligence";
    ProductIntelligenceCategory["MarketingStrategy"] = "marketing-strategy-intelligence";
    ProductIntelligenceCategory["CreativeDirection"] = "creative-direction";
    ProductIntelligenceCategory["StoryboardIntelligence"] = "storyboard-intelligence";
    ProductIntelligenceCategory["ScriptPlanning"] = "script-planning";
    ProductIntelligenceCategory["VisualPlanning"] = "visual-planning";
    ProductIntelligenceCategory["AudioPlanning"] = "audio-planning";
    ProductIntelligenceCategory["ProductionPlanning"] = "production-planning";
    ProductIntelligenceCategory["QualityPrediction"] = "quality-prediction";
    ProductIntelligenceCategory["Optimization"] = "product-intelligence-optimization";
    ProductIntelligenceCategory["HealthMonitoring"] = "product-intelligence-health-monitor";
})(ProductIntelligenceCategory || (ProductIntelligenceCategory = {}));
export var ProductIntelligenceModuleStatus;
(function (ProductIntelligenceModuleStatus) {
    ProductIntelligenceModuleStatus["Prepared"] = "prepared";
    ProductIntelligenceModuleStatus["Registered"] = "registered";
    ProductIntelligenceModuleStatus["Active"] = "active";
    ProductIntelligenceModuleStatus["Disabled"] = "disabled";
    ProductIntelligenceModuleStatus["Validating"] = "validating";
    ProductIntelligenceModuleStatus["Recovering"] = "recovering";
    ProductIntelligenceModuleStatus["Failed"] = "failed";
})(ProductIntelligenceModuleStatus || (ProductIntelligenceModuleStatus = {}));
export var ProductIntelligenceHealthLevel;
(function (ProductIntelligenceHealthLevel) {
    ProductIntelligenceHealthLevel["Excellent"] = "excellent";
    ProductIntelligenceHealthLevel["Good"] = "good";
    ProductIntelligenceHealthLevel["Warning"] = "warning";
    ProductIntelligenceHealthLevel["Critical"] = "critical";
    ProductIntelligenceHealthLevel["Failed"] = "failed";
})(ProductIntelligenceHealthLevel || (ProductIntelligenceHealthLevel = {}));
export var ProductIntelligenceSource;
(function (ProductIntelligenceSource) {
    ProductIntelligenceSource["MemoryEngine"] = "memory-engine";
    ProductIntelligenceSource["KnowledgeEngine"] = "knowledge-engine";
    ProductIntelligenceSource["ProductKnowledge"] = "product-knowledge";
    ProductIntelligenceSource["BrandKnowledge"] = "brand-knowledge";
    ProductIntelligenceSource["MarketingKnowledge"] = "marketing-knowledge";
    ProductIntelligenceSource["UserInput"] = "user-input";
    ProductIntelligenceSource["System"] = "system";
    ProductIntelligenceSource["Manual"] = "manual";
})(ProductIntelligenceSource || (ProductIntelligenceSource = {}));
export var ProductIntelligenceVerificationStatus;
(function (ProductIntelligenceVerificationStatus) {
    ProductIntelligenceVerificationStatus["Unverified"] = "unverified";
    ProductIntelligenceVerificationStatus["Pending"] = "pending";
    ProductIntelligenceVerificationStatus["Verified"] = "verified";
    ProductIntelligenceVerificationStatus["Rejected"] = "rejected";
    ProductIntelligenceVerificationStatus["Archived"] = "archived";
})(ProductIntelligenceVerificationStatus || (ProductIntelligenceVerificationStatus = {}));
export var ProductIntelligenceAccessPermission;
(function (ProductIntelligenceAccessPermission) {
    ProductIntelligenceAccessPermission["Read"] = "read";
    ProductIntelligenceAccessPermission["Write"] = "write";
    ProductIntelligenceAccessPermission["Update"] = "update";
    ProductIntelligenceAccessPermission["Delete"] = "delete";
    ProductIntelligenceAccessPermission["Validate"] = "validate";
    ProductIntelligenceAccessPermission["Admin"] = "admin";
})(ProductIntelligenceAccessPermission || (ProductIntelligenceAccessPermission = {}));
export var ProductIntelligenceAccessOperation;
(function (ProductIntelligenceAccessOperation) {
    ProductIntelligenceAccessOperation["Read"] = "read";
    ProductIntelligenceAccessOperation["Write"] = "write";
    ProductIntelligenceAccessOperation["Update"] = "update";
    ProductIntelligenceAccessOperation["Delete"] = "delete";
    ProductIntelligenceAccessOperation["Validate"] = "validate";
    ProductIntelligenceAccessOperation["Query"] = "query";
})(ProductIntelligenceAccessOperation || (ProductIntelligenceAccessOperation = {}));
export class ProductIntelligenceFoundationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductIntelligenceFoundationError";
    }
}
//# sourceMappingURL=types.js.map