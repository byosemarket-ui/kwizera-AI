import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { ImageKnowledgeLogger } from "./image-logger.js";
import { ImagePatternStore, ImageRecordStore } from "./image-stores.js";
import { ImageAnalysisInput, ImageAnalysisRecord, ImageAnalysisResult, ImageKnowledgeStatusReport, ImageLearningPattern, ImageSearchQuery, VisualRecommendation } from "./types.js";
/**
 * Image Knowledge Engine — understands, analyzes and learns from visual knowledge.
 */
export declare class AiImageKnowledgeEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: ImageKnowledgeLogger;
    readonly patterns: ImagePatternStore;
    readonly records: ImageRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private processor;
    private learner;
    private analysisTimes;
    private searchTimes;
    private recommendationTimes;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeImage(input: ImageAnalysisInput): Promise<ImageAnalysisResult>;
    getImage(imageId: string): ImageAnalysisRecord | null;
    searchImages(query: ImageSearchQuery): Promise<ImageAnalysisRecord[]>;
    getRecommendations(imageId: string): VisualRecommendation[];
    detectRelationships(imageId: string): import("./types.js").ImageRelationships | null;
    getLearnedPatterns(): ImageLearningPattern[];
    buildStatusReport(): ImageKnowledgeStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-knowledge-engine.d.ts.map