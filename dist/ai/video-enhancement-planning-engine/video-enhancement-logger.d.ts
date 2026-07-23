import { VideoEnhancementLogEntry, VideoEnhancementLogLevel } from "./video-enhancement-log-types.js";
export declare class VideoEnhancementLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoEnhancementLogLevel, event: VideoEnhancementLogEntry["event"], message: string, data?: Record<string, unknown>): void;
}
//# sourceMappingURL=video-enhancement-logger.d.ts.map