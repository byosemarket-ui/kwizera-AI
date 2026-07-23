import fs from "node:fs";
import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MonitoredModuleHealthScore } from "./types.js";

export interface ResourceMetrics {
  diskUsageMb: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
  readPerformanceMs: number;
  writePerformanceMs: number;
  searchPerformanceMs: number;
  retrievalPerformanceMs: number;
}

export class ResourceMonitor {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly storageRoot: string
  ) {}

  measure(): ResourceMetrics {
    const retrieval = this.foundation.getRetrievalEngine().buildStatusReport();
    const storage = this.foundation.getStorageEngine().buildStatusReport();

    let diskUsageMb = 0;
    const memoryRoot = this.foundation.getMemoryRoot();
    if (fs.existsSync(memoryRoot)) {
      diskUsageMb = Math.round(this.dirSize(memoryRoot) / (1024 * 1024));
    }

    const mem = process.memoryUsage();
    const memoryUsageMb = Math.round(mem.heapUsed / (1024 * 1024));

    return {
      diskUsageMb,
      memoryUsageMb,
      cpuUsagePercent: 0,
      readPerformanceMs: storage.performance?.averageReadMs ?? 0,
      writePerformanceMs: storage.performance?.averageWriteMs ?? 0,
      searchPerformanceMs: retrieval.searchPerformance.averageSearchMs,
      retrievalPerformanceMs: retrieval.searchPerformance.averageRetrievalMs,
    };
  }

  private dirSize(dir: string): number {
    let size = 0;
    if (!fs.existsSync(dir)) return 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) size += this.dirSize(p);
      else if (entry.isFile()) size += fs.statSync(p).size;
    }
    return size;
  }
}

export function derivePerformanceIssues(
  metrics: ResourceMetrics,
  moduleScores: MonitoredModuleHealthScore[]
): string[] {
  const issues: string[] = [];
  if (metrics.retrievalPerformanceMs > 200) issues.push("Slow retrieval detected");
  if (metrics.writePerformanceMs > 200) issues.push("Slow storage writes detected");
  if (metrics.searchPerformanceMs > 200) issues.push("Slow search performance detected");
  if (metrics.diskUsageMb > 5000) issues.push("High disk usage");
  if (metrics.memoryUsageMb > 512) issues.push("High memory usage");
  return issues;
}
