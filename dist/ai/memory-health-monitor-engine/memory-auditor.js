import fs from "node:fs";
export class MemoryAuditor {
    foundation;
    storageRoot;
    logger;
    constructor(foundation, storageRoot, logger) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.logger = logger;
    }
    async runAudit() {
        const start = Date.now();
        const auditId = `audit-${Date.now()}`;
        const storageIntegrity = this.foundation.getStorageEngine().runIntegrityCheck();
        const memoryConsistency = storageIntegrity.verified;
        const relationshipIntegrity = this.foundation.getRelationshipMemoryEngine().validateIntegrity().valid;
        const persistence = this.foundation.getMemoryRoot();
        const storageStructure = fs.existsSync(persistence);
        const indexQuality = this.foundation.getIndexEngine().buildStatusReport().readinessScore >= 75;
        const learningQuality = this.foundation.getLearningMemoryEngine().buildStatusReport().readinessScore >= 75;
        const projectIntegrity = this.foundation.getProjectMemoryEngine().buildStatusReport().readinessScore >= 75;
        const videoIntegrity = this.foundation.getVideoMemoryEngine().buildStatusReport().readinessScore >= 75;
        const marketingIntegrity = this.foundation.getMarketingMemoryEngine().buildStatusReport().readinessScore >= 75;
        const productIntegrity = this.foundation.getProductMemoryEngine().buildStatusReport().readinessScore >= 75;
        const recoveryReadiness = this.foundation.getMemoryRecoveryEngine().buildStatusReport().readinessScore >= 75;
        const backupReport = this.foundation.getMemoryBackupEngine().buildStatusReport();
        const backupIntegrity = backupReport.totalBackups > 0;
        const valid = memoryConsistency &&
            relationshipIntegrity &&
            storageStructure &&
            indexQuality &&
            recoveryReadiness &&
            backupIntegrity;
        this.logger.log("info", "audit", "Memory audit complete", {
            auditId,
            valid,
            durationMs: Date.now() - start,
        });
        return {
            auditId,
            timestamp: new Date().toISOString(),
            memoryConsistency,
            relationshipIntegrity,
            storageStructure,
            indexQuality,
            learningQuality,
            projectIntegrity,
            videoIntegrity,
            marketingIntegrity,
            productIntegrity,
            recoveryReadiness,
            backupIntegrity,
            valid,
            durationMs: Date.now() - start,
        };
    }
}
//# sourceMappingURL=memory-auditor.js.map