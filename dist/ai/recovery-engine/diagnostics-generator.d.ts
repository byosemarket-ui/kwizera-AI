import { RecoveryEngineLogger } from "./recovery-logger.js";
import { FailureReport } from "./types.js";
export declare class DiagnosticsGenerator {
    private readonly logger;
    private diagnosticsDirectory;
    constructor(logger: RecoveryEngineLogger);
    initialize(recoveryDirectory: string): void;
    save(failure: FailureReport, extra?: Record<string, unknown>): string;
    getDiagnosticsDirectory(): string | null;
}
//# sourceMappingURL=diagnostics-generator.d.ts.map