import { ManagedModuleState, ModuleManagerError, } from "./types.js";
let commCounter = 0;
export class ModuleCommunicationRouter {
    getRecord;
    logger;
    records = [];
    isolatedModules = new Set();
    constructor(getRecord, logger) {
        this.getRecord = getRecord;
        this.logger = logger;
    }
    isolate(moduleId) {
        this.isolatedModules.add(moduleId);
    }
    clearIsolation(moduleId) {
        this.isolatedModules.delete(moduleId);
    }
    isIsolated(moduleId) {
        return this.isolatedModules.has(moduleId);
    }
    async route(core, request, handler) {
        const start = Date.now();
        const id = `comm-${++commCounter}-${Date.now()}`;
        const errors = [];
        const warnings = [];
        let success = false;
        let result;
        let message = "Communication completed";
        const sender = this.getRecord(request.senderId);
        const receiver = this.getRecord(request.receiverId);
        if (!sender || !receiver) {
            errors.push("Sender or receiver not registered");
            message = "Communication rejected: unknown module";
        }
        else if (!sender.enabled || !receiver.enabled) {
            errors.push("Module disabled");
            message = "Communication rejected: module disabled";
        }
        else if (this.isIsolated(request.senderId) ||
            this.isIsolated(request.receiverId)) {
            errors.push("Module isolated");
            message = "Communication rejected: module isolated";
        }
        else if (sender.status !== ManagedModuleState.Running &&
            sender.status !== ManagedModuleState.Ready) {
            warnings.push(`Sender status is ${sender.status}`);
        }
        else if (receiver.status !== ManagedModuleState.Running &&
            receiver.status !== ManagedModuleState.Ready) {
            warnings.push(`Receiver status is ${receiver.status}`);
        }
        else {
            try {
                if (handler) {
                    result = await handler(request.payload);
                }
                else {
                    const plugin = core.registry.getPlugin(request.receiverId);
                    if (!plugin) {
                        errors.push(`No plugin handler for ${request.receiverId}`);
                        message = "Communication failed: no handler";
                    }
                    else {
                        const health = await plugin.healthCheck();
                        result = { health, action: request.action, payload: request.payload };
                        success = health.healthy;
                        message = success ? "Health probe succeeded" : "Health probe failed";
                    }
                }
                if (errors.length === 0 && handler) {
                    success = true;
                }
            }
            catch (error) {
                errors.push(error instanceof Error ? error.message : String(error));
                message = "Communication failed with error";
            }
        }
        const record = {
            id,
            sender: request.senderId,
            receiver: request.receiverId,
            request: request.action,
            response: success ? JSON.stringify(result ?? {}) : undefined,
            executionTimeMs: Date.now() - start,
            errors,
            warnings,
            recoveryAttempts: 0,
            timestamp: new Date().toISOString(),
            success,
        };
        this.records.push(record);
        this.logger.log(success ? "info" : "warn", "communication", message, { recordId: id, sender: request.senderId, receiver: request.receiverId });
        if (errors.length) {
            throw new ModuleManagerError(message, "COMMUNICATION_REJECTED");
        }
        return { success, result, message, record };
    }
    getRecords() {
        return this.records;
    }
}
//# sourceMappingURL=communication-router.js.map