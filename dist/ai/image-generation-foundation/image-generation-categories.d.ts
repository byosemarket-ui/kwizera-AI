import { ImageGenerationAccessPermission, ImageGenerationCategory, ImageGenerationModuleStatus, ImageGenerationSource, ImageGenerationAssetType, ImageGenerationBlueprintStage } from "./types.js";
export interface PreparedImageGenerationModule {
    category: ImageGenerationCategory;
    moduleId: string;
    moduleName: string;
    subdirectory: string;
    dependencies: string[];
    defaultSource: ImageGenerationSource;
    accessPermissions: ImageGenerationAccessPermission[];
}
export declare const DEFAULT_MODULE_STATUS = ImageGenerationModuleStatus.Prepared;
/** Foundation slots for future AI Image Generation modules — prepared, not implemented */
export declare const PREPARED_IMAGE_GENERATION_MODULES: PreparedImageGenerationModule[];
export declare const SUPPORTED_IMAGE_GENERATION_ASSET_TYPES: ImageGenerationAssetType[];
export declare const IMAGE_GENERATION_BLUEPRINT_STAGES: ImageGenerationBlueprintStage[];
export declare const SUPPORTED_IMAGE_GENERATION_SOURCES: ImageGenerationSource[];
//# sourceMappingURL=image-generation-categories.d.ts.map