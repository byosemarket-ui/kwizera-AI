import { VideoUnderstandingLogEntry, VideoUnderstandingLogLevel } from "./video-understanding-log-types.js";
export declare class VideoUnderstandingLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: VideoUnderstandingLogLevel, event: VideoUnderstandingLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<VideoUnderstandingLogEntry>;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=video-understanding-logger.d.ts.map