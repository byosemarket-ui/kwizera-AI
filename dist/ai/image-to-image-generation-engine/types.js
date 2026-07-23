/**
 * KWIZERA AI STUDIO — Image-to-Image Generation Engine types (Step 9C)
 */
export var ImageToImagePlatform;
(function (ImageToImagePlatform) {
    ImageToImagePlatform["Website"] = "website";
    ImageToImagePlatform["Instagram"] = "instagram";
    ImageToImagePlatform["Facebook"] = "facebook";
    ImageToImagePlatform["TikTok"] = "tiktok";
    ImageToImagePlatform["LinkedIn"] = "linkedin";
    ImageToImagePlatform["Print"] = "print";
    ImageToImagePlatform["Billboard"] = "billboard";
    ImageToImagePlatform["Packaging"] = "packaging";
})(ImageToImagePlatform || (ImageToImagePlatform = {}));
export var ImageToImageInputType;
(function (ImageToImageInputType) {
    ImageToImageInputType["SourceImage"] = "source-image";
    ImageToImageInputType["TransformationPrompt"] = "transformation-prompt";
    ImageToImageInputType["ProductInformation"] = "product-information";
    ImageToImageInputType["BrandGuidelines"] = "brand-guidelines";
    ImageToImageInputType["StyleReferences"] = "style-references";
    ImageToImageInputType["KnowledgeRecord"] = "knowledge-record";
})(ImageToImageInputType || (ImageToImageInputType = {}));
export var TransformationType;
(function (TransformationType) {
    TransformationType["StyleTransfer"] = "style-transfer";
    TransformationType["BackgroundReplacement"] = "background-replacement";
    TransformationType["ColorModification"] = "color-modification";
    TransformationType["LightingAdjustment"] = "lighting-adjustment";
    TransformationType["CompositionAdjustment"] = "composition-adjustment";
    TransformationType["ObjectReplacement"] = "object-replacement";
    TransformationType["ObjectRemoval"] = "object-removal";
    TransformationType["SubjectEnhancement"] = "subject-enhancement";
    TransformationType["ResolutionPlanning"] = "resolution-planning";
})(TransformationType || (TransformationType = {}));
export var PreservationRule;
(function (PreservationRule) {
    PreservationRule["PreserveIdentity"] = "preserve-identity";
    PreservationRule["PreserveProductShape"] = "preserve-product-shape";
    PreservationRule["PreserveLogo"] = "preserve-logo";
    PreservationRule["PreserveBrandColors"] = "preserve-brand-colors";
    PreservationRule["PreserveComposition"] = "preserve-composition";
    PreservationRule["PreserveUserSelectedAreas"] = "preserve-user-selected-areas";
})(PreservationRule || (PreservationRule = {}));
export var MaskType;
(function (MaskType) {
    MaskType["EditableMask"] = "editable-mask";
    MaskType["ProtectedMask"] = "protected-mask";
    MaskType["RegionSelection"] = "region-selection";
    MaskType["ForegroundMask"] = "foreground-mask";
    MaskType["BackgroundMask"] = "background-mask";
    MaskType["ObjectMask"] = "object-mask";
})(MaskType || (MaskType = {}));
export var ImageTransformationStyle;
(function (ImageTransformationStyle) {
    ImageTransformationStyle["Photorealistic"] = "photorealistic";
    ImageTransformationStyle["Commercial"] = "commercial";
    ImageTransformationStyle["Luxury"] = "luxury";
    ImageTransformationStyle["Corporate"] = "corporate";
    ImageTransformationStyle["Cartoon"] = "cartoon";
    ImageTransformationStyle["Illustration"] = "illustration";
    ImageTransformationStyle["Watercolor"] = "watercolor";
    ImageTransformationStyle["OilPainting"] = "oil-painting";
    ImageTransformationStyle["PencilSketch"] = "pencil-sketch";
    ImageTransformationStyle["ThreeDStyle"] = "3d-style";
    ImageTransformationStyle["ProductPhotography"] = "product-photography";
})(ImageTransformationStyle || (ImageTransformationStyle = {}));
export var ImageTransformationBackgroundType;
(function (ImageTransformationBackgroundType) {
    ImageTransformationBackgroundType["White"] = "white-background";
    ImageTransformationBackgroundType["Transparent"] = "transparent-background";
    ImageTransformationBackgroundType["Studio"] = "studio-background";
    ImageTransformationBackgroundType["Lifestyle"] = "lifestyle-background";
    ImageTransformationBackgroundType["Outdoor"] = "outdoor-background";
    ImageTransformationBackgroundType["Custom"] = "custom-background";
})(ImageTransformationBackgroundType || (ImageTransformationBackgroundType = {}));
export var ImageTransformationVariationType;
(function (ImageTransformationVariationType) {
    ImageTransformationVariationType["VariationA"] = "variation-a";
    ImageTransformationVariationType["VariationB"] = "variation-b";
    ImageTransformationVariationType["VariationC"] = "variation-c";
    ImageTransformationVariationType["StyleVariation"] = "style-variation";
    ImageTransformationVariationType["BackgroundVariation"] = "background-variation";
    ImageTransformationVariationType["ColorVariation"] = "color-variation";
})(ImageTransformationVariationType || (ImageTransformationVariationType = {}));
export var SourceImageCategory;
(function (SourceImageCategory) {
    SourceImageCategory["Product"] = "product";
    SourceImageCategory["Portrait"] = "portrait";
    SourceImageCategory["Lifestyle"] = "lifestyle";
    SourceImageCategory["Packaging"] = "packaging";
    SourceImageCategory["Brand"] = "brand";
})(SourceImageCategory || (SourceImageCategory = {}));
export class ImageToImageGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageToImageGenerationEngineError";
    }
}
export const ALL_IMAGE_TO_IMAGE_PLATFORMS = [
    ImageToImagePlatform.Website,
    ImageToImagePlatform.Instagram,
    ImageToImagePlatform.Facebook,
    ImageToImagePlatform.TikTok,
    ImageToImagePlatform.LinkedIn,
    ImageToImagePlatform.Print,
    ImageToImagePlatform.Billboard,
    ImageToImagePlatform.Packaging,
];
export const ALL_TRANSFORMATION_TYPES = [
    TransformationType.StyleTransfer,
    TransformationType.BackgroundReplacement,
    TransformationType.ColorModification,
    TransformationType.LightingAdjustment,
    TransformationType.CompositionAdjustment,
    TransformationType.ObjectReplacement,
    TransformationType.ObjectRemoval,
    TransformationType.SubjectEnhancement,
    TransformationType.ResolutionPlanning,
];
export const ALL_PRESERVATION_RULES = [
    PreservationRule.PreserveIdentity,
    PreservationRule.PreserveProductShape,
    PreservationRule.PreserveLogo,
    PreservationRule.PreserveBrandColors,
    PreservationRule.PreserveComposition,
    PreservationRule.PreserveUserSelectedAreas,
];
export const PLATFORM_CONFIG = {
    [ImageToImagePlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
    [ImageToImagePlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
    [ImageToImagePlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
    [ImageToImagePlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [ImageToImagePlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
    [ImageToImagePlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [ImageToImagePlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
    [ImageToImagePlatform.Packaging]: { aspectRatio: "4:5", resolution: "2400x3000", width: 2400, height: 3000 },
};
//# sourceMappingURL=types.js.map