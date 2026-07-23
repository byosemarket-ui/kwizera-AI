import { CreativeAnalysisRecord, CreativeKnowledgeLearningPattern } from "./types.js";
export declare class CreativePatternStore {
    private storePath;
    private patterns;
    initialize(creativeDir: string): void;
    add(pattern: CreativeKnowledgeLearningPattern): void;
    getAll(): CreativeKnowledgeLearningPattern[];
    getCount(): number;
}
export declare class CreativeRecordStore {
    private storePath;
    private records;
    initialize(creativeDir: string): void;
    upsert(record: CreativeAnalysisRecord): void;
    get(creativeId: string): CreativeAnalysisRecord | undefined;
    getAll(): CreativeAnalysisRecord[];
    getCount(): number;
}
//# sourceMappingURL=creative-stores.d.ts.map