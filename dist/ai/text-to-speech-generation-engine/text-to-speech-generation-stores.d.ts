import { TextToSpeechGenerationRecord } from "./types.js";
export declare class TextToSpeechGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: TextToSpeechGenerationRecord): void;
    get(speechPlanId: string): TextToSpeechGenerationRecord | undefined;
    getByProduct(productId: string): TextToSpeechGenerationRecord[];
    getByProject(projectId: string): TextToSpeechGenerationRecord[];
    getByLanguage(language: string): TextToSpeechGenerationRecord[];
    getAll(): TextToSpeechGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=text-to-speech-generation-stores.d.ts.map