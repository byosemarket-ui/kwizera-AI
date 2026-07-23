import {
  VideoIntelligenceAccessOperation,
  VideoIntelligenceAccessPermission,
  VideoIntelligenceAccessRequest,
  VideoIntelligenceAccessResult,
  VideoIntelligenceFoundationError,
} from "./types.js";
import { PREPARED_VIDEO_INTELLIGENCE_MODULES } from "./video-intelligence-categories.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceHistoryStore } from "./video-intelligence-history-store.js";
import { VideoIntelligenceRegistry } from "./video-intelligence-registry.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";

const OPERATION_PERMISSION_MAP: Record<
  VideoIntelligenceAccessOperation,
  VideoIntelligenceAccessPermission
> = {
  [VideoIntelligenceAccessOperation.Read]: VideoIntelligenceAccessPermission.Read,
  [VideoIntelligenceAccessOperation.Write]: VideoIntelligenceAccessPermission.Write,
  [VideoIntelligenceAccessOperation.Update]: VideoIntelligenceAccessPermission.Update,
  [VideoIntelligenceAccessOperation.Delete]: VideoIntelligenceAccessPermission.Delete,
  [VideoIntelligenceAccessOperation.Validate]: VideoIntelligenceAccessPermission.Validate,
  [VideoIntelligenceAccessOperation.Query]: VideoIntelligenceAccessPermission.Read,
};

export class VideoIntelligenceAccessCoordinator {
  private totalRequests = 0;
  private readTimes: number[] = [];
  private writeTimes: number[] = [];

  constructor(
    private readonly logger: VideoIntelligenceFoundationLogger,
    private readonly history: VideoIntelligenceHistoryStore,
    private readonly registry: VideoIntelligenceRegistry,
    private readonly storage: VideoIntelligenceStorageManager
  ) {}

  async requestAccess(request: VideoIntelligenceAccessRequest): Promise<VideoIntelligenceAccessResult> {
    const start = Date.now();
    this.totalRequests++;

    const prepared = PREPARED_VIDEO_INTELLIGENCE_MODULES.find((m) => m.category === request.category);
    if (!prepared) {
      throw new VideoIntelligenceFoundationError(
        `Unknown video intelligence category: ${request.category}`,
        "UNKNOWN_CATEGORY"
      );
    }

    const registration = this.registry.getModule(prepared.moduleId);
    if (!registration) {
      throw new VideoIntelligenceFoundationError(
        `Video Intelligence module not in registry: ${prepared.moduleId}`,
        "NOT_REGISTERED"
      );
    }

    const requiredPermission = OPERATION_PERMISSION_MAP[request.operation];
    const granted = this.hasPermission(registration.accessPermissions, requiredPermission);

    if (!granted) {
      const result: VideoIntelligenceAccessResult = {
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
      request.operation === VideoIntelligenceAccessOperation.Read ||
      request.operation === VideoIntelligenceAccessOperation.Query
    ) {
      this.readTimes.push(durationMs);
    } else if (
      request.operation === VideoIntelligenceAccessOperation.Write ||
      request.operation === VideoIntelligenceAccessOperation.Update
    ) {
      this.writeTimes.push(durationMs);
    }

    const result: VideoIntelligenceAccessResult = {
      granted: true,
      operation: request.operation,
      category: request.category,
      storagePath: registration.storageLocation,
      durationMs,
      message: `Access granted to ${prepared.moduleId} via Video Intelligence Foundation`,
    };

    this.recordAccess(request, result, true);
    this.logger.log("debug", "access", "Video Intelligence access coordinated", {
      requesterId: request.requesterId,
      category: request.category,
      operation: request.operation,
      granted: true,
      durationMs,
    });

    return result;
  }

  private recordAccess(
    request: VideoIntelligenceAccessRequest,
    result: VideoIntelligenceAccessResult,
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
    permissions: VideoIntelligenceAccessPermission[],
    required: VideoIntelligenceAccessPermission
  ): boolean {
    if (permissions.includes(required)) return true;
    if (
      required === VideoIntelligenceAccessPermission.Update &&
      permissions.includes(VideoIntelligenceAccessPermission.Write)
    ) {
      return true;
    }
    if (
      required === VideoIntelligenceAccessPermission.Read &&
      permissions.includes(VideoIntelligenceAccessPermission.Validate)
    ) {
      return true;
    }
    return false;
  }
}
