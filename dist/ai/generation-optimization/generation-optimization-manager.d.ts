import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { ImageGenerationManager } from "../image-generation/image-generation-manager.js";
import type { AiModelManager } from "../model-management/ai-model-manager.js";
import type { VideoAudioGenerationManager } from "../video-audio-generation/video-audio-generation-manager.js";
import type { OptimizationRequest, OptimizationStore, OptimizationTask, OptimizedResult, QualityAnalysis } from "./types.js";
/** Coordinates existing generators, retaining their artifacts while selecting validated results. */
export declare class GenerationOptimizationManager {
    private root;
    private core;
    private models;
    private images;
    private videoAudio;
    private store;
    private running;
    readonly qualityAnalyzer: AiQualityAnalyzer;
    readonly multiModel: MultiModelCoordinator;
    readonly selector: BestResultSelector;
    readonly batch: BatchGenerationManager;
    readonly retryManager: RetryManager;
    readonly recovery: ErrorRecoveryManager;
    readonly performance: PerformanceOptimizer;
    readonly gpu: GpuOptimizationManager;
    readonly memory: MemoryOptimizationManager;
    readonly queue: QueueManager;
    readonly scheduler: ResourceScheduler;
    readonly monitor: GenerationMonitor;
    readonly progress: ProgressTracker;
    readonly analytics: GenerationAnalytics;
    readonly validator: ResultValidator;
    readonly brand: BrandConsistencyValidator;
    readonly safety: SafetyValidator;
    readonly logging: OptimizationLoggingManager;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        models: AiModelManager;
        images: ImageGenerationManager;
        videoAudio: VideoAudioGenerationManager;
    }): Promise<void>;
    isInitialized(): boolean;
    optimize(request: OptimizationRequest): Promise<OptimizationTask>;
    retry(taskId: string): Promise<OptimizationTask>;
    getTask(taskId: string): Promise<OptimizationTask>;
    getDashboard(projectId?: string): Promise<{
        tasks: OptimizationTask[];
        history: OptimizationTask[];
        logs: OptimizationStore["logs"];
        queue: Record<string, number | string>;
        performance: Record<string, number | string>;
        analytics: Record<string, number>;
        integrations: Record<string, boolean>;
    }>;
    run(taskId: string): Promise<OptimizationTask>;
    persist(): Promise<void>;
    log(level: "info" | "warning" | "error", message: string): void;
    getStore(): OptimizationStore;
    getRunningCount(): number;
    getModels(): AiModelManager;
    getImages(): ImageGenerationManager;
    getVideoAudio(): VideoAudioGenerationManager;
    private requireTask;
    private readStore;
    private ensureReady;
}
export declare class AiQualityAnalyzer {
    analyze(result: OptimizedResult, request: OptimizationRequest, brand: BrandConsistencyValidator, safety: SafetyValidator, validator: ResultValidator): QualityAnalysis;
}
export declare class MultiModelCoordinator {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    generate(request: OptimizationRequest): Promise<OptimizedResult[]>;
}
export declare class BestResultSelector {
    select(results: OptimizedResult[]): OptimizedResult | undefined;
}
export declare class BatchGenerationManager {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    submit(requests: OptimizationRequest[]): Promise<OptimizationTask[]>;
}
export declare class RetryManager {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    recordFailure(task: OptimizationTask): void;
    retry(taskId: string): Promise<OptimizationTask>;
}
export declare class ErrorRecoveryManager {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    resumeInterrupted(): Promise<void>;
}
export declare class PerformanceOptimizer {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    recommendations(): string[];
}
export declare class GpuOptimizationManager {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    usage(): number;
}
export declare class MemoryOptimizationManager {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    usageMb(): number;
}
export declare class QueueManager {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    enqueue(request: OptimizationRequest): Promise<OptimizationTask>;
    status(): Record<string, number | string>;
}
export declare class ResourceScheduler {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    yield(): Promise<void>;
}
export declare class GenerationMonitor {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    snapshot(): Record<string, number | string>;
}
export declare class ProgressTracker {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    update(task: OptimizationTask, progress: number, message: string): void;
}
export declare class GenerationAnalytics {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    summary(): Record<string, number>;
}
export declare class ResultValidator {
    validate(result: OptimizedResult): boolean;
}
export declare class BrandConsistencyValidator {
    validate(request: OptimizationRequest, result: OptimizedResult): boolean;
}
export declare class SafetyValidator {
    validate(request: OptimizationRequest): boolean;
}
export declare class OptimizationLoggingManager {
    private readonly manager;
    constructor(manager: GenerationOptimizationManager);
    entries(): OptimizationStore["logs"];
}
//# sourceMappingURL=generation-optimization-manager.d.ts.map