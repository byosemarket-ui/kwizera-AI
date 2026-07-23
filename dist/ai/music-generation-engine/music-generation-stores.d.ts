import { MusicGenerationRecord } from "./types.js";
export declare class MusicGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: MusicGenerationRecord): void;
    get(musicPlanId: string): MusicGenerationRecord | undefined;
    getByProduct(productId: string): MusicGenerationRecord[];
    getByGenre(genre: string): MusicGenerationRecord[];
    getByMood(mood: string): MusicGenerationRecord[];
    getByProject(projectId: string): MusicGenerationRecord[];
    getAll(): MusicGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=music-generation-stores.d.ts.map