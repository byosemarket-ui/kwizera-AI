import { ImageIntelligenceAccessOperation, ImageIntelligenceAccessPermission, ImageIntelligenceFoundationError, } from "./types.js";
import { PREPARED_IMAGE_INTELLIGENCE_MODULES } from "./image-intelligence-categories.js";
const OPERATION_PERMISSION_MAP = {
    [ImageIntelligenceAccessOperation.Read]: ImageIntelligenceAccessPermission.Read,
    [ImageIntelligenceAccessOperation.Write]: ImageIntelligenceAccessPermission.Write,
    [ImageIntelligenceAccessOperation.Update]: ImageIntelligenceAccessPermission.Update,
    [ImageIntelligenceAccessOperation.Delete]: ImageIntelligenceAccessPermission.Delete,
    [ImageIntelligenceAccessOperation.Validate]: ImageIntelligenceAccessPermission.Validate,
    [ImageIntelligenceAccessOperation.Query]: ImageIntelligenceAccessPermission.Read,
};
export class ImageIntelligenceAccessCoordinator {
    logger;
    history;
    registry;
    storage;
    totalRequests = 0;
    readTimes = [];
    writeTimes = [];
    constructor(logger, history, registry, storage) {
        this.logger = logger;
        this.history = history;
        this.registry = registry;
        this.storage = storage;
    }
    async requestAccess(request) {
        const start = Date.now();
        this.totalRequests++;
        const prepared = PREPARED_IMAGE_INTELLIGENCE_MODULES.find((m) => m.category === request.category);
        if (!prepared) {
            throw new ImageIntelligenceFoundationError(`Unknown image intelligence category: ${request.category}`, "UNKNOWN_CATEGORY");
        }
        const registration = this.registry.getModule(prepared.moduleId);
        if (!registration) {
            throw new ImageIntelligenceFoundationError(`Image Intelligence module not in registry: ${prepared.moduleId}`, "NOT_REGISTERED");
        }
        const requiredPermission = OPERATION_PERMISSION_MAP[request.operation];
        const granted = this.hasPermission(registration.accessPermissions, requiredPermission);
        if (!granted) {
            const result = {
                granted: false,
                operation: request.operation,
                category: request.category,
                storagePath: registration.storageLocation,
                durationMs: Date.now() - start,
                message: `Access denied: ${request.requesterId} lacks ${requiredPermission} for ${prepared.moduleId}`,
            };
            this.recordAccess(request, result, false);
            return result;
        }
        const durationMs = Date.now() - start;
        if (request.operation === ImageIntelligenceAccessOperation.Read ||
            request.operation === ImageIntelligenceAccessOperation.Query) {
            this.readTimes.push(durationMs);
        }
        else if (request.operation === ImageIntelligenceAccessOperation.Write ||
            request.operation === ImageIntelligenceAccessOperation.Update) {
            this.writeTimes.push(durationMs);
        }
        const result = {
            granted: true,
            operation: request.operation,
            category: request.category,
            storagePath: registration.storageLocation,
            durationMs,
            message: `Access granted to ${prepared.moduleId} via Image Intelligence Foundation`,
        };
        this.recordAccess(request, result, true);
        this.logger.log("debug", "access", "Image Intelligence access coordinated", {
            requesterId: request.requesterId,
            category: request.category,
            operation: request.operation,
            granted: true,
            durationMs,
        });
        return result;
    }
    recordAccess(request, result, success) {
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "access",
            category: request.category,
            operation: request.operation,
            requesterId: request.requesterId,
            durationMs: result.durationMs,
            success,
            detail: result.message,
        });
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
        if (required === ImageIntelligenceAccessPermission.Update &&
            permissions.includes(ImageIntelligenceAccessPermission.Write)) {
            return true;
        }
        if (required === ImageIntelligenceAccessPermission.Read &&
            permissions.includes(ImageIntelligenceAccessPermission.Validate)) {
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=image-intelligence-access-coordinator.js.map