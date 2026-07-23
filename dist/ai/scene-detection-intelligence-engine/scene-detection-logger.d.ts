import { SceneDetectionLogEntry, SceneDetectionLogLevel } from "./scene-detection-log-types.js";
export declare class SceneDetectionLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: SceneDetectionLogLevel, event: SceneDetectionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<SceneDetectionLogEntry>;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=scene-detection-logger.d.ts.map