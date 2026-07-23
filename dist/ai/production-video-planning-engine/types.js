/**
 * KWIZERA AI STUDIO — Production Video Planning Engine types (Step 7K)
 */
export var ProductionVideoPlatform;
(function (ProductionVideoPlatform) {
    ProductionVideoPlatform["TikTok"] = "tiktok";
    ProductionVideoPlatform["Instagram"] = "instagram";
    ProductionVideoPlatform["Facebook"] = "facebook";
    ProductionVideoPlatform["YouTube"] = "youtube";
    ProductionVideoPlatform["WhatsApp"] = "whatsapp";
    ProductionVideoPlatform["Website"] = "website";
    ProductionVideoPlatform["Television"] = "television";
    ProductionVideoPlatform["DigitalSignage"] = "digital-signage";
})(ProductionVideoPlatform || (ProductionVideoPlatform = {}));
export var ProductionVideoWorkflowStep;
(function (ProductionVideoWorkflowStep) {
    ProductionVideoWorkflowStep["AnalysisValidation"] = "analysis-validation";
    ProductionVideoWorkflowStep["UnderstandingValidation"] = "understanding-validation";
    ProductionVideoWorkflowStep["SceneValidation"] = "scene-validation";
    ProductionVideoWorkflowStep["TimelineValidation"] = "timeline-validation";
    ProductionVideoWorkflowStep["CameraValidation"] = "camera-validation";
    ProductionVideoWorkflowStep["MotionValidation"] = "motion-validation";
    ProductionVideoWorkflowStep["StyleValidation"] = "style-validation";
    ProductionVideoWorkflowStep["EnhancementValidation"] = "enhancement-validation";
    ProductionVideoWorkflowStep["CreativeValidation"] = "creative-validation";
    ProductionVideoWorkflowStep["RenderingPreparation"] = "rendering-preparation";
    ProductionVideoWorkflowStep["ExportPreparation"] = "export-preparation";
    ProductionVideoWorkflowStep["DeliveryPreparation"] = "delivery-preparation";
})(ProductionVideoWorkflowStep || (ProductionVideoWorkflowStep = {}));
export var ProductionVideoExportFormat;
(function (ProductionVideoExportFormat) {
    ProductionVideoExportFormat["MP4"] = "mp4";
    ProductionVideoExportFormat["MOV"] = "mov";
    ProductionVideoExportFormat["MKV"] = "mkv";
    ProductionVideoExportFormat["WEBM"] = "webm";
    ProductionVideoExportFormat["GIF"] = "gif";
})(ProductionVideoExportFormat || (ProductionVideoExportFormat = {}));
export class ProductionVideoPlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductionVideoPlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map