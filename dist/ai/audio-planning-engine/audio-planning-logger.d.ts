import { AudioPlanningLogEntry, AudioPlanningLogLevel } from "./audio-planning-log-types.js";
export declare class AudioPlanningLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AudioPlanningLogLevel, event: AudioPlanningLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audio-planning-logger.d.ts.map