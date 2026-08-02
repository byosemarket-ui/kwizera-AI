export type VideoGenerationMode = "text-to-video" | "image-to-video" | "product-to-video" | "marketing-video" | "social-video" | "product-advertisement" | "brand-promotion";
export interface VideoGenerationRequest {
    projectId?: string;
    prompt: string;
    mode: VideoGenerationMode;
    videoModelId?: string;
    audioModelId?: string;
    imageId?: string;
    durationSeconds: number;
    resolution: "720p" | "1080p";
    frameRate: 24 | 30 | 60;
    voice: "narrator" | "warm" | "energetic";
    music: "uplifting" | "ambient" | "bold" | "none";
    soundEffects: boolean;
    subtitles: boolean;
}
export interface GeneratedVideoPackage {
    id: string;
    projectId?: string;
    name: string;
    mode: VideoGenerationMode;
    prompt: string;
    createdAt: string;
    durationSeconds: number;
    resolution: string;
    frameRate: number;
    videoModelId: string;
    audioModelId: string;
    previewFileName: string;
    audioFileName: string;
    subtitleFileName?: string;
    imageId?: string;
    timeline: Array<{
        scene: number;
        start: number;
        end: number;
        narration: string;
        visual: string;
    }>;
    quality: {
        score: number;
        notes: string[];
    };
    metadata: Record<string, string | number>;
    cached: boolean;
}
export interface VideoGenerationStore {
    packages: GeneratedVideoPackage[];
    history: Array<{
        id: string;
        at: string;
        event: string;
        detail: string;
        packageIds: string[];
    }>;
    cache: Record<string, string>;
    logs: Array<{
        at: string;
        level: "info" | "warning" | "error";
        message: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map