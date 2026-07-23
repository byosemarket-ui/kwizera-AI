import { MotionIntelligenceLogEntry, MotionIntelligenceLogLevel } from "./motion-intelligence-log-types.js";
export declare class MotionIntelligenceLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: MotionIntelligenceLogLevel, event: MotionIntelligenceLogEntry["event"], message: string, data?: Record<string, unknown>): void;
}
//# sourceMappingURL=motion-intelligence-logger.d.ts.map