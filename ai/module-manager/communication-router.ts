import type { AiCoreManager } from "../core/ai-core-manager.js";
import { ModuleManagerLogger } from "./module-logger.js";
import {
  CommunicationRequest,
  CommunicationResponse,
  ManagedModuleState,
  ModuleCommunicationRecord,
  ModuleManagerError,
  ModuleRegistryRecord,
} from "./types.js";

let commCounter = 0;

export class ModuleCommunicationRouter {
  private readonly records: ModuleCommunicationRecord[] = [];
  private readonly isolatedModules = new Set<string>();

  constructor(
    private readonly getRecord: (id: string) => ModuleRegistryRecord | undefined,
    private readonly logger: ModuleManagerLogger
  ) {}

  isolate(moduleId: string): void {
    this.isolatedModules.add(moduleId);
  }

  clearIsolation(moduleId: string): void {
    this.isolatedModules.delete(moduleId);
  }

  isIsolated(moduleId: string): boolean {
    return this.isolatedModules.has(moduleId);
  }

  async route(
    core: AiCoreManager,
    request: CommunicationRequest,
    handler?: (payload: Record<string, unknown> | undefined) => Promise<unknown>
  ): Promise<CommunicationResponse> {
    const start = Date.now();
    const id = `comm-${++commCounter}-${Date.now()}`;
    const errors: string[] = [];
    const warnings: string[] = [];
    let success = false;
    let result: unknown;
    let message = "Communication completed";

    const sender = this.getRecord(request.senderId);
    const receiver = this.getRecord(request.receiverId);

    if (!sender || !receiver) {
      errors.push("Sender or receiver not registered");
      message = "Communication rejected: unknown module";
    } else if (!sender.enabled || !receiver.enabled) {
      errors.push("Module disabled");
      message = "Communication rejected: module disabled";
    } else if (
      this.isIsolated(request.senderId) ||
      this.isIsolated(request.receiverId)
    ) {
      errors.push("Module isolated");
      message = "Communication rejected: module isolated";
    } else if (
      sender.status !== ManagedModuleState.Running &&
      sender.status !== ManagedModuleState.Ready
    ) {
      warnings.push(`Sender status is ${sender.status}`);
    } else if (
      receiver.status !== ManagedModuleState.Running &&
      receiver.status !== ManagedModuleState.Ready
    ) {
      warnings.push(`Receiver status is ${receiver.status}`);
    } else {
      try {
        if (handler) {
          result = await handler(request.payload);
        } else {
          const plugin = core.registry.getPlugin(request.receiverId);
          if (!plugin) {
            errors.push(`No plugin handler for ${request.receiverId}`);
            message = "Communication failed: no handler";
          } else {
            const health = await plugin.healthCheck();
            result = { health, action: request.action, payload: request.payload };
            success = health.healthy;
            message = success ? "Health probe succeeded" : "Health probe failed";
          }
        }
        if (errors.length === 0 && handler) {
          success = true;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        message = "Communication failed with error";
      }
    }

    const record: ModuleCommunicationRecord = {
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
    this.logger.log(
      success ? "info" : "warn",
      "communication",
      message,
      { recordId: id, sender: request.senderId, receiver: request.receiverId }
    );

    if (errors.length) {
      throw new ModuleManagerError(message, "COMMUNICATION_REJECTED");
    }

    return { success, result, message, record };
  }

  getRecords(): ReadonlyArray<ModuleCommunicationRecord> {
    return this.records;
  }
}
