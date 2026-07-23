import { ProjectMemoryLogEntry, ProjectMemoryLogLevel } from "./project-log-types.js";
export declare class ProjectMemoryLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ProjectMemoryLogLevel, event: ProjectMemoryLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=project-logger.d.ts.map