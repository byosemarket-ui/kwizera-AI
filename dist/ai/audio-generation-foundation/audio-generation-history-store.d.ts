export interface AudioGenerationHistoryRecord {
    timestamp: string;
    event: string;
    category?: string;
    operation?: string;
    requesterId?: string;
    projectId?: string;
    durationMs?: number;
    success: boolean;
    detail?: string;
}
export declare class AudioGenerationHistoryStore {
    private historyPath;
    private readonly records;
    initialize(generationDirectory: string): void;
    append(record: AudioGenerationHistoryRecord): void;
    getRecords(): ReadonlyArray<AudioGenerationHistoryRecord>;
    getCount(): number;
}
//# sourceMappingURL=audio-generation-history-store.d.ts.map