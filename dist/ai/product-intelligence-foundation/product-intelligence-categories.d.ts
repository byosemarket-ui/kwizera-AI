import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, ProductIntelligenceSource } from "./types.js";
export interface PreparedProductIntelligenceModule {
    category: ProductIntelligenceCategory;
    moduleId: string;
    moduleName: string;
    subdirectory: string;
    dependencies: string[];
    defaultSource: ProductIntelligenceSource;
    accessPermissions: ProductIntelligenceAccessPermission[];
}
export declare const DEFAULT_MODULE_STATUS = ProductIntelligenceModuleStatus.Prepared;
/** Foundation slots for future Product Intelligence modules — prepared, not implemented */
export declare const PREPARED_PRODUCT_INTELLIGENCE_MODULES: PreparedProductIntelligenceModule[];
export declare const SUPPORTED_PRODUCT_INTELLIGENCE_SOURCES: ProductIntelligenceSource[];
//# sourceMappingURL=product-intelligence-categories.d.ts.map