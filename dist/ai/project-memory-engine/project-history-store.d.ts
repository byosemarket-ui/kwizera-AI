export interface ProjectHistoryEvent {
    timestamp: string;
    event: "create" | "update" | "version" | "checkpoint" | "restore" | "archive" | "export";
    projectId: string;
    detail: string;
    version?: number;
    status?: string;
}
export declare class ProjectHistoryStore {
    private historyPath;
    private readonly events;
    initialize(projectDir: string): void;
    append(event: ProjectHistoryEvent): void;
    getAll(): ReadonlyArray<ProjectHistoryEvent>;
    getByProject(projectId: string): ProjectHistoryEvent[];
    getCount(): number;
}
//# sourceMappingURL=project-history-store.d.ts.map