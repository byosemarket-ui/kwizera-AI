import { CameraMovementLogEntry, CameraMovementLogLevel } from "./camera-movement-log-types.js";
export declare class CameraMovementLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: CameraMovementLogLevel, event: CameraMovementLogEntry["event"], message: string, data?: Record<string, unknown>): void;
}
//# sourceMappingURL=camera-movement-logger.d.ts.map