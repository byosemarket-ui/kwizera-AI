import { ImageAnalysisRecord, ImageLearningPattern } from "./types.js";
export declare class ImagePatternStore {
    private storePath;
    private patterns;
    initialize(imageDir: string): void;
    add(pattern: ImageLearningPattern): void;
    getAll(): ImageLearningPattern[];
    getCount(): number;
    private persist;
}
export declare class ImageRecordStore {
    private storePath;
    private records;
    initialize(imageDir: string): void;
    upsert(record: ImageAnalysisRecord): void;
    get(imageId: string): ImageAnalysisRecord | undefined;
    getAll(): ImageAnalysisRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=image-stores.d.ts.map