/**
 * KWIZERA AI STUDIO — Image Intelligence Foundation types (Step 6A)
 */
export var ImageIntelligenceLifecycleState;
(function (ImageIntelligenceLifecycleState) {
    ImageIntelligenceLifecycleState["Initializing"] = "initializing";
    ImageIntelligenceLifecycleState["Loading"] = "loading";
    ImageIntelligenceLifecycleState["Ready"] = "ready";
    ImageIntelligenceLifecycleState["Analyzing"] = "analyzing";
    ImageIntelligenceLifecycleState["Planning"] = "planning";
    ImageIntelligenceLifecycleState["Validating"] = "validating";
    ImageIntelligenceLifecycleState["Optimizing"] = "optimizing";
    ImageIntelligenceLifecycleState["Recovering"] = "recovering";
    ImageIntelligenceLifecycleState["Closing"] = "closing";
    ImageIntelligenceLifecycleState["Closed"] = "closed";
})(ImageIntelligenceLifecycleState || (ImageIntelligenceLifecycleState = {}));
export var ImageIntelligenceCategory;
(function (ImageIntelligenceCategory) {
    ImageIntelligenceCategory["ImageAnalysis"] = "image-analysis";
    ImageIntelligenceCategory["ImageUnderstanding"] = "image-understanding";
    ImageIntelligenceCategory["ObjectDetection"] = "object-detection";
    ImageIntelligenceCategory["Background"] = "background-intelligence";
    ImageIntelligenceCategory["Composition"] = "composition-intelligence";
    ImageIntelligenceCategory["LightingColor"] = "lighting-color-intelligence";
    ImageIntelligenceCategory["BrandVisual"] = "brand-visual-intelligence";
    ImageIntelligenceCategory["EnhancementPlanning"] = "image-enhancement-planning";
    ImageIntelligenceCategory["CreativeImage"] = "creative-image-intelligence";
    ImageIntelligenceCategory["ProductionPlanning"] = "production-image-planning";
    ImageIntelligenceCategory["QualityPrediction"] = "image-quality-prediction";
    ImageIntelligenceCategory["Optimization"] = "image-intelligence-optimization";
    ImageIntelligenceCategory["HealthMonitoring"] = "image-intelligence-health-monitor";
})(ImageIntelligenceCategory || (ImageIntelligenceCategory = {}));
export var ImageIntelligenceModuleStatus;
(function (ImageIntelligenceModuleStatus) {
    ImageIntelligenceModuleStatus["Prepared"] = "prepared";
    ImageIntelligenceModuleStatus["Registered"] = "registered";
    ImageIntelligenceModuleStatus["Active"] = "active";
    ImageIntelligenceModuleStatus["Disabled"] = "disabled";
    ImageIntelligenceModuleStatus["Validating"] = "validating";
    ImageIntelligenceModuleStatus["Recovering"] = "recovering";
    ImageIntelligenceModuleStatus["Failed"] = "failed";
})(ImageIntelligenceModuleStatus || (ImageIntelligenceModuleStatus = {}));
export var ImageIntelligenceHealthLevel;
(function (ImageIntelligenceHealthLevel) {
    ImageIntelligenceHealthLevel["Excellent"] = "excellent";
    ImageIntelligenceHealthLevel["Good"] = "good";
    ImageIntelligenceHealthLevel["Warning"] = "warning";
    ImageIntelligenceHealthLevel["Critical"] = "critical";
    ImageIntelligenceHealthLevel["Failed"] = "failed";
})(ImageIntelligenceHealthLevel || (ImageIntelligenceHealthLevel = {}));
export var ImageIntelligenceSource;
(function (ImageIntelligenceSource) {
    ImageIntelligenceSource["MemoryEngine"] = "memory-engine";
    ImageIntelligenceSource["KnowledgeEngine"] = "knowledge-engine";
    ImageIntelligenceSource["ProductIntelligenceEngine"] = "product-intelligence-engine";
    ImageIntelligenceSource["ImageKnowledge"] = "image-knowledge";
    ImageIntelligenceSource["VisualPlanning"] = "visual-planning";
    ImageIntelligenceSource["CreativeDirection"] = "creative-direction";
    ImageIntelligenceSource["UserInput"] = "user-input";
    ImageIntelligenceSource["System"] = "system";
    ImageIntelligenceSource["Manual"] = "manual";
})(ImageIntelligenceSource || (ImageIntelligenceSource = {}));
export var ImageIntelligenceVerificationStatus;
(function (ImageIntelligenceVerificationStatus) {
    ImageIntelligenceVerificationStatus["Unverified"] = "unverified";
    ImageIntelligenceVerificationStatus["Pending"] = "pending";
    ImageIntelligenceVerificationStatus["Verified"] = "verified";
    ImageIntelligenceVerificationStatus["Rejected"] = "rejected";
    ImageIntelligenceVerificationStatus["Archived"] = "archived";
})(ImageIntelligenceVerificationStatus || (ImageIntelligenceVerificationStatus = {}));
export var ImageIntelligenceAccessPermission;
(function (ImageIntelligenceAccessPermission) {
    ImageIntelligenceAccessPermission["Read"] = "read";
    ImageIntelligenceAccessPermission["Write"] = "write";
    ImageIntelligenceAccessPermission["Update"] = "update";
    ImageIntelligenceAccessPermission["Delete"] = "delete";
    ImageIntelligenceAccessPermission["Validate"] = "validate";
    ImageIntelligenceAccessPermission["Admin"] = "admin";
})(ImageIntelligenceAccessPermission || (ImageIntelligenceAccessPermission = {}));
export var ImageIntelligenceAccessOperation;
(function (ImageIntelligenceAccessOperation) {
    ImageIntelligenceAccessOperation["Read"] = "read";
    ImageIntelligenceAccessOperation["Write"] = "write";
    ImageIntelligenceAccessOperation["Update"] = "update";
    ImageIntelligenceAccessOperation["Delete"] = "delete";
    ImageIntelligenceAccessOperation["Validate"] = "validate";
    ImageIntelligenceAccessOperation["Query"] = "query";
})(ImageIntelligenceAccessOperation || (ImageIntelligenceAccessOperation = {}));
export class ImageIntelligenceFoundationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageIntelligenceFoundationError";
    }
}
//# sourceMappingURL=types.js.map