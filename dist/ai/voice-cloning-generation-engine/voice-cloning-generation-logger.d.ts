import { VoiceCloningGenerationLogEntry, VoiceCloningGenerationLogLevel } from "./voice-cloning-generation-log-types.js";
export declare class VoiceCloningGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VoiceCloningGenerationLogLevel, event: VoiceCloningGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=voice-cloning-generation-logger.d.ts.map