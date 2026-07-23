import type { AiModulePlugin } from "../core/types.js";
export interface CompatibilityResult {
    compatible: boolean;
    message: string;
}
export declare class ModuleCompatibilityChecker {
    verify(plugin: AiModulePlugin): CompatibilityResult;
}
//# sourceMappingURL=compatibility-checker.d.ts.map