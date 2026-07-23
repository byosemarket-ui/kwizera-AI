import { VideoKnowledgeLogEntry, VideoKnowledgeLogLevel } from "./video-log-types.js";
export declare class VideoKnowledgeLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoKnowledgeLogLevel, event: VideoKnowledgeLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=video-logger.d.ts.map