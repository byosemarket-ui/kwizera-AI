export type ModuleStatus = "pass" | "fail" | "unknown" | "not-run" | "blueprint";
export interface ModuleEntry {
    id: string;
    step: string;
    phase: number;
    name: string;
    engine: string;
    aiPath: string | null;
    validateKey: string | null;
    status: ModuleStatus;
    readinessScore: number | null;
    reportFile: string | null;
    lastValidated: string | null;
    kind: "module" | "certification" | "blueprint";
}
export interface PhaseSummary {
    phase: number;
    id: string;
    name: string;
    engine: string;
    description: string;
    maxStep: string;
    modules: ModuleEntry[];
    totalModules: number;
    passedModules: number;
    status: ModuleStatus;
}
export declare function buildRegistry(forceRefresh?: boolean): PhaseSummary[];
export declare function invalidateRegistryCache(): void;
export declare function findModule(validateKey: string): ModuleEntry | undefined;
export declare function listAiModules(): string[];
export declare function getProjectRoot(): string;
//# sourceMappingURL=module-registry.d.ts.map