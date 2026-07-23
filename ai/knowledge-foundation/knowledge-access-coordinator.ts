import {
  KnowledgeAccessOperation,
  KnowledgeAccessPermission,
  KnowledgeAccessRequest,
  KnowledgeAccessResult,
  KnowledgeFoundationError,
} from "./types.js";
import { PREPARED_KNOWLEDGE_CATEGORIES } from "./knowledge-categories.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeHistoryStore } from "./knowledge-history-store.js";
import { KnowledgeRegistry } from "./knowledge-registry.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";

const OPERATION_PERMISSION_MAP: Record<KnowledgeAccessOperation, KnowledgeAccessPermission> = {
  [KnowledgeAccessOperation.Read]: KnowledgeAccessPermission.Read,
  [KnowledgeAccessOperation.Write]: KnowledgeAccessPermission.Write,
  [KnowledgeAccessOperation.Update]: KnowledgeAccessPermission.Update,
  [KnowledgeAccessOperation.Delete]: KnowledgeAccessPermission.Delete,
  [KnowledgeAccessOperation.Validate]: KnowledgeAccessPermission.Validate,
  [KnowledgeAccessOperation.Query]: KnowledgeAccessPermission.Read,
};

export class KnowledgeAccessCoordinator {
  private totalRequests = 0;
  private readTimes: number[] = [];
  private writeTimes: number[] = [];

  constructor(
    private readonly logger: KnowledgeFoundationLogger,
    private readonly history: KnowledgeHistoryStore,
    private readonly registry: KnowledgeRegistry,
    private readonly storage: KnowledgeStorageManager
  ) {}

  async requestAccess(request: KnowledgeAccessRequest): Promise<KnowledgeAccessResult> {
    const start = Date.now();
    this.totalRequests++;

    const prepared = PREPARED_KNOWLEDGE_CATEGORIES.find((c) => c.category === request.category);
    if (!prepared) {
      throw new KnowledgeFoundationError(
        `Unknown knowledge category: ${request.category}`,
        "UNKNOWN_CATEGORY"
      );
    }

    const registration = this.registry.getModule(prepared.knowledgeId);
    if (!registration) {
      throw new KnowledgeFoundationError(
        `Knowledge module not in registry: ${prepared.knowledgeId}`,
        "NOT_REGISTERED"
      );
    }

    const requiredPermission = OPERATION_PERMISSION_MAP[request.operation];
    const granted = this.hasPermission(registration.accessPermissions, requiredPermission);

    if (!granted) {
      const result: KnowledgeAccessResult = {
        granted: false,
        operation: request.operation,
        category: request.category,
        storagePath: registration.storageLocation,
        durationMs: Date.now() - start,
        message: `Access denied: ${request.requesterId} lacks ${requiredPermission} for ${prepared.knowledgeId}`,
      };
      this.recordAccess(request, result, false);
      return result;
    }

    const durationMs = Date.now() - start;
    if (request.operation === KnowledgeAccessOperation.Read || request.operation === KnowledgeAccessOperation.Query) {
      this.readTimes.push(durationMs);
    } else if (
      request.operation === KnowledgeAccessOperation.Write ||
      request.operation === KnowledgeAccessOperation.Update
    ) {
      this.writeTimes.push(durationMs);
    }

    const result: KnowledgeAccessResult = {
      granted: true,
      operation: request.operation,
      category: request.category,
      storagePath: registration.storageLocation,
      durationMs,
      message: `Access granted to ${prepared.knowledgeId} via Knowledge Foundation`,
    };

    this.recordAccess(request, result, true);
    this.logger.log("debug", "access", "Knowledge access coordinated", {
      requesterId: request.requesterId,
      category: request.category,
      operation: request.operation,
      granted: true,
      durationMs,
    });

    return result;
  }

  private recordAccess(
    request: KnowledgeAccessRequest,
    result: KnowledgeAccessResult,
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
    permissions: KnowledgeAccessPermission[],
    required: KnowledgeAccessPermission
  ): boolean {
    if (permissions.includes(required)) return true;
    if (
      required === KnowledgeAccessPermission.Update &&
      permissions.includes(KnowledgeAccessPermission.Write)
    ) {
      return true;
    }
    if (
      required === KnowledgeAccessPermission.Read &&
      permissions.includes(KnowledgeAccessPermission.Validate)
    ) {
      return true;
    }
    return false;
  }
}
