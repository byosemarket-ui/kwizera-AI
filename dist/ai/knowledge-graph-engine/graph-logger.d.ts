import { KnowledgeGraphLogEntry, KnowledgeGraphLogLevel } from "./graph-log-types.js";
export declare class KnowledgeGraphLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: KnowledgeGraphLogLevel, event: KnowledgeGraphLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<KnowledgeGraphLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=graph-logger.d.ts.map