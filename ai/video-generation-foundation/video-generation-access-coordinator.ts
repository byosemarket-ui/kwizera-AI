import {
  VideoGenerationAccessOperation,
  VideoGenerationAccessPermission,
  VideoGenerationAccessRequest,
  VideoGenerationAccessResult,
  VideoGenerationFoundationError,
} from "./types.js";
import { PREPARED_VIDEO_GENERATION_MODULES } from "./video-generation-categories.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationHistoryStore } from "./video-generation-history-store.js";
import { VideoGenerationRegistry } from "./video-generation-registry.js";

const OPERATION_PERMISSION_MAP: Record<
  VideoGenerationAccessOperation,
  VideoGenerationAccessPermission
> = {
  [VideoGenerationAccessOperation.Read]: VideoGenerationAccessPermission.Read,
  [VideoGenerationAccessOperation.Write]: VideoGenerationAccessPermission.Write,
  [VideoGenerationAccessOperation.Update]: VideoGenerationAccessPermission.Update,
  [VideoGenerationAccessOperation.Delete]: VideoGenerationAccessPermission.Delete,
  [VideoGenerationAccessOperation.Validate]: VideoGenerationAccessPermission.Validate,
  [VideoGenerationAccessOperation.Query]: VideoGenerationAccessPermission.Read,
};

export class VideoGenerationAccessCoordinator {
  private totalRequests = 0;
  private readTimes: number[] = [];
  private writeTimes: number[] = [];

  constructor(
    private readonly logger: VideoGenerationFoundationLogger,
    private readonly history: VideoGenerationHistoryStore,
    private readonly registry: VideoGenerationRegistry
  ) {}

  async requestAccess(request: VideoGenerationAccessRequest): Promise<VideoGenerationAccessResult> {
    const start = Date.now();
    this.totalRequests++;

    const prepared = PREPARED_VIDEO_GENERATION_MODULES.find((m) => m.category === request.category);
    if (!prepared) {
      throw new VideoGenerationFoundationError(
        `Unknown video generation category: ${request.category}`,
        "UNKNOWN_CATEGORY"
      );
    }

    const registration = this.registry.getModule(prepared.moduleId);
    if (!registration) {
      throw new VideoGenerationFoundationError(
        `Video Generation module not in registry: ${prepared.moduleId}`,
        "NOT_REGISTERED"
      );
    }

    const requiredPermission = OPERATION_PERMISSION_MAP[request.operation];
    const granted = this.hasPermission(registration.accessPermissions, requiredPermission);
    const durationMs = Date.now() - start;

    if (granted) {
      if (
        request.operation === VideoGenerationAccessOperation.Read ||
        request.operation === VideoGenerationAccessOperation.Query
      ) {
        this.readTimes.push(durationMs);
      } else if (
        request.operation === VideoGenerationAccessOperation.Write ||
        request.operation === VideoGenerationAccessOperation.Update
      ) {
        this.writeTimes.push(durationMs);
      }
    }

    const result: VideoGenerationAccessResult = {
      granted,
      durationMs,
      message: granted
        ? `Access granted to ${prepared.moduleId} via Video Generation Foundation`
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
    permissions: VideoGenerationAccessPermission[],
    required: VideoGenerationAccessPermission
  ): boolean {
    if (permissions.includes(required)) return true;
    if (
      required === VideoGenerationAccessPermission.Update &&
      permissions.includes(VideoGenerationAccessPermission.Write)
    ) {
      return true;
    }
    if (
      required === VideoGenerationAccessPermission.Read &&
      permissions.includes(VideoGenerationAccessPermission.Validate)
    ) {
      return true;
    }
    return false;
  }
}
