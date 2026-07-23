import { ImageGenerationAccessOperation, ImageGenerationAccessPermission, ImageGenerationFoundationError, } from "./types.js";
import { PREPARED_IMAGE_GENERATION_MODULES } from "./image-generation-categories.js";
const OPERATION_PERMISSION_MAP = {
    [ImageGenerationAccessOperation.Read]: ImageGenerationAccessPermission.Read,
    [ImageGenerationAccessOperation.Write]: ImageGenerationAccessPermission.Write,
    [ImageGenerationAccessOperation.Update]: ImageGenerationAccessPermission.Update,
    [ImageGenerationAccessOperation.Delete]: ImageGenerationAccessPermission.Delete,
    [ImageGenerationAccessOperation.Validate]: ImageGenerationAccessPermission.Validate,
    [ImageGenerationAccessOperation.Query]: ImageGenerationAccessPermission.Read,
};
export class ImageGenerationAccessCoordinator {
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
        const prepared = PREPARED_IMAGE_GENERATION_MODULES.find((m) => m.category === request.category);
        if (!prepared) {
            throw new ImageGenerationFoundationError(`Unknown image generation category: ${request.category}`, "UNKNOWN_CATEGORY");
        }
        const registration = this.registry.getModule(prepared.moduleId);
        if (!registration) {
            throw new ImageGenerationFoundationError(`Image Generation module not in registry: ${prepared.moduleId}`, "NOT_REGISTERED");
        }
        const requiredPermission = OPERATION_PERMISSION_MAP[request.operation];
        const granted = this.hasPermission(registration.accessPermissions, requiredPermission);
        const durationMs = Date.now() - start;
        if (granted) {
            if (request.operation === ImageGenerationAccessOperation.Read ||
                request.operation === ImageGenerationAccessOperation.Query) {
                this.readTimes.push(durationMs);
            }
            else if (request.operation === ImageGenerationAccessOperation.Write ||
                request.operation === ImageGenerationAccessOperation.Update) {
                this.writeTimes.push(durationMs);
            }
        }
        const result = {
            granted,
            durationMs,
            message: granted
                ? `Access granted to ${prepared.moduleId} via Image Generation Foundation`
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
        if (required === ImageGenerationAccessPermission.Update &&
            permissions.includes(ImageGenerationAccessPermission.Write)) {
            return true;
        }
        if (required === ImageGenerationAccessPermission.Read &&
            permissions.includes(ImageGenerationAccessPermission.Validate)) {
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=image-generation-access-coordinator.js.map