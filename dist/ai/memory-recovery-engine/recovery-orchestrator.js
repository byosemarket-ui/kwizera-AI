import { RECOVERY_PATH_PREFIXES, resolveRecoveredComponents, resolveRestoreMode, } from "./partial-recovery-handler.js";
import { MemoryRecoveryType, } from "./types.js";
export class RecoveryOrchestrator {
    foundation;
    preValidator;
    safetySnapshot;
    stateComparator;
    postIntegrity;
    autoRecovery;
    history;
    logger;
    constructor(foundation, preValidator, safetySnapshot, stateComparator, postIntegrity, autoRecovery, history, logger) {
        this.foundation = foundation;
        this.preValidator = preValidator;
        this.safetySnapshot = safetySnapshot;
        this.stateComparator = stateComparator;
        this.postIntegrity = postIntegrity;
        this.autoRecovery = autoRecovery;
        this.history = history;
        this.logger = logger;
    }
    async execute(request) {
        const start = Date.now();
        const recoveryId = this.autoRecovery.generateRecoveryId();
        const diagnostics = [];
        let stepsCompleted = 0;
        this.logger.log("info", "request", "Recovery request detected", { recoveryId, request });
        const backupId = this.autoRecovery.resolveBackupId(request);
        if (!backupId) {
            return this.failResult(recoveryId, request, start, diagnostics, "No valid backup found", 1);
        }
        stepsCompleted = 1;
        const preValidation = await this.preValidator.validate(backupId);
        if (!preValidation.valid) {
            diagnostics.push(...preValidation.diagnostics);
            return this.failResult(recoveryId, request, start, diagnostics, "Pre-recovery validation failed", stepsCompleted, preValidation);
        }
        stepsCompleted = 2;
        if (!preValidation.storageAvailable) {
            return this.failResult(recoveryId, request, start, diagnostics, "Storage unavailable", stepsCompleted);
        }
        stepsCompleted = 3;
        const safetySnapshotId = await this.safetySnapshot.create(`pre-recovery-${recoveryId}`);
        stepsCompleted = 4;
        const comparison = this.stateComparator.compare(backupId);
        diagnostics.push(...comparison.differences);
        stepsCompleted = 5;
        const backupEngine = this.foundation.getMemoryBackupEngine();
        let mode = resolveRestoreMode(request.recoveryType);
        let pathPrefixes = request.pathPrefixes ?? RECOVERY_PATH_PREFIXES[request.recoveryType];
        if (request.recoveryType === MemoryRecoveryType.Project && request.projectId) {
            mode = resolveRestoreMode(MemoryRecoveryType.Selective);
            pathPrefixes = [
                "memory/projects",
                `projects/${request.projectId}`,
                "projects",
            ];
        }
        const restoreResult = await backupEngine.restore(backupId, mode, pathPrefixes);
        if (!restoreResult.success) {
            diagnostics.push(...restoreResult.diagnostics);
            return this.failResult(recoveryId, request, start, diagnostics, "Restore failed", stepsCompleted);
        }
        stepsCompleted = 6;
        await this.foundation.getIndexEngine().rebuildIndexes();
        stepsCompleted = 7;
        this.foundation.getRelationshipMemoryEngine().validateIntegrity();
        stepsCompleted = 8;
        const postIntegrityResult = await this.postIntegrity.verify();
        stepsCompleted = 9;
        if (!postIntegrityResult.valid) {
            diagnostics.push(...postIntegrityResult.diagnostics);
            return this.failResult(recoveryId, request, start, diagnostics, "Post-recovery integrity failed", stepsCompleted);
        }
        stepsCompleted = 10;
        const manifest = backupEngine.getVersionHistory().find((m) => m.backupId === backupId);
        const durationMs = Date.now() - start;
        const historyEntry = {
            recoveryId,
            recoveryDate: new Date().toISOString(),
            recoveryType: request.recoveryType,
            source: request.source,
            recoveredComponents: resolveRecoveredComponents(request.recoveryType),
            backupVersion: manifest?.version ?? 0,
            backupId,
            durationMs,
            integrityResult: postIntegrityResult.valid,
            success: true,
            performanceMs: durationMs,
            lessonsLearned: comparison.differences.length > 0
                ? ["State differences reconciled from backup"]
                : ["Clean recovery with no state drift"],
        };
        this.history.append(historyEntry);
        this.logger.log("info", "recovery", "Recovery complete — normal operation resumed", {
            recoveryId,
            stepsCompleted,
            filesRestored: restoreResult.filesRestored,
        });
        return {
            success: true,
            recoveryId,
            request,
            safetySnapshotId,
            filesRestored: restoreResult.filesRestored,
            stepsCompleted,
            preValidation,
            postIntegrity: postIntegrityResult,
            durationMs,
            diagnostics,
        };
    }
    failResult(recoveryId, request, start, diagnostics, reason, stepsCompleted, preValidation) {
        diagnostics.push(reason);
        this.logger.log("error", "recovery", reason, { recoveryId });
        const historyEntry = {
            recoveryId,
            recoveryDate: new Date().toISOString(),
            recoveryType: request.recoveryType,
            source: request.source,
            recoveredComponents: [],
            backupVersion: 0,
            backupId: request.backupId ?? "",
            durationMs: Date.now() - start,
            integrityResult: false,
            success: false,
            performanceMs: Date.now() - start,
            lessonsLearned: [reason],
        };
        this.history.append(historyEntry);
        return {
            success: false,
            recoveryId,
            request,
            filesRestored: 0,
            stepsCompleted,
            preValidation: preValidation ?? {
                valid: false,
                backupIntegrity: false,
                databaseIntegrity: false,
                memoryIntegrity: false,
                relationshipIntegrity: false,
                configurationIntegrity: false,
                storageAvailable: false,
                diagnostics,
            },
            postIntegrity: {
                valid: false,
                memoryConsistency: false,
                relationshipConsistency: false,
                indexIntegrity: false,
                projectIntegrity: false,
                learningIntegrity: false,
                databaseIntegrity: false,
                configurationIntegrity: false,
                diagnostics,
            },
            durationMs: Date.now() - start,
            diagnostics,
        };
    }
}
//# sourceMappingURL=recovery-orchestrator.js.map