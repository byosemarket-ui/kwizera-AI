import type { AiModulePlugin } from "../core/types.js";
import { ModuleManagerLogger } from "./module-logger.js";
import {
  ManagedModuleState,
  ModuleHealthStatus,
  ModuleRegistryRecord,
} from "./types.js";

export interface ModuleHealthSnapshot {
  moduleId: string;
  status: ManagedModuleState;
  healthStatus: ModuleHealthStatus;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  responseTimeMs: number;
  runtimeErrors: number;
  available: boolean;
}

export class ModuleHealthMonitor {
  private readonly errorCounts = new Map<string, number>();

  constructor(private readonly logger: ModuleManagerLogger) {}

  recordError(moduleId: string): void {
    this.errorCounts.set(moduleId, (this.errorCounts.get(moduleId) ?? 0) + 1);
  }

  async checkModule(
    record: ModuleRegistryRecord,
    plugin?: AiModulePlugin
  ): Promise<ModuleHealthSnapshot> {
    const start = Date.now();
    let available = record.enabled;
    let healthStatus = ModuleHealthStatus.Unknown;
    let runtimeErrors = this.errorCounts.get(record.moduleId) ?? 0;

    if (record.status === ManagedModuleState.Failed) {
      healthStatus = ModuleHealthStatus.Unhealthy;
      available = false;
    } else if (plugin) {
      try {
        const health = await plugin.healthCheck();
        available = health.healthy;
        healthStatus = health.healthy
          ? ModuleHealthStatus.Healthy
          : ModuleHealthStatus.Degraded;
        if (!health.healthy) {
          runtimeErrors += 1;
          this.errorCounts.set(record.moduleId, runtimeErrors);
        }
      } catch {
        healthStatus = ModuleHealthStatus.Unhealthy;
        available = false;
        runtimeErrors += 1;
        this.errorCounts.set(record.moduleId, runtimeErrors);
      }
    } else if (
      record.status === ManagedModuleState.Registered ||
      record.status === ManagedModuleState.Disabled
    ) {
      healthStatus = ModuleHealthStatus.Unknown;
      available = false;
    }

    const mem = process.memoryUsage();
    const snapshot: ModuleHealthSnapshot = {
      moduleId: record.moduleId,
      status: record.status,
      healthStatus,
      cpuUsagePercent: 0,
      memoryUsageMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      responseTimeMs: Date.now() - start,
      runtimeErrors,
      available,
    };

    record.healthStatus = healthStatus;
    record.lastActivity = new Date().toISOString();

    this.logger.log("info", "health", `Health check: ${record.moduleId}`, {
      healthStatus,
      available,
      responseTimeMs: snapshot.responseTimeMs,
    });

    return snapshot;
  }

  shouldIsolate(snapshot: ModuleHealthSnapshot): boolean {
    return (
      snapshot.healthStatus === ModuleHealthStatus.Unhealthy ||
      snapshot.runtimeErrors >= 3
    );
  }
}
