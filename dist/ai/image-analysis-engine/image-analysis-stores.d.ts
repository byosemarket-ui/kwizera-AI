import { ImageAnalysisIntelligenceRecord } from "./types.js";
export declare class ImageAnalysisRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageAnalysisIntelligenceRecord): void;
    get(imageId: string): ImageAnalysisIntelligenceRecord | undefined;
    getAll(): ImageAnalysisIntelligenceRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=image-analysis-stores.d.ts.map