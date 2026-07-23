import { LogCategory, LogLevel, StructuredLogEntry } from "./types.js";
export interface AiCoreLoggerOptions {
    logDirectory: string;
    minLevel: LogLevel;
    correlationId?: string;
}
export declare class AiCoreLogger {
    private readonly entries;
    private minLevel;
    private logDirectory;
    private logFilePath;
    private correlationId;
    private initialized;
    configure(options: AiCoreLoggerOptions): void;
    isInitialized(): boolean;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
    getEntries(): ReadonlyArray<StructuredLogEntry>;
    log(level: LogLevel, category: LogCategory, message: string, data?: Record<string, unknown>): void;
    debug(category: LogCategory, message: string, data?: Record<string, unknown>): void;
    info(category: LogCategory, message: string, data?: Record<string, unknown>): void;
    warn(category: LogCategory, message: string, data?: Record<string, unknown>): void;
    error(category: LogCategory, message: string, data?: Record<string, unknown>): void;
    flush(): void;
}
//# sourceMappingURL=logger.d.ts.map