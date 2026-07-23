import { CameraDirectorLogEntry, CameraDirectorLogLevel } from "./camera-director-log-types.js";
export declare class CameraDirectorLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: CameraDirectorLogLevel, event: CameraDirectorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=camera-director-logger.d.ts.map