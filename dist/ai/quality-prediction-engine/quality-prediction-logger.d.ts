import { QualityPredictionLogEntry, QualityPredictionLogLevel } from "./quality-prediction-log-types.js";
export declare class QualityPredictionLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: QualityPredictionLogLevel, event: QualityPredictionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=quality-prediction-logger.d.ts.map