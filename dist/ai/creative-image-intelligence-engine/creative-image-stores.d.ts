import { CreativeImageIntelligenceRecord } from "./types.js";
export declare class CreativeImageIntelligenceRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: CreativeImageIntelligenceRecord): void;
    get(imageId: string): CreativeImageIntelligenceRecord | undefined;
    getAll(): CreativeImageIntelligenceRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=creative-image-stores.d.ts.map