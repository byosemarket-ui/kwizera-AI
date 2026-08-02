export type ImageGenerationMode = "text-to-image" | "product-to-image" | "photo-enhancement" | "background-replacement" | "background-generation" | "marketing-banner" | "social-post" | "product-advertisement" | "brand-poster";
export type ImageStyle = "studio" | "luxury" | "editorial" | "minimal" | "bold" | "lifestyle";
export interface ImageGenerationRequest {
    projectId?: string;
    prompt: string;
    mode: ImageGenerationMode;
    modelId?: string;
    style: ImageStyle;
    aspectRatio: "1:1" | "4:5" | "16:9" | "9:16";
    resolution: "standard" | "high";
    count: number;
    productImageId?: string;
}
export interface GeneratedImage {
    id: string;
    projectId?: string;
    name: string;
    fileName: string;
    mimeType: "image/svg+xml";
    mode: ImageGenerationMode;
    modelId: string;
    prompt: string;
    style: ImageStyle;
    aspectRatio: string;
    resolution: string;
    createdAt: string;
    sourceImageUrl?: string;
    quality: {
        score: number;
        notes: string[];
    };
    metadata: Record<string, string | number>;
    cached: boolean;
}
export interface ImageGenerationStore {
    images: GeneratedImage[];
    history: Array<{
        id: string;
        at: string;
        event: string;
        detail: string;
        imageIds: string[];
    }>;
    cache: Record<string, string[]>;
    logs: Array<{
        at: string;
        level: "info" | "warning" | "error";
        message: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map