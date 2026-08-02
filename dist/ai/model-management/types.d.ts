export type AiModelCategory = "image" | "video" | "audio" | "voice" | "language" | "vision" | "embedding" | "future";
export type ModelStatus = "available" | "installed" | "loaded" | "unhealthy" | "updating" | "removed";
export interface ModelResourceRequirements {
    ramMb: number;
    vramMb?: number;
    storageMb: number;
    cpuCores?: number;
}
export interface AiModel {
    id: string;
    name: string;
    category: AiModelCategory;
    version: string;
    description: string;
    status: ModelStatus;
    sourcePath?: string;
    artifactPath?: string;
    checksum?: string;
    installedAt?: string;
    loadedAt?: string;
    lastValidatedAt?: string;
    health: "healthy" | "warning" | "unhealthy";
    requirements: ModelResourceRequirements;
    capabilities: string[];
    usageCount: number;
    lastUsedAt?: string;
}
export interface HardwareSnapshot {
    detectedAt: string;
    gpu: {
        available: boolean;
        name: string;
        memoryMb?: number;
        driver?: string;
    };
    cpu: {
        model: string;
        cores: number;
        load: number;
    };
    ram: {
        totalMb: number;
        freeMb: number;
        usedMb: number;
    };
    storage: {
        totalMb: number;
        freeMb: number;
        usedMb: number;
    };
}
export interface ModelSettings {
    autoUnloadMinutes: number;
    cacheLimit: number;
    preferGpu: boolean;
    validateOnLoad: boolean;
    allowExternalArtifacts: boolean;
}
export interface ModelLog {
    at: string;
    level: "info" | "warning" | "error";
    event: string;
    detail: string;
    modelId?: string;
}
export interface ModelStore {
    models: AiModel[];
    settings: ModelSettings;
    logs: ModelLog[];
}
//# sourceMappingURL=types.d.ts.map