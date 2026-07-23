import { AudioGenerationAccessPermission, AudioGenerationCategory, AudioGenerationModuleStatus, AudioGenerationSource, AudioGenerationAssetType, AudioGenerationBlueprintStage } from "./types.js";
export interface PreparedAudioGenerationModule {
    category: AudioGenerationCategory;
    moduleId: string;
    moduleName: string;
    subdirectory: string;
    dependencies: string[];
    defaultSource: AudioGenerationSource;
    accessPermissions: AudioGenerationAccessPermission[];
}
export declare const DEFAULT_MODULE_STATUS = AudioGenerationModuleStatus.Prepared;
/** Foundation slots for future AI Audio Generation modules — prepared, not implemented */
export declare const PREPARED_AUDIO_GENERATION_MODULES: PreparedAudioGenerationModule[];
export declare const SUPPORTED_AUDIO_GENERATION_ASSET_TYPES: AudioGenerationAssetType[];
export declare const AUDIO_GENERATION_BLUEPRINT_STAGES: AudioGenerationBlueprintStage[];
export declare const SUPPORTED_AUDIO_GENERATION_SOURCES: AudioGenerationSource[];
//# sourceMappingURL=audio-generation-categories.d.ts.map