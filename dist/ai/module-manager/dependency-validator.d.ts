import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ModuleDependencyResult } from "./types.js";
export declare class ModuleDependencyValidator {
    validate(plugin: AiModulePlugin, core: AiCoreManager, declaredDependencies: string[], storageRoot: string): ModuleDependencyResult;
}
//# sourceMappingURL=dependency-validator.d.ts.map