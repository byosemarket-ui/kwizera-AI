import { ObjectDetectionLogEntry, ObjectDetectionLogLevel } from "./object-detection-log-types.js";
export declare class ObjectDetectionLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ObjectDetectionLogLevel, event: ObjectDetectionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=object-detection-logger.d.ts.map