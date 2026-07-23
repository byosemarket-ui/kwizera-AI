import fs from "node:fs";
import path from "node:path";
export class BackupValidator {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    validate(storageRoot, configLoaded) {
        const checks = [];
        const statePath = path.join(storageRoot, "state", "current-state.json");
        const latestBackup = fs.existsSync(statePath);
        checks.push({
            name: "latest-backup",
            passed: latestBackup,
            message: latestBackup ? "Latest state snapshot found" : "No state snapshot",
        });
        const projectDir = path.join(storageRoot, "projects");
        const projectIntegrity = !fs.existsSync(projectDir) || fs.statSync(projectDir).isDirectory();
        checks.push({
            name: "project-integrity",
            passed: projectIntegrity,
            message: projectIntegrity ? "Project storage accessible" : "Project storage corrupted",
        });
        checks.push({
            name: "database-integrity",
            passed: true,
            message: "Database check deferred (local-first, file-based storage)",
        });
        checks.push({
            name: "configuration-integrity",
            passed: configLoaded,
            message: configLoaded ? "Configuration loaded" : "Configuration missing",
        });
        const storageOk = fs.existsSync(storageRoot) && fs.statSync(storageRoot).isDirectory();
        checks.push({
            name: "storage-integrity",
            passed: storageOk,
            message: storageOk ? `Storage root ${storageRoot} valid` : "Storage root invalid",
        });
        const logsDir = path.join(storageRoot, "logs");
        checks.push({
            name: "logs-accessible",
            passed: !fs.existsSync(logsDir) || fs.statSync(logsDir).isDirectory(),
            message: "Logs directory accessible",
        });
        const failed = checks.filter((c) => !c.passed);
        const result = {
            valid: failed.length === 0,
            checks,
            rejectionReason: failed.length ? failed.map((f) => f.message).join("; ") : undefined,
        };
        this.logger.log(result.valid ? "info" : "warn", "diagnostics", `Backup validation: ${result.valid ? "passed" : "failed"}`, { checks: result.checks });
        return result;
    }
}
//# sourceMappingURL=backup-validator.js.map