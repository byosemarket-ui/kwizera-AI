import { ImageIntelligenceAccessPermission, ImageIntelligenceCategory, ImageIntelligenceModuleStatus, ImageIntelligenceSource } from "./types.js";
export interface PreparedImageIntelligenceModule {
    category: ImageIntelligenceCategory;
    moduleId: string;
    moduleName: string;
    subdirectory: string;
    dependencies: string[];
    defaultSource: ImageIntelligenceSource;
    accessPermissions: ImageIntelligenceAccessPermission[];
}
export declare const DEFAULT_MODULE_STATUS = ImageIntelligenceModuleStatus.Prepared;
/** Foundation slots for future Image Intelligence modules — prepared, not implemented */
export declare const PREPARED_IMAGE_INTELLIGENCE_MODULES: PreparedImageIntelligenceModule[];
export declare const SUPPORTED_IMAGE_INTELLIGENCE_SOURCES: ImageIntelligenceSource[];
//# sourceMappingURL=image-intelligence-categories.d.ts.map