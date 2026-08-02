import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageGenerationManager } from "../image-generation/image-generation-manager.js";
import type { AiModelManager } from "../model-management/ai-model-manager.js";
import type { GeneratedVideoPackage, VideoGenerationRequest, VideoGenerationStore } from "./types.js";
/** Produces a durable marketing-video package. The preview encoder can be replaced by an MP4/WebM provider later. */
export declare class VideoAudioGenerationManager {
    private root;
    private core;
    private models;
    private workspace;
    private planning;
    private images;
    private store;
    readonly videoGenerator: AiVideoGenerator;
    readonly videoModelSelector: VideoModelSelector;
    readonly videoModelExecutor: VideoModelExecutor;
    readonly imageToVideo: ImageToVideoEngine;
    readonly textToVideo: TextToVideoEngine;
    readonly productToVideo: ProductToVideoEngine;
    readonly sceneAnimation: SceneAnimationEngine;
    readonly cameraMotion: CameraMotionEngine;
    readonly transition: TransitionEngine;
    readonly timeline: TimelineManager;
    readonly audio: AudioGenerationManager;
    readonly voice: AiVoiceGenerator;
    readonly music: BackgroundMusicManager;
    readonly effects: SoundEffectsManager;
    readonly subtitles: SubtitleGenerator;
    readonly synchronization: AudioSynchronizationManager;
    readonly quality: VideoQualityManager;
    readonly metadata: VideoMetadataManager;
    readonly history: VideoHistoryManager;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        models: AiModelManager;
        workspace: CreativeWorkspaceManager;
        planning: CreativePlanningManager;
        images: ImageGenerationManager;
    }): Promise<void>;
    isInitialized(): boolean;
    generate(request: VideoGenerationRequest): Promise<GeneratedVideoPackage>;
    getDashboard(projectId?: string): Promise<{
        packages: GeneratedVideoPackage[];
        history: VideoGenerationStore["history"];
        logs: VideoGenerationStore["logs"];
        models: ReturnType<AiModelManager["list"]>;
        images: Awaited<ReturnType<ImageGenerationManager["getDashboard"]>>["images"];
        integrations: Record<string, boolean>;
        statistics: Record<string, number>;
    }>;
    defaultRequest(projectId: string): Promise<Partial<VideoGenerationRequest>>;
    getAssetPath(packageId: string, kind: "preview" | "audio" | "subtitles"): Promise<string | null>;
    private createPackage;
    log(level: "info" | "warning" | "error", message: string): void;
    persist(): Promise<void>;
    private validate;
    private readStore;
    private ensureReady;
}
export declare class VideoModelSelector {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    select(requested?: string): Promise<import("../model-management/types.js").AiModel>;
}
export declare class VideoModelExecutor {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    load(id: string): Promise<void>;
}
export declare class AiVideoGenerator {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    compose(input: {
        request: VideoGenerationRequest;
        timeline: GeneratedVideoPackage["timeline"];
        brand: string;
        imageUrl?: string;
    }): string;
}
export declare class ImageToVideoEngine {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class TextToVideoEngine {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class ProductToVideoEngine {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class SceneAnimationEngine {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class CameraMotionEngine {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class TransitionEngine {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class TimelineManager {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    build(scenes: Array<{
        durationSeconds: number;
        narration: string;
        visual: string;
    }>, duration: number, fallbackName: string, prompt: string): GeneratedVideoPackage["timeline"];
}
export declare class AudioGenerationManager {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    selectModel(requested?: string): Promise<import("../model-management/types.js").AiModel>;
    load(id: string): Promise<void>;
    synthesize(request: VideoGenerationRequest, timeline: GeneratedVideoPackage["timeline"]): Buffer;
}
export declare class AiVoiceGenerator {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class BackgroundMusicManager {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class SoundEffectsManager {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class SubtitleGenerator {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    create(timeline: GeneratedVideoPackage["timeline"]): string;
}
export declare class AudioSynchronizationManager {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
}
export declare class VideoQualityManager {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    score(request: VideoGenerationRequest, hasImage: boolean): {
        score: number;
        notes: string[];
    };
}
export declare class VideoMetadataManager {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    create(request: VideoGenerationRequest, sceneCount: number): Record<string, string | number>;
}
export declare class VideoHistoryManager {
    private readonly manager;
    constructor(manager: VideoAudioGenerationManager);
    record(event: string, detail: string, packageIds: string[]): void;
}
//# sourceMappingURL=video-audio-generation-manager.d.ts.map