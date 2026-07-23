import { VideoAnalysisLogEntry, VideoAnalysisLogLevel } from "./video-analysis-log-types.js";
export declare class VideoAnalysisLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: VideoAnalysisLogLevel, event: VideoAnalysisLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<VideoAnalysisLogEntry>;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=video-analysis-logger.d.ts.map