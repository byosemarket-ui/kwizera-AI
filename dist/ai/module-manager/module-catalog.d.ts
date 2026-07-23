import { ModuleCapabilities, ModuleRegistryRecord } from "./types.js";
export interface FrameworkModuleDefinition {
    moduleId: string;
    moduleName: string;
    slotId?: string;
    dependencies: string[];
    capabilities: ModuleCapabilities;
    owner: string;
    compatibility: string;
}
/** Framework catalog — management only, implementations deferred */
export declare const FRAMEWORK_MODULE_CATALOG: FrameworkModuleDefinition[];
export declare function getCatalogEntry(moduleId: string): FrameworkModuleDefinition | undefined;
export declare function createFrameworkRecord(def: FrameworkModuleDefinition): ModuleRegistryRecord;
//# sourceMappingURL=module-catalog.d.ts.map