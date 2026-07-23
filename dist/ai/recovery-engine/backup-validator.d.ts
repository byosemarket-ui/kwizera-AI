import { RecoveryEngineLogger } from "./recovery-logger.js";
import { BackupValidationResult } from "./types.js";
export declare class BackupValidator {
    private readonly logger;
    constructor(logger: RecoveryEngineLogger);
    validate(storageRoot: string, configLoaded: boolean): BackupValidationResult;
}
//# sourceMappingURL=backup-validator.d.ts.map