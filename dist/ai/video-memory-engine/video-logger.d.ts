import { VideoMemoryLogEntry, VideoMemoryLogLevel } from "./video-log-types.js";
export declare class VideoMemoryLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoMemoryLogLevel, event: VideoMemoryLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=video-logger.d.ts.map