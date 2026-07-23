import { SpeechToSpeechGenerationRecord } from "./types.js";
export declare class SpeechToSpeechGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: SpeechToSpeechGenerationRecord): void;
    get(transformationId: string): SpeechToSpeechGenerationRecord | undefined;
    getBySourceAudio(sourceAudioId: string): SpeechToSpeechGenerationRecord[];
    getByProduct(productId: string): SpeechToSpeechGenerationRecord[];
    getByProject(projectId: string): SpeechToSpeechGenerationRecord[];
    getByLanguage(language: string): SpeechToSpeechGenerationRecord[];
    getAll(): SpeechToSpeechGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=speech-to-speech-generation-stores.d.ts.map