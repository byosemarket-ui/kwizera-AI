import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, VideoIntelligenceSource } from "./types.js";
export interface PreparedVideoIntelligenceModule {
    category: VideoIntelligenceCategory;
    moduleId: string;
    moduleName: string;
    subdirectory: string;
    dependencies: string[];
    defaultSource: VideoIntelligenceSource;
    accessPermissions: VideoIntelligenceAccessPermission[];
}
export declare const DEFAULT_MODULE_STATUS = VideoIntelligenceModuleStatus.Prepared;
/** Foundation slots for future Video Intelligence modules — prepared, not implemented */
export declare const PREPARED_VIDEO_INTELLIGENCE_MODULES: PreparedVideoIntelligenceModule[];
export declare const SUPPORTED_VIDEO_INTELLIGENCE_SOURCES: VideoIntelligenceSource[];
export declare const SUPPORTED_VIDEO_ASSET_TYPES: readonly ["original-video", "proxy-video", "rendered-video", "audio-track", "voice-track", "music", "sound-effect", "subtitle", "caption", "transition", "effect", "lut", "motion-graphic", "overlay", "logo", "template", "export-profile"];
export declare const SUPPORTED_VIDEO_INDEX_TYPES: readonly ["frame", "keyframe", "scene", "timeline", "shot", "sequence"];
//# sourceMappingURL=video-intelligence-categories.d.ts.map