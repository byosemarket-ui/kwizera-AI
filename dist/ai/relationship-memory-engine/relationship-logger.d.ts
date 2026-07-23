import { RelationshipMemoryLogEntry, RelationshipMemoryLogLevel } from "./relationship-log-types.js";
export declare class RelationshipMemoryLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: RelationshipMemoryLogLevel, event: RelationshipMemoryLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=relationship-logger.d.ts.map