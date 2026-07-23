/**
 * KWIZERA AI STUDIO — Image Editing, Inpainting & Outpainting Engine types (Step 9F)
 */
export var ImageEditGenPlatform;
(function (ImageEditGenPlatform) {
    ImageEditGenPlatform["Website"] = "website";
    ImageEditGenPlatform["Mobile"] = "mobile";
    ImageEditGenPlatform["Instagram"] = "instagram";
    ImageEditGenPlatform["Facebook"] = "facebook";
    ImageEditGenPlatform["TikTok"] = "tiktok";
    ImageEditGenPlatform["LinkedIn"] = "linkedin";
    ImageEditGenPlatform["Print"] = "print";
    ImageEditGenPlatform["Billboard"] = "billboard";
})(ImageEditGenPlatform || (ImageEditGenPlatform = {}));
export var ImageEditGenInputType;
(function (ImageEditGenInputType) {
    ImageEditGenInputType["SourceImage"] = "source-image";
    ImageEditGenInputType["EditingPrompt"] = "editing-prompt";
    ImageEditGenInputType["ProductInformation"] = "product-information";
    ImageEditGenInputType["BrandGuidelines"] = "brand-guidelines";
    ImageEditGenInputType["Campaign"] = "campaign";
    ImageEditGenInputType["StyleReferences"] = "style-references";
    ImageEditGenInputType["Mask"] = "mask";
    ImageEditGenInputType["KnowledgeRecord"] = "knowledge-record";
})(ImageEditGenInputType || (ImageEditGenInputType = {}));
export var ImageEditOperationType;
(function (ImageEditOperationType) {
    ImageEditOperationType["ObjectRemoval"] = "object-removal";
    ImageEditOperationType["ObjectAddition"] = "object-addition";
    ImageEditOperationType["ObjectReplacement"] = "object-replacement";
    ImageEditOperationType["ColorEditing"] = "color-editing";
    ImageEditOperationType["LightingEditing"] = "lighting-editing";
    ImageEditOperationType["ShadowEditing"] = "shadow-editing";
    ImageEditOperationType["ReflectionEditing"] = "reflection-editing";
    ImageEditOperationType["BackgroundEditing"] = "background-editing";
    ImageEditOperationType["SkinRetouchPlanning"] = "skin-retouch-planning";
    ImageEditOperationType["ProductCleanup"] = "product-cleanup";
})(ImageEditOperationType || (ImageEditOperationType = {}));
export var ImageEditInpaintingType;
(function (ImageEditInpaintingType) {
    ImageEditInpaintingType["HoleFilling"] = "hole-filling";
    ImageEditInpaintingType["MissingAreaReconstruction"] = "missing-area-reconstruction";
    ImageEditInpaintingType["ObjectReconstruction"] = "object-reconstruction";
    ImageEditInpaintingType["TextureReconstruction"] = "texture-reconstruction";
    ImageEditInpaintingType["PatternReconstruction"] = "pattern-reconstruction";
    ImageEditInpaintingType["DetailRecovery"] = "detail-recovery";
})(ImageEditInpaintingType || (ImageEditInpaintingType = {}));
export var ImageEditOutpaintingType;
(function (ImageEditOutpaintingType) {
    ImageEditOutpaintingType["CanvasExpansion"] = "canvas-expansion";
    ImageEditOutpaintingType["SceneExtension"] = "scene-extension";
    ImageEditOutpaintingType["BackgroundExtension"] = "background-extension";
    ImageEditOutpaintingType["EnvironmentExtension"] = "environment-extension";
    ImageEditOutpaintingType["AspectRatioExpansion"] = "aspect-ratio-expansion";
    ImageEditOutpaintingType["PrintExpansion"] = "print-expansion";
})(ImageEditOutpaintingType || (ImageEditOutpaintingType = {}));
export var ImageEditMaskType;
(function (ImageEditMaskType) {
    ImageEditMaskType["EditableMask"] = "editable-mask";
    ImageEditMaskType["ObjectMask"] = "object-mask";
    ImageEditMaskType["SubjectMask"] = "subject-mask";
    ImageEditMaskType["BackgroundMask"] = "background-mask";
    ImageEditMaskType["LayerMask"] = "layer-mask";
    ImageEditMaskType["ProtectedRegion"] = "protected-region";
})(ImageEditMaskType || (ImageEditMaskType = {}));
export var ImageEditIdentityTarget;
(function (ImageEditIdentityTarget) {
    ImageEditIdentityTarget["HumanIdentity"] = "human-identity";
    ImageEditIdentityTarget["ProductIdentity"] = "product-identity";
    ImageEditIdentityTarget["LogoIntegrity"] = "logo-integrity";
    ImageEditIdentityTarget["PackagingIntegrity"] = "packaging-integrity";
    ImageEditIdentityTarget["BrandColors"] = "brand-colors";
    ImageEditIdentityTarget["BrandElements"] = "brand-elements";
})(ImageEditIdentityTarget || (ImageEditIdentityTarget = {}));
export class ImageEditingEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageEditingEngineError";
    }
}
export const ALL_IMAGE_EDIT_OPERATIONS = [
    ImageEditOperationType.ObjectRemoval,
    ImageEditOperationType.ObjectAddition,
    ImageEditOperationType.ObjectReplacement,
    ImageEditOperationType.ColorEditing,
    ImageEditOperationType.LightingEditing,
    ImageEditOperationType.ShadowEditing,
    ImageEditOperationType.ReflectionEditing,
    ImageEditOperationType.BackgroundEditing,
    ImageEditOperationType.SkinRetouchPlanning,
    ImageEditOperationType.ProductCleanup,
];
export const ALL_IMAGE_EDIT_INPAINTING_TYPES = [
    ImageEditInpaintingType.HoleFilling,
    ImageEditInpaintingType.MissingAreaReconstruction,
    ImageEditInpaintingType.ObjectReconstruction,
    ImageEditInpaintingType.TextureReconstruction,
    ImageEditInpaintingType.PatternReconstruction,
    ImageEditInpaintingType.DetailRecovery,
];
export const ALL_IMAGE_EDIT_OUTPAINTING_TYPES = [
    ImageEditOutpaintingType.CanvasExpansion,
    ImageEditOutpaintingType.SceneExtension,
    ImageEditOutpaintingType.BackgroundExtension,
    ImageEditOutpaintingType.EnvironmentExtension,
    ImageEditOutpaintingType.AspectRatioExpansion,
    ImageEditOutpaintingType.PrintExpansion,
];
export const ALL_IMAGE_EDIT_MASK_TYPES = [
    ImageEditMaskType.EditableMask,
    ImageEditMaskType.ObjectMask,
    ImageEditMaskType.SubjectMask,
    ImageEditMaskType.BackgroundMask,
    ImageEditMaskType.LayerMask,
    ImageEditMaskType.ProtectedRegion,
];
export const ALL_IMAGE_EDIT_IDENTITY_TARGETS = [
    ImageEditIdentityTarget.HumanIdentity,
    ImageEditIdentityTarget.ProductIdentity,
    ImageEditIdentityTarget.LogoIntegrity,
    ImageEditIdentityTarget.PackagingIntegrity,
    ImageEditIdentityTarget.BrandColors,
    ImageEditIdentityTarget.BrandElements,
];
export const ALL_IMAGE_EDIT_GEN_PLATFORMS = [
    ImageEditGenPlatform.Website,
    ImageEditGenPlatform.Mobile,
    ImageEditGenPlatform.Instagram,
    ImageEditGenPlatform.Facebook,
    ImageEditGenPlatform.TikTok,
    ImageEditGenPlatform.LinkedIn,
    ImageEditGenPlatform.Print,
    ImageEditGenPlatform.Billboard,
];
export const IMAGE_EDIT_PLATFORM_CONFIG = {
    [ImageEditGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
    [ImageEditGenPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [ImageEditGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
    [ImageEditGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
    [ImageEditGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [ImageEditGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
    [ImageEditGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [ImageEditGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
//# sourceMappingURL=types.js.map