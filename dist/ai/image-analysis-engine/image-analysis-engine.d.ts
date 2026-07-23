import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageAnalysisLogger } from "./image-analysis-logger.js";
import { ImageAnalysisRecordStore } from "./image-analysis-stores.js";
import { ImageAnalysisEngineInput, ImageAnalysisEngineResult, ImageAnalysisEngineStatusReport, ImageAnalysisIntelligenceRecord, ImageAnalysisSearchQuery, ImageFileFormat, ImageAnalysisType, ImageColorSpace, ImageCompressionType } from "./types.js";
/**
 * Image Analysis Engine — collects, organizes and analyzes technical and visual image information
 * before understanding, enhancement or generation begins.
 */
export declare class AiImageAnalysisEngine {
    private foundation;
    private storageRoot;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageAnalysisLogger;
    readonly records: ImageAnalysisRecordStore;
    private readonly analyzer;
    private readonly completeness;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private classificationTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeImage(input: ImageAnalysisEngineInput): Promise<ImageAnalysisEngineResult>;
    getImage(imageId: string): ImageAnalysisIntelligenceRecord | null;
    searchImages(query: ImageAnalysisSearchQuery): ImageAnalysisIntelligenceRecord[];
    detectRelationships(imageId: string): ImageAnalysisIntelligenceRecord["relationships"] | null;
    repairImage(imageId: string): Promise<ImageAnalysisEngineResult | null>;
    buildStatusReport(): ImageAnalysisEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getEngineDir(): string;
    private ensureReady;
}
export { ImageFileFormat, ImageAnalysisType, ImageColorSpace, ImageCompressionType };
//# sourceMappingURL=image-analysis-engine.d.ts.map