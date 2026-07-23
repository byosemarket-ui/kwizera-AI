import { VideoGenerationFoundationLogEntry, VideoGenerationFoundationLogLevel } from "./video-generation-log-types.js";
export declare class VideoGenerationFoundationLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: VideoGenerationFoundationLogLevel, event: VideoGenerationFoundationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<VideoGenerationFoundationLogEntry>;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=video-generation-logger.d.ts.map