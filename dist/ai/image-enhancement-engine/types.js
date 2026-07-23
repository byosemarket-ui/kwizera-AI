/**
 * KWIZERA AI STUDIO — Image Enhancement & Restoration Engine types (Step 9G)
 */
export var ImageEnhanceGenPlatform;
(function (ImageEnhanceGenPlatform) {
    ImageEnhanceGenPlatform["Website"] = "website";
    ImageEnhanceGenPlatform["Mobile"] = "mobile";
    ImageEnhanceGenPlatform["Instagram"] = "instagram";
    ImageEnhanceGenPlatform["Facebook"] = "facebook";
    ImageEnhanceGenPlatform["TikTok"] = "tiktok";
    ImageEnhanceGenPlatform["LinkedIn"] = "linkedin";
    ImageEnhanceGenPlatform["Print"] = "print";
    ImageEnhanceGenPlatform["Catalogue"] = "catalogue";
    ImageEnhanceGenPlatform["Billboard"] = "billboard";
})(ImageEnhanceGenPlatform || (ImageEnhanceGenPlatform = {}));
export var ImageEnhanceGenInputType;
(function (ImageEnhanceGenInputType) {
    ImageEnhanceGenInputType["SourceImage"] = "source-image";
    ImageEnhanceGenInputType["EditedImage"] = "edited-image";
    ImageEnhanceGenInputType["ProductImage"] = "product-image";
    ImageEnhanceGenInputType["BrandGuidelines"] = "brand-guidelines";
    ImageEnhanceGenInputType["RestorationPrompt"] = "restoration-prompt";
    ImageEnhanceGenInputType["KnowledgeRecord"] = "knowledge-record";
})(ImageEnhanceGenInputType || (ImageEnhanceGenInputType = {}));
export var ImageEnhanceOperationType;
(function (ImageEnhanceOperationType) {
    ImageEnhanceOperationType["SuperResolutionPlanning"] = "super-resolution-planning";
    ImageEnhanceOperationType["ImageUpscaling"] = "image-upscaling";
    ImageEnhanceOperationType["NoiseReduction"] = "noise-reduction";
    ImageEnhanceOperationType["Deblurring"] = "deblurring";
    ImageEnhanceOperationType["DetailEnhancement"] = "detail-enhancement";
    ImageEnhanceOperationType["TextureEnhancement"] = "texture-enhancement";
    ImageEnhanceOperationType["ColorCorrection"] = "color-correction";
    ImageEnhanceOperationType["WhiteBalanceCorrection"] = "white-balance-correction";
    ImageEnhanceOperationType["ExposureCorrection"] = "exposure-correction";
    ImageEnhanceOperationType["ContrastEnhancement"] = "contrast-enhancement";
    ImageEnhanceOperationType["HdrPreparation"] = "hdr-preparation";
})(ImageEnhanceOperationType || (ImageEnhanceOperationType = {}));
export var ImageEnhanceRestorationType;
(function (ImageEnhanceRestorationType) {
    ImageEnhanceRestorationType["ScratchRemoval"] = "scratch-removal";
    ImageEnhanceRestorationType["DustRemoval"] = "dust-removal";
    ImageEnhanceRestorationType["CrackRepair"] = "crack-repair";
    ImageEnhanceRestorationType["MissingAreaRecovery"] = "missing-area-recovery";
    ImageEnhanceRestorationType["FaceRestoration"] = "face-restoration";
    ImageEnhanceRestorationType["ObjectRestoration"] = "object-restoration";
    ImageEnhanceRestorationType["DocumentRestoration"] = "document-restoration";
    ImageEnhanceRestorationType["HistoricalPhotoRestoration"] = "historical-photo-restoration";
})(ImageEnhanceRestorationType || (ImageEnhanceRestorationType = {}));
export var ImageEnhancePreservationTarget;
(function (ImageEnhancePreservationTarget) {
    ImageEnhancePreservationTarget["HumanIdentity"] = "human-identity";
    ImageEnhancePreservationTarget["ProductIdentity"] = "product-identity";
    ImageEnhancePreservationTarget["LogoIntegrity"] = "logo-integrity";
    ImageEnhancePreservationTarget["PackagingIntegrity"] = "packaging-integrity";
    ImageEnhancePreservationTarget["BrandColors"] = "brand-colors";
    ImageEnhancePreservationTarget["OriginalComposition"] = "original-composition";
})(ImageEnhancePreservationTarget || (ImageEnhancePreservationTarget = {}));
export var ImageEnhanceCategory;
(function (ImageEnhanceCategory) {
    ImageEnhanceCategory["Product"] = "product";
    ImageEnhanceCategory["Fashion"] = "fashion";
    ImageEnhanceCategory["Historical"] = "historical";
    ImageEnhanceCategory["Document"] = "document";
    ImageEnhanceCategory["Portrait"] = "portrait";
    ImageEnhanceCategory["Landscape"] = "landscape";
})(ImageEnhanceCategory || (ImageEnhanceCategory = {}));
export class ImageEnhancementEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageEnhancementEngineError";
    }
}
export const ALL_IMAGE_ENHANCE_OPERATIONS = [
    ImageEnhanceOperationType.SuperResolutionPlanning,
    ImageEnhanceOperationType.ImageUpscaling,
    ImageEnhanceOperationType.NoiseReduction,
    ImageEnhanceOperationType.Deblurring,
    ImageEnhanceOperationType.DetailEnhancement,
    ImageEnhanceOperationType.TextureEnhancement,
    ImageEnhanceOperationType.ColorCorrection,
    ImageEnhanceOperationType.WhiteBalanceCorrection,
    ImageEnhanceOperationType.ExposureCorrection,
    ImageEnhanceOperationType.ContrastEnhancement,
    ImageEnhanceOperationType.HdrPreparation,
];
export const ALL_IMAGE_ENHANCE_RESTORATION_TYPES = [
    ImageEnhanceRestorationType.ScratchRemoval,
    ImageEnhanceRestorationType.DustRemoval,
    ImageEnhanceRestorationType.CrackRepair,
    ImageEnhanceRestorationType.MissingAreaRecovery,
    ImageEnhanceRestorationType.FaceRestoration,
    ImageEnhanceRestorationType.ObjectRestoration,
    ImageEnhanceRestorationType.DocumentRestoration,
    ImageEnhanceRestorationType.HistoricalPhotoRestoration,
];
export const ALL_IMAGE_ENHANCE_PRESERVATION_TARGETS = [
    ImageEnhancePreservationTarget.HumanIdentity,
    ImageEnhancePreservationTarget.ProductIdentity,
    ImageEnhancePreservationTarget.LogoIntegrity,
    ImageEnhancePreservationTarget.PackagingIntegrity,
    ImageEnhancePreservationTarget.BrandColors,
    ImageEnhancePreservationTarget.OriginalComposition,
];
export const ALL_IMAGE_ENHANCE_GEN_PLATFORMS = [
    ImageEnhanceGenPlatform.Website,
    ImageEnhanceGenPlatform.Mobile,
    ImageEnhanceGenPlatform.Instagram,
    ImageEnhanceGenPlatform.Facebook,
    ImageEnhanceGenPlatform.TikTok,
    ImageEnhanceGenPlatform.LinkedIn,
    ImageEnhanceGenPlatform.Print,
    ImageEnhanceGenPlatform.Catalogue,
    ImageEnhanceGenPlatform.Billboard,
];
export const IMAGE_ENHANCE_PLATFORM_CONFIG = {
    [ImageEnhanceGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
    [ImageEnhanceGenPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [ImageEnhanceGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
    [ImageEnhanceGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
    [ImageEnhanceGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [ImageEnhanceGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
    [ImageEnhanceGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [ImageEnhanceGenPlatform.Catalogue]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [ImageEnhanceGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
//# sourceMappingURL=types.js.map