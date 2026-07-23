import { ResourceEstimate, TimeEstimate, PlanTask, PlanningType } from "./types.js";

const STORAGE_BY_TYPE: Partial<Record<PlanningType, number>> = {
  "promotional-video-production": 500_000_000,
  "image-enhancement": 50_000_000,
  export: 200_000_000,
  backup: 100_000_000,
};

const MEMORY_BY_TYPE: Partial<Record<PlanningType, number>> = {
  "promotional-video-production": 2048,
  "image-analysis": 512,
  "marketing-campaign": 1024,
};

export class ResourceEstimator {
  estimate(
    type: PlanningType,
    tasks: PlanTask[],
    moduleIds: string[]
  ): { resources: ResourceEstimate; time: TimeEstimate } {
    const totalMs = tasks.reduce((sum, t) => sum + t.estimatedMs, 0);
    const perTaskMs: Record<string, number> = {};
    for (const task of tasks) {
      perTaskMs[task.id] = task.estimatedMs;
    }

    const storageBytes = STORAGE_BY_TYPE[type] ?? 10_000_000;
    const memoryMb = MEMORY_BY_TYPE[type] ?? 256;
    const cpuIntensity: ResourceEstimate["cpuIntensity"] =
      type === "promotional-video-production" || type === "video-enhancement"
        ? "high"
        : type === "export"
          ? "medium"
          : "low";

    return {
      resources: {
        modules: moduleIds,
        storageBytes,
        memoryMb,
        cpuIntensity,
      },
      time: {
        totalMs,
        perTaskMs,
        humanReadable: totalMs >= 60_000
          ? `${Math.round(totalMs / 60_000)} min`
          : `${Math.round(totalMs / 1000)} sec`,
      },
    };
  }
}
