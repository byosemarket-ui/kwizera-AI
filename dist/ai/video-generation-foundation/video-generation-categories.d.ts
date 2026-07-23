import { VideoGenerationAccessPermission, VideoGenerationCategory, VideoGenerationModuleStatus, VideoGenerationSource, GenerationAssetType, GenerationBlueprintStage } from "./types.js";
export interface PreparedVideoGenerationModule {
    category: VideoGenerationCategory;
    moduleId: string;
    moduleName: string;
    subdirectory: string;
    dependencies: string[];
    defaultSource: VideoGenerationSource;
    accessPermissions: VideoGenerationAccessPermission[];
}
export declare const DEFAULT_MODULE_STATUS = VideoGenerationModuleStatus.Prepared;
/** Foundation slots for future AI Video Generation modules — prepared, not implemented */
export declare const PREPARED_VIDEO_GENERATION_MODULES: PreparedVideoGenerationModule[];
export declare const SUPPORTED_GENERATION_ASSET_TYPES: GenerationAssetType[];
export declare const GENERATION_BLUEPRINT_STAGES: GenerationBlueprintStage[];
export declare const SUPPORTED_VIDEO_GENERATION_SOURCES: VideoGenerationSource[];
//# sourceMappingURL=video-generation-categories.d.ts.map