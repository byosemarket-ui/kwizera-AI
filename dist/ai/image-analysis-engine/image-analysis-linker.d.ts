import { ImageAnalysisIntelligenceRecord, ImageAnalysisRelationships, ImageClassification } from "./types.js";
export declare class ImageAnalysisLinker {
    detectRelationships(record: ImageAnalysisIntelligenceRecord, allRecords: ImageAnalysisIntelligenceRecord[], knowledgeIds?: string[], memoryRefs?: string[]): ImageAnalysisRelationships;
    classifySimilarity(a: ImageClassification, b: ImageClassification): number;
}
//# sourceMappingURL=image-analysis-linker.d.ts.map