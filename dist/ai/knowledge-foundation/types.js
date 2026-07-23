/**
 * KWIZERA AI STUDIO — Knowledge Foundation types (Step 4A)
 */
export var KnowledgeLifecycleState;
(function (KnowledgeLifecycleState) {
    KnowledgeLifecycleState["Initializing"] = "initializing";
    KnowledgeLifecycleState["Loading"] = "loading";
    KnowledgeLifecycleState["Ready"] = "ready";
    KnowledgeLifecycleState["Reading"] = "reading";
    KnowledgeLifecycleState["Writing"] = "writing";
    KnowledgeLifecycleState["Updating"] = "updating";
    KnowledgeLifecycleState["Validating"] = "validating";
    KnowledgeLifecycleState["Optimizing"] = "optimizing";
    KnowledgeLifecycleState["Recovering"] = "recovering";
    KnowledgeLifecycleState["Closing"] = "closing";
    KnowledgeLifecycleState["Closed"] = "closed";
})(KnowledgeLifecycleState || (KnowledgeLifecycleState = {}));
export var KnowledgeCategory;
(function (KnowledgeCategory) {
    KnowledgeCategory["Product"] = "product-knowledge";
    KnowledgeCategory["Image"] = "image-knowledge";
    KnowledgeCategory["Video"] = "video-knowledge";
    KnowledgeCategory["Marketing"] = "marketing-knowledge";
    KnowledgeCategory["Brand"] = "brand-knowledge";
    KnowledgeCategory["Language"] = "language-knowledge";
    KnowledgeCategory["Creative"] = "creative-knowledge";
    KnowledgeCategory["Optimization"] = "knowledge-optimization";
    KnowledgeCategory["Validation"] = "knowledge-validation";
    KnowledgeCategory["HealthMonitoring"] = "knowledge-health-monitor";
    KnowledgeCategory["Technical"] = "technical-knowledge";
    KnowledgeCategory["Workflow"] = "workflow-knowledge";
    KnowledgeCategory["Business"] = "business-knowledge";
    KnowledgeCategory["UserPreference"] = "user-preference-knowledge";
    KnowledgeCategory["Industry"] = "industry-knowledge";
})(KnowledgeCategory || (KnowledgeCategory = {}));
export var KnowledgeModuleStatus;
(function (KnowledgeModuleStatus) {
    KnowledgeModuleStatus["Prepared"] = "prepared";
    KnowledgeModuleStatus["Registered"] = "registered";
    KnowledgeModuleStatus["Active"] = "active";
    KnowledgeModuleStatus["Disabled"] = "disabled";
    KnowledgeModuleStatus["Validating"] = "validating";
    KnowledgeModuleStatus["Recovering"] = "recovering";
    KnowledgeModuleStatus["Failed"] = "failed";
})(KnowledgeModuleStatus || (KnowledgeModuleStatus = {}));
export var KnowledgeHealthLevel;
(function (KnowledgeHealthLevel) {
    KnowledgeHealthLevel["Excellent"] = "excellent";
    KnowledgeHealthLevel["Good"] = "good";
    KnowledgeHealthLevel["Warning"] = "warning";
    KnowledgeHealthLevel["Critical"] = "critical";
    KnowledgeHealthLevel["Failed"] = "failed";
})(KnowledgeHealthLevel || (KnowledgeHealthLevel = {}));
export var KnowledgeSource;
(function (KnowledgeSource) {
    KnowledgeSource["MemoryEngine"] = "memory-engine";
    KnowledgeSource["LearningEngine"] = "learning-engine";
    KnowledgeSource["Project"] = "project";
    KnowledgeSource["Product"] = "product";
    KnowledgeSource["Video"] = "video";
    KnowledgeSource["MarketingCampaign"] = "marketing-campaign";
    KnowledgeSource["UserPreference"] = "user-preference";
    KnowledgeSource["ReasoningHistory"] = "reasoning-history";
    KnowledgeSource["DecisionHistory"] = "decision-history";
    KnowledgeSource["KnowledgeModule"] = "knowledge-module";
    KnowledgeSource["Manual"] = "manual";
    KnowledgeSource["System"] = "system";
})(KnowledgeSource || (KnowledgeSource = {}));
export var KnowledgeVerificationStatus;
(function (KnowledgeVerificationStatus) {
    KnowledgeVerificationStatus["Unverified"] = "unverified";
    KnowledgeVerificationStatus["Pending"] = "pending";
    KnowledgeVerificationStatus["Verified"] = "verified";
    KnowledgeVerificationStatus["Rejected"] = "rejected";
    KnowledgeVerificationStatus["Archived"] = "archived";
})(KnowledgeVerificationStatus || (KnowledgeVerificationStatus = {}));
export var KnowledgeAccessPermission;
(function (KnowledgeAccessPermission) {
    KnowledgeAccessPermission["Read"] = "read";
    KnowledgeAccessPermission["Write"] = "write";
    KnowledgeAccessPermission["Update"] = "update";
    KnowledgeAccessPermission["Delete"] = "delete";
    KnowledgeAccessPermission["Validate"] = "validate";
    KnowledgeAccessPermission["Admin"] = "admin";
})(KnowledgeAccessPermission || (KnowledgeAccessPermission = {}));
export var KnowledgeAccessOperation;
(function (KnowledgeAccessOperation) {
    KnowledgeAccessOperation["Read"] = "read";
    KnowledgeAccessOperation["Write"] = "write";
    KnowledgeAccessOperation["Update"] = "update";
    KnowledgeAccessOperation["Delete"] = "delete";
    KnowledgeAccessOperation["Validate"] = "validate";
    KnowledgeAccessOperation["Query"] = "query";
})(KnowledgeAccessOperation || (KnowledgeAccessOperation = {}));
export class KnowledgeFoundationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "KnowledgeFoundationError";
    }
}
//# sourceMappingURL=types.js.map