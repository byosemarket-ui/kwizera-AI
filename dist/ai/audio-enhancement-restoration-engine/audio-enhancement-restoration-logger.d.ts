import { AudioEnhancementRestorationLogEntry, AudioEnhancementRestorationLogLevel } from "./audio-enhancement-restoration-log-types.js";
export declare class AudioEnhancementRestorationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AudioEnhancementRestorationLogLevel, event: AudioEnhancementRestorationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audio-enhancement-restoration-logger.d.ts.map