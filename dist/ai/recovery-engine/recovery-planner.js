import { randomUUID } from "node:crypto";
import { RecoveryType, RECOVERY_SEQUENCE } from "./types.js";
export class RecoveryPlanner {
    createPlan(failure) {
        const recoveryType = this.mapFailureToRecoveryType(failure);
        const steps = RECOVERY_SEQUENCE.map((action, index) => ({
            step: index + 1,
            action,
            status: "pending",
        }));
        return {
            planId: `plan-${randomUUID().slice(0, 8)}`,
            recoveryType,
            failureReport: failure,
            steps,
            createdAt: new Date().toISOString(),
        };
    }
    mapFailureToRecoveryType(failure) {
        switch (failure.failureType) {
            case "module":
                return RecoveryType.Module;
            case "workflow":
                return RecoveryType.Workflow;
            case "task":
                return RecoveryType.Task;
            case "database":
                return RecoveryType.Database;
            case "storage":
                return RecoveryType.Storage;
            case "communication":
                return RecoveryType.Communication;
            case "configuration":
                return RecoveryType.Configuration;
            case "session":
                return RecoveryType.Session;
            case "unexpected-shutdown":
            case "startup":
            case "shutdown":
            case "application":
            default:
                return RecoveryType.Application;
        }
    }
}
//# sourceMappingURL=recovery-planner.js.map