import { TimelineIntelligenceLogEntry, TimelineIntelligenceLogLevel } from "./timeline-intelligence-log-types.js";
export declare class TimelineIntelligenceLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: TimelineIntelligenceLogLevel, event: TimelineIntelligenceLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<TimelineIntelligenceLogEntry>;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=timeline-intelligence-logger.d.ts.map