import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoStyleAnalyzer } from "./video-style-analyzer.js";
import { VideoStyleLinker } from "./video-style-linker.js";
import { VideoStyleLogger } from "./video-style-logger.js";
import { VideoStyleScorer } from "./video-style-scorer.js";
import { VideoStyleRecordStore } from "./video-style-stores.js";
import { CinematicStyleClass, StyleTemplatePlatform, VideoStyleIntelligenceInput, VideoStyleIntelligenceRecord, VideoStyleIntelligenceResult, VideoStyleSearchQuery } from "./types.js";
export declare class VideoStyleProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    private readonly templateLibrary;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: VideoStyleAnalyzer, scorer: VideoStyleScorer, linker: VideoStyleLinker, records: VideoStyleRecordStore, logger: VideoStyleLogger);
    analyze(input: VideoStyleIntelligenceInput): Promise<VideoStyleIntelligenceResult>;
    search(query: VideoStyleSearchQuery): VideoStyleIntelligenceRecord[];
    getTemplateCount(): number;
    private reject;
}
export { CinematicStyleClass, StyleTemplatePlatform };
//# sourceMappingURL=video-style-processor.d.ts.map