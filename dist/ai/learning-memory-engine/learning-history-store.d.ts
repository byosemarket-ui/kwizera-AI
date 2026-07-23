import { LearningRecord } from "./types.js";
export declare class LearningHistoryStore {
    private historyPath;
    private readonly records;
    initialize(learningDir: string): void;
    append(record: LearningRecord): void;
    getAll(): ReadonlyArray<LearningRecord>;
    getCount(): number;
    findById(learningId: string): LearningRecord | undefined;
    getByProject(projectId: string): LearningRecord[];
    getHistoryPath(): string | null;
}
//# sourceMappingURL=learning-history-store.d.ts.map