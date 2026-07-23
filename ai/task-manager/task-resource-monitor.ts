import type { AiCoreManager } from "../core/ai-core-manager.js";
import { ResourceSnapshot } from "./types.js";

export class TaskResourceMonitor {
  snapshot(core: AiCoreManager | null): ResourceSnapshot {
    const mem = process.memoryUsage();
    const memoryMbEstimate = Math.round(mem.heapUsed / (1024 * 1024));

    return {
      cpuIntensity:
        memoryMbEstimate > 512 ? "high" : memoryMbEstimate > 256 ? "medium" : "low",
      memoryMbEstimate,
      diskUsageEstimate: 0,
      databaseActive: Boolean(core?.configuration.getConfiguration().storage.storageRoot),
      aiRuntimeReady: core?.runtime.isWorkflowReady() ?? false,
    };
  }

  canAcceptTask(snapshot: ResourceSnapshot): boolean {
    if (!snapshot.aiRuntimeReady) return false;
    if (snapshot.memoryMbEstimate > 1024) return false;
    return true;
  }
}
