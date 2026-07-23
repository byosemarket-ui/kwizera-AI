import {
  MemoryAccessOperation,
  MemoryAccessPermission,
  MemoryAccessRequest,
  MemoryAccessResult,
  MemoryFoundationError,
} from "./types.js";
import { PREPARED_MEMORY_CATEGORIES } from "./memory-categories.js";
import { MemoryFoundationLogger } from "./memory-logger.js";
import { MemoryHistoryStore } from "./memory-history-store.js";
import { MemoryRegistry } from "./memory-registry.js";
import { MemoryStorageManager } from "./memory-storage.js";

const OPERATION_PERMISSION_MAP: Record<MemoryAccessOperation, MemoryAccessPermission> = {
  [MemoryAccessOperation.Read]: MemoryAccessPermission.Read,
  [MemoryAccessOperation.Write]: MemoryAccessPermission.Write,
  [MemoryAccessOperation.Update]: MemoryAccessPermission.Update,
  [MemoryAccessOperation.Delete]: MemoryAccessPermission.Delete,
  [MemoryAccessOperation.Backup]: MemoryAccessPermission.Admin,
  [MemoryAccessOperation.Recover]: MemoryAccessPermission.Admin,
};

export class MemoryAccessCoordinator {
  private totalRequests = 0;
  private readTimes: number[] = [];
  private writeTimes: number[] = [];

  constructor(
    private readonly logger: MemoryFoundationLogger,
    private readonly history: MemoryHistoryStore,
    private readonly registry: MemoryRegistry,
    private readonly storage: MemoryStorageManager
  ) {}

  async requestAccess(request: MemoryAccessRequest): Promise<MemoryAccessResult> {
    const start = Date.now();
    this.totalRequests++;

    const prepared = PREPARED_MEMORY_CATEGORIES.find((c) => c.category === request.category);
    if (!prepared) {
      throw new MemoryFoundationError(
        `Unknown memory category: ${request.category}`,
        "UNKNOWN_CATEGORY"
      );
    }

    const registration = this.registry.getModule(prepared.memoryId);
    if (!registration) {
      throw new MemoryFoundationError(
        `Memory module not in registry: ${prepared.memoryId}`,
        "NOT_REGISTERED"
      );
    }

    const requiredPermission = OPERATION_PERMISSION_MAP[request.operation];
    const granted = this.hasPermission(registration.accessPermissions, requiredPermission);

    if (!granted) {
      const result: MemoryAccessResult = {
        granted: false,
        operation: request.operation,
        category: request.category,
        storagePath: registration.storageLocation,
        durationMs: Date.now() - start,
        message: `Access denied: ${request.requesterId} lacks ${requiredPermission} for ${prepared.memoryId}`,
      };
      this.recordAccess(request, result, false);
      return result;
    }

    const durationMs = Date.now() - start;
    if (request.operation === MemoryAccessOperation.Read) {
      this.readTimes.push(durationMs);
    } else if (
      request.operation === MemoryAccessOperation.Write ||
      request.operation === MemoryAccessOperation.Update
    ) {
      this.writeTimes.push(durationMs);
    }

    const result: MemoryAccessResult = {
      granted: true,
      operation: request.operation,
      category: request.category,
      storagePath: registration.storageLocation,
      durationMs,
      message: `Access granted to ${prepared.memoryId} via Memory Foundation`,
    };

    this.recordAccess(request, result, true);
    this.logger.log("debug", "access", "Memory access coordinated", {
      requesterId: request.requesterId,
      category: request.category,
      operation: request.operation,
      granted: true,
      durationMs,
    });

    return result;
  }

  private recordAccess(
    request: MemoryAccessRequest,
    result: MemoryAccessResult,
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
    permissions: MemoryAccessPermission[],
    required: MemoryAccessPermission
  ): boolean {
    if (permissions.includes(required)) return true;
    if (
      required === MemoryAccessPermission.Update &&
      permissions.includes(MemoryAccessPermission.Write)
    ) {
      return true;
    }
    return false;
  }
}
