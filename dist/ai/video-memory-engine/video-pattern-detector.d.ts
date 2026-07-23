import { VideoPatternStore } from "./video-pattern-store.js";
import { SceneMemory, VideoPattern, VideoRecord } from "./types.js";
export declare class VideoPatternDetector {
    private readonly patternStore;
    constructor(patternStore: VideoPatternStore);
    detect(video: VideoRecord): VideoPattern[];
    detectFromScenes(scenes: SceneMemory[], videoId: string): VideoPattern[];
    private createPattern;
}
//# sourceMappingURL=video-pattern-detector.d.ts.map