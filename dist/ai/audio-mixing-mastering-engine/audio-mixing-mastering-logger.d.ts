import { AudioMixingMasteringLogEntry, AudioMixingMasteringLogLevel } from "./audio-mixing-mastering-log-types.js";
export declare class AudioMixingMasteringLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AudioMixingMasteringLogLevel, event: AudioMixingMasteringLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audio-mixing-mastering-logger.d.ts.map