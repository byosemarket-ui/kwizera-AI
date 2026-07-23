import {
  ImageIntelligenceAccessOperation,
  ImageIntelligenceAccessPermission,
  ImageIntelligenceAccessRequest,
  ImageIntelligenceAccessResult,
  ImageIntelligenceFoundationError,
} from "./types.js";
import { PREPARED_IMAGE_INTELLIGENCE_MODULES } from "./image-intelligence-categories.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceHistoryStore } from "./image-intelligence-history-store.js";
import { ImageIntelligenceRegistry } from "./image-intelligence-registry.js";
import { ImageIntelligenceStorageManager } from "./image-intelligence-storage.js";

const OPERATION_PERMISSION_MAP: Record<
  ImageIntelligenceAccessOperation,
  ImageIntelligenceAccessPermission
> = {
  [ImageIntelligenceAccessOperation.Read]: ImageIntelligenceAccessPermission.Read,
  [ImageIntelligenceAccessOperation.Write]: ImageIntelligenceAccessPermission.Write,
  [ImageIntelligenceAccessOperation.Update]: ImageIntelligenceAccessPermission.Update,
  [ImageIntelligenceAccessOperation.Delete]: ImageIntelligenceAccessPermission.Delete,
  [ImageIntelligenceAccessOperation.Validate]: ImageIntelligenceAccessPermission.Validate,
  [ImageIntelligenceAccessOperation.Query]: ImageIntelligenceAccessPermission.Read,
};

export class ImageIntelligenceAccessCoordinator {
  private totalRequests = 0;
  private readTimes: number[] = [];
  private writeTimes: number[] = [];

  constructor(
    private readonly logger: ImageIntelligenceFoundationLogger,
    private readonly history: ImageIntelligenceHistoryStore,
    private readonly registry: ImageIntelligenceRegistry,
    private readonly storage: ImageIntelligenceStorageManager
  ) {}

  async requestAccess(request: ImageIntelligenceAccessRequest): Promise<ImageIntelligenceAccessResult> {
    const start = Date.now();
    this.totalRequests++;

    const prepared = PREPARED_IMAGE_INTELLIGENCE_MODULES.find((m) => m.category === request.category);
    if (!prepared) {
      throw new ImageIntelligenceFoundationError(
        `Unknown image intelligence category: ${request.category}`,
        "UNKNOWN_CATEGORY"
      );
    }

    const registration = this.registry.getModule(prepared.moduleId);
    if (!registration) {
      throw new ImageIntelligenceFoundationError(
        `Image Intelligence module not in registry: ${prepared.moduleId}`,
        "NOT_REGISTERED"
      );
    }

    const requiredPermission = OPERATION_PERMISSION_MAP[request.operation];
    const granted = this.hasPermission(registration.accessPermissions, requiredPermission);

    if (!granted) {
      const result: ImageIntelligenceAccessResult = {
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
    if (
      request.operation === ImageIntelligenceAccessOperation.Read ||
      request.operation === ImageIntelligenceAccessOperation.Query
    ) {
      this.readTimes.push(durationMs);
    } else if (
      request.operation === ImageIntelligenceAccessOperation.Write ||
      request.operation === ImageIntelligenceAccessOperation.Update
    ) {
      this.writeTimes.push(durationMs);
    }

    const result: ImageIntelligenceAccessResult = {
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

  private recordAccess(
    request: ImageIntelligenceAccessRequest,
    result: ImageIntelligenceAccessResult,
    success: boolean
  ): void {
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

  getAverageReadMs(): number {
    if (this.readTimes.length === 0) return 0;
    return Math.round(this.readTimes.reduce((a, b) => a + b, 0) / this.readTimes.length);
  }

  getAverageWriteMs(): number {
    if (this.writeTimes.length === 0) return 0;
    return Math.round(this.writeTimes.reduce((a, b) => a + b, 0) / this.writeTimes.length);
  }

  getTotalRequests(): number {
    return this.totalRequests;
  }

  private hasPermission(
    permissions: ImageIntelligenceAccessPermission[],
    required: ImageIntelligenceAccessPermission
  ): boolean {
    if (permissions.includes(required)) return true;
    if (
      required === ImageIntelligenceAccessPermission.Update &&
      permissions.includes(ImageIntelligenceAccessPermission.Write)
    ) {
      return true;
    }
    if (
      required === ImageIntelligenceAccessPermission.Read &&
      permissions.includes(ImageIntelligenceAccessPermission.Validate)
    ) {
      return true;
    }
    return false;
  }
}
