import { VideoAnalysisEngineInput, VideoTechnicalProfile } from "./types.js";
export declare class VideoAnalysisCompletenessDetector {
    detect(input: VideoAnalysisEngineInput, technical: VideoTechnicalProfile): string[];
    isCriticallyIncomplete(missing: string[]): boolean;
}
//# sourceMappingURL=video-analysis-completeness.d.ts.map