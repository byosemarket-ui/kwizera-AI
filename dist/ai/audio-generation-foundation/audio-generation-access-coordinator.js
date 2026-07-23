import { AudioGenerationAccessOperation, AudioGenerationAccessPermission, AudioGenerationFoundationError, } from "./types.js";
import { PREPARED_AUDIO_GENERATION_MODULES } from "./audio-generation-categories.js";
const OPERATION_PERMISSION_MAP = {
    [AudioGenerationAccessOperation.Read]: AudioGenerationAccessPermission.Read,
    [AudioGenerationAccessOperation.Write]: AudioGenerationAccessPermission.Write,
    [AudioGenerationAccessOperation.Update]: AudioGenerationAccessPermission.Update,
    [AudioGenerationAccessOperation.Delete]: AudioGenerationAccessPermission.Delete,
    [AudioGenerationAccessOperation.Validate]: AudioGenerationAccessPermission.Validate,
    [AudioGenerationAccessOperation.Query]: AudioGenerationAccessPermission.Read,
};
export class AudioGenerationAccessCoordinator {
    logger;
    history;
    registry;
    totalRequests = 0;
    readTimes = [];
    writeTimes = [];
    constructor(logger, history, registry) {
        this.logger = logger;
        this.history = history;
        this.registry = registry;
    }
    async requestAccess(request) {
        const start = Date.now();
        this.totalRequests++;
        const prepared = PREPARED_AUDIO_GENERATION_MODULES.find((m) => m.category === request.category);
        if (!prepared) {
            throw new AudioGenerationFoundationError(`Unknown audio generation category: ${request.category}`, "UNKNOWN_CATEGORY");
        }
        const registration = this.registry.getModule(prepared.moduleId);
        if (!registration) {
            throw new AudioGenerationFoundationError(`Audio Generation module not in registry: ${prepared.moduleId}`, "NOT_REGISTERED");
        }
        const requiredPermission = OPERATION_PERMISSION_MAP[request.operation];
        const granted = this.hasPermission(registration.accessPermissions, requiredPermission);
        const durationMs = Date.now() - start;
        if (granted) {
            if (request.operation === AudioGenerationAccessOperation.Read ||
                request.operation === AudioGenerationAccessOperation.Query) {
                this.readTimes.push(durationMs);
            }
            else if (request.operation === AudioGenerationAccessOperation.Write ||
                request.operation === AudioGenerationAccessOperation.Update) {
                this.writeTimes.push(durationMs);
            }
        }
        const result = {
            granted,
            durationMs,
            message: granted
                ? `Access granted to ${prepared.moduleId} via Audio Generation Foundation`
                : `Access denied: ${request.requesterId} lacks ${requiredPermission} for ${prepared.moduleId}`,
        };
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "access",
            category: request.category,
            operation: request.operation,
            requesterId: request.requesterId,
            durationMs,
            success: granted,
            detail: result.message,
        });
        return result;
    }
    getAverageReadMs() {
        if (this.readTimes.length === 0)
            return 0;
        return Math.round(this.readTimes.reduce((a, b) => a + b, 0) / this.readTimes.length);
    }
    getAverageWriteMs() {
        if (this.writeTimes.length === 0)
            return 0;
        return Math.round(this.writeTimes.reduce((a, b) => a + b, 0) / this.writeTimes.length);
    }
    getTotalRequests() {
        return this.totalRequests;
    }
    hasPermission(permissions, required) {
        if (permissions.includes(required))
            return true;
        if (required === AudioGenerationAccessPermission.Update &&
            permissions.includes(AudioGenerationAccessPermission.Write)) {
            return true;
        }
        if (required === AudioGenerationAccessPermission.Read &&
            permissions.includes(AudioGenerationAccessPermission.Validate)) {
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=audio-generation-access-coordinator.js.map