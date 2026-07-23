import { VoiceCloningGenerationRecord } from "./types.js";
export declare class VoiceCloningGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VoiceCloningGenerationRecord): void;
    get(cloningPlanId: string): VoiceCloningGenerationRecord | undefined;
    getByVoiceSample(voiceSampleId: string): VoiceCloningGenerationRecord[];
    getBySpeaker(speakerId: string): VoiceCloningGenerationRecord[];
    getByProduct(productId: string): VoiceCloningGenerationRecord[];
    getByProject(projectId: string): VoiceCloningGenerationRecord[];
    getByLanguage(language: string): VoiceCloningGenerationRecord[];
    getAll(): VoiceCloningGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=voice-cloning-generation-stores.d.ts.map