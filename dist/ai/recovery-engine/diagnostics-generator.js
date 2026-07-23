import fs from "node:fs";
import path from "node:path";
export class DiagnosticsGenerator {
    logger;
    diagnosticsDirectory = null;
    constructor(logger) {
        this.logger = logger;
    }
    initialize(recoveryDirectory) {
        this.diagnosticsDirectory = path.join(recoveryDirectory, "diagnostics");
        fs.mkdirSync(this.diagnosticsDirectory, { recursive: true });
    }
    save(failure, extra) {
        if (!this.diagnosticsDirectory) {
            throw new Error("Diagnostics not initialized");
        }
        const diagnostic = {
            failureId: failure.failureId,
            failureType: failure.failureType,
            affectedComponent: failure.affectedComponent,
            rootCause: failure.rootCause,
            timestamp: failure.timestamp,
            severity: failure.severity,
            diagnostics: { ...failure.diagnostics, ...extra },
        };
        const filePath = path.join(this.diagnosticsDirectory, `${failure.failureId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(diagnostic, null, 2), "utf8");
        this.logger.log("info", "diagnostics", `Diagnostics saved: ${failure.failureId}`, {
            filePath,
        });
        return filePath;
    }
    getDiagnosticsDirectory() {
        return this.diagnosticsDirectory;
    }
}
//# sourceMappingURL=diagnostics-generator.js.map