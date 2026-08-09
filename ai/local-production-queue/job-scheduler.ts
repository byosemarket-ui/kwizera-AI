import type { ProductionJobPriority, ProductionJobType } from "./types.js";

const PRIORITY_RANK: Record<ProductionJobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/** Canonical creative chain used when auto-building dependency graphs. */
export const DEFAULT_JOB_CHAIN: ProductionJobType[] = [
  "product-analysis",
  "background-removal",
  "storyboard-generation",
  "image-generation",
  "video-generation",
  "rendering",
];

export const JOB_TYPE_ESTIMATES_MS: Record<ProductionJobType, number> = {
  "product-analysis": 2_000,
  "background-removal": 3_000,
  "image-enhancement": 2_500,
  "storyboard-generation": 4_000,
  "prompt-generation": 1_500,
  "image-generation": 8_000,
  "video-generation": 15_000,
  "audio-generation": 5_000,
  rendering: 10_000,
  export: 3_000,
  "knowledge-update": 2_000,
  "ai-learning": 4_000,
};

export function priorityRank(priority: ProductionJobPriority): number {
  return PRIORITY_RANK[priority];
}

export function defaultResourceProfile(jobType: ProductionJobType): {
  cpuWeight: number;
  gpuWeight: number;
  ramMb: number;
  vramMb: number;
  diskMb: number;
} {
  const heavyGpu: ProductionJobType[] = [
    "image-generation",
    "video-generation",
    "rendering",
    "background-removal",
    "image-enhancement",
  ];
  const isHeavy = heavyGpu.includes(jobType);
  return {
    cpuWeight: isHeavy ? 0.45 : 0.2,
    gpuWeight: isHeavy ? 0.55 : 0.1,
    ramMb: isHeavy ? 1024 : 256,
    vramMb: isHeavy ? 2048 : 0,
    diskMb: jobType === "export" || jobType === "rendering" ? 512 : 64,
  };
}

export function suggestFailureCause(error: string, jobType: ProductionJobType): string {
  const lower = error.toLowerCase();
  if (lower.includes("dependency") || lower.includes("depends")) {
    return "Upstream dependency not completed; wait for prior jobs.";
  }
  if (lower.includes("resource") || lower.includes("cpu") || lower.includes("gpu") || lower.includes("ram")) {
    return "Local resources temporarily insufficient; resume when capacity frees.";
  }
  if (lower.includes("corrupt") || lower.includes("invalid order")) {
    return "Invalid execution order detected; dependency graph must be repaired.";
  }
  if (jobType.includes("generation") || jobType === "rendering") {
    return "Generation/render stage failed; retry from last checkpoint.";
  }
  return "Transient local execution failure; retry or resume from checkpoint.";
}

/**
 * Returns true if `order` respects dependsOn edges (every dependency appears before the job).
 */
export function isValidExecutionOrder(
  jobs: Array<{ jobId: string; dependsOn: string[] }>,
  order: string[],
): boolean {
  const index = new Map(order.map((id, i) => [id, i]));
  for (const job of jobs) {
    const jobIndex = index.get(job.jobId);
    if (jobIndex == null) continue;
    for (const dep of job.dependsOn) {
      const depIndex = index.get(dep);
      if (depIndex == null) continue;
      if (depIndex >= jobIndex) return false;
    }
  }
  return true;
}

export function topologicalReady(
  jobId: string,
  dependsOn: string[],
  completedIds: Set<string>,
): boolean {
  return dependsOn.every((dep) => completedIds.has(dep));
}
