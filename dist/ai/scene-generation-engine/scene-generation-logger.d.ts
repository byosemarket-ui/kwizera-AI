import { SceneGenerationLogEntry, SceneGenerationLogLevel } from "./scene-generation-log-types.js";
export declare class SceneGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: SceneGenerationLogLevel, event: SceneGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=scene-generation-logger.d.ts.map