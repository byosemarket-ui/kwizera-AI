import { LanguageAnalysisRecord, LanguageKnowledgeLearningPattern } from "./types.js";
export declare class LanguagePatternStore {
    private storePath;
    private patterns;
    initialize(langDir: string): void;
    add(pattern: LanguageKnowledgeLearningPattern): void;
    getAll(): LanguageKnowledgeLearningPattern[];
    getCount(): number;
}
export declare class LanguageRecordStore {
    private storePath;
    private records;
    initialize(langDir: string): void;
    upsert(record: LanguageAnalysisRecord): void;
    get(languageId: string): LanguageAnalysisRecord | undefined;
    getAll(): LanguageAnalysisRecord[];
    getCount(): number;
}
//# sourceMappingURL=language-stores.d.ts.map