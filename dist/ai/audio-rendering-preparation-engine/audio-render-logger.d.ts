import { AudioRenderLogEntry, AudioRenderLogLevel } from "./audio-render-log-types.js";
export declare class AudioRenderLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AudioRenderLogLevel, event: AudioRenderLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audio-render-logger.d.ts.map