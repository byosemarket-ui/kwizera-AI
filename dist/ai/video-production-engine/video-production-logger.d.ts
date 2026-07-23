import { VideoProductionLogEntry, VideoProductionLogLevel } from "./video-production-log-types.js";
export declare class VideoProductionLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoProductionLogLevel, event: VideoProductionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=video-production-logger.d.ts.map