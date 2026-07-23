import { VideoPattern } from "./types.js";
export declare class VideoPatternStore {
    private patternsPath;
    private readonly patterns;
    initialize(videoDir: string): void;
    store(pattern: VideoPattern): void;
    getAll(): ReadonlyArray<VideoPattern>;
    getByType(type: VideoPattern["patternType"]): VideoPattern[];
    getByVideo(videoId: string): VideoPattern[];
    getReusable(): VideoPattern[];
    getCount(): number;
}
//# sourceMappingURL=video-pattern-store.d.ts.map