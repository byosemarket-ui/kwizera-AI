/**
 * KWIZERA AI STUDIO — Production Image Planning Engine types (Step 6K)
 */
export var ProductionImagePlatform;
(function (ProductionImagePlatform) {
    ProductionImagePlatform["Instagram"] = "instagram";
    ProductionImagePlatform["Facebook"] = "facebook";
    ProductionImagePlatform["TikTok"] = "tiktok";
    ProductionImagePlatform["YouTube"] = "youtube";
    ProductionImagePlatform["WhatsApp"] = "whatsapp";
    ProductionImagePlatform["Website"] = "website";
    ProductionImagePlatform["Print"] = "print";
})(ProductionImagePlatform || (ProductionImagePlatform = {}));
export var ProductionWorkflowStep;
(function (ProductionWorkflowStep) {
    ProductionWorkflowStep["ImageAnalysis"] = "image-analysis";
    ProductionWorkflowStep["EnhancementValidation"] = "enhancement-validation";
    ProductionWorkflowStep["AssetValidation"] = "asset-validation";
    ProductionWorkflowStep["CompositionValidation"] = "composition-validation";
    ProductionWorkflowStep["BackgroundValidation"] = "background-validation";
    ProductionWorkflowStep["BrandValidation"] = "brand-validation";
    ProductionWorkflowStep["CreativeValidation"] = "creative-validation";
    ProductionWorkflowStep["RenderingPreparation"] = "rendering-preparation";
    ProductionWorkflowStep["ExportPreparation"] = "export-preparation";
    ProductionWorkflowStep["DeliveryPreparation"] = "delivery-preparation";
})(ProductionWorkflowStep || (ProductionWorkflowStep = {}));
export var ProductionExportFormat;
(function (ProductionExportFormat) {
    ProductionExportFormat["PNG"] = "png";
    ProductionExportFormat["JPG"] = "jpg";
    ProductionExportFormat["WEBP"] = "webp";
    ProductionExportFormat["SVG"] = "svg";
    ProductionExportFormat["PDF"] = "pdf";
})(ProductionExportFormat || (ProductionExportFormat = {}));
export class ProductionImagePlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductionImagePlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map