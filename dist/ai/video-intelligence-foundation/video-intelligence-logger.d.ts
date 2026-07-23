import { VideoIntelligenceFoundationLogEntry, VideoIntelligenceFoundationLogLevel } from "./video-intelligence-log-types.js";
export declare class VideoIntelligenceFoundationLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: VideoIntelligenceFoundationLogLevel, event: VideoIntelligenceFoundationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<VideoIntelligenceFoundationLogEntry>;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=video-intelligence-logger.d.ts.map