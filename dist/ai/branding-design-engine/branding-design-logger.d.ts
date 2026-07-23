import { BrandingDesignLogEntry, BrandingDesignLogLevel } from "./branding-design-log-types.js";
export declare class BrandingDesignLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: BrandingDesignLogLevel, event: BrandingDesignLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=branding-design-logger.d.ts.map