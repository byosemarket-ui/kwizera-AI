import { VideoStyleLogEntry, VideoStyleLogLevel } from "./video-style-log-types.js";
export declare class VideoStyleLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoStyleLogLevel, event: VideoStyleLogEntry["event"], message: string, data?: Record<string, unknown>): void;
}
//# sourceMappingURL=video-style-logger.d.ts.map