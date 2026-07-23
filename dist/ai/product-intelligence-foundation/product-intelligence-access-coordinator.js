import { ProductIntelligenceAccessOperation, ProductIntelligenceAccessPermission, ProductIntelligenceFoundationError, } from "./types.js";
import { PREPARED_PRODUCT_INTELLIGENCE_MODULES } from "./product-intelligence-categories.js";
const OPERATION_PERMISSION_MAP = {
    [ProductIntelligenceAccessOperation.Read]: ProductIntelligenceAccessPermission.Read,
    [ProductIntelligenceAccessOperation.Write]: ProductIntelligenceAccessPermission.Write,
    [ProductIntelligenceAccessOperation.Update]: ProductIntelligenceAccessPermission.Update,
    [ProductIntelligenceAccessOperation.Delete]: ProductIntelligenceAccessPermission.Delete,
    [ProductIntelligenceAccessOperation.Validate]: ProductIntelligenceAccessPermission.Validate,
    [ProductIntelligenceAccessOperation.Query]: ProductIntelligenceAccessPermission.Read,
};
export class ProductIntelligenceAccessCoordinator {
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
        const prepared = PREPARED_PRODUCT_INTELLIGENCE_MODULES.find((m) => m.category === request.category);
        if (!prepared) {
            throw new ProductIntelligenceFoundationError(`Unknown product intelligence category: ${request.category}`, "UNKNOWN_CATEGORY");
        }
        const registration = this.registry.getModule(prepared.moduleId);
        if (!registration) {
            throw new ProductIntelligenceFoundationError(`Product Intelligence module not in registry: ${prepared.moduleId}`, "NOT_REGISTERED");
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
        if (request.operation === ProductIntelligenceAccessOperation.Read ||
            request.operation === ProductIntelligenceAccessOperation.Query) {
            this.readTimes.push(durationMs);
        }
        else if (request.operation === ProductIntelligenceAccessOperation.Write ||
            request.operation === ProductIntelligenceAccessOperation.Update) {
            this.writeTimes.push(durationMs);
        }
        const result = {
            granted: true,
            operation: request.operation,
            category: request.category,
            storagePath: registration.storageLocation,
            durationMs,
            message: `Access granted to ${prepared.moduleId} via Product Intelligence Foundation`,
        };
        this.recordAccess(request, result, true);
        this.logger.log("debug", "access", "Product Intelligence access coordinated", {
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
        if (required === ProductIntelligenceAccessPermission.Update &&
            permissions.includes(ProductIntelligenceAccessPermission.Write)) {
            return true;
        }
        if (required === ProductIntelligenceAccessPermission.Read &&
            permissions.includes(ProductIntelligenceAccessPermission.Validate)) {
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=product-intelligence-access-coordinator.js.map