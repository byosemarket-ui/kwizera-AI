import { AudioKnowledge, CameraKnowledge, EditingKnowledge, MarketingKnowledge, VideoAnalysisInput, VideoStructureKnowledge, VideoType, VisualProductionKnowledge } from "./types.js";
export declare class VideoAnalyzer {
    analyze(input: VideoAnalysisInput): {
        structure: VideoStructureKnowledge;
        camera: CameraKnowledge;
        editing: EditingKnowledge;
        audio: AudioKnowledge;
        marketing: MarketingKnowledge;
        visual: VisualProductionKnowledge;
        videoType: VideoType;
    };
    private buildScenes;
}
//# sourceMappingURL=video-analyzer.d.ts.map